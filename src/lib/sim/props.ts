import type { NbaTeam } from "@/data/nba";
import type { NflTeam } from "@/data/nfl";
import type { PropMarket } from "@/lib/props";
import { simulateNbaGame } from "@/lib/sim/nba-sim";
import { simulateNflGame } from "@/lib/sim/nfl-sim";
import type { Rng } from "@/lib/sim/random";
import type { League, NbaPlayerLine, NflPlayerLine } from "@/lib/sim/types";

export const PROP_SIMS = 5_000;

export type PropTally = {
  over: number;
  under: number;
  push: number;
  sum: number;
  n: number;
};

function norm(name: string) {
  return name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function nflValue(row: NflPlayerLine, market: PropMarket) {
  switch (market) {
    case "passYd":
      return row.passYd;
    case "passTd":
      return row.passTd;
    case "int":
      return row.int;
    case "cmp":
      return row.cmp;
    case "att":
      return row.att;
    case "rushYd":
      return row.rushYd;
    case "car":
      return row.car;
    case "rec":
      return row.rec;
    case "recYd":
      return row.recYd;
    case "rushRec":
      return row.rushYd + row.recYd;
    case "passRush":
      return row.passYd + row.rushYd;
    case "fgm":
      return row.fgm;
    case "kick":
      return row.fgm * 3 + row.xpm;
    case "anytime":
      return row.rushTd + row.recTd;
    default:
      return 0;
  }
}

function doubleCount(row: NbaPlayerLine) {
  return [row.pts, row.reb, row.ast, row.stl, row.blk].filter((n) => n >= 10).length;
}

function nbaValue(row: NbaPlayerLine, market: PropMarket) {
  switch (market) {
    case "pts":
      return row.pts;
    case "reb":
      return row.reb;
    case "ast":
      return row.ast;
    case "tpm":
      return row.tpm;
    case "stl":
      return row.stl;
    case "blk":
      return row.blk;
    case "pr":
      return row.pts + row.reb;
    case "pa":
      return row.pts + row.ast;
    case "ra":
      return row.reb + row.ast;
    case "pra":
      return row.pts + row.reb + row.ast;
    case "dd":
      return doubleCount(row) >= 2 ? 1 : 0;
    case "td3":
      return doubleCount(row) >= 3 ? 1 : 0;
    default:
      return 0;
  }
}

export function playerInSim(team: { players: { name: string }[] }, player: string) {
  const key = norm(player);
  return team.players.some((row) => norm(row.name) === key);
}

export function tallyProp(
  league: League,
  away: NflTeam | NbaTeam,
  home: NflTeam | NbaTeam,
  player: string,
  teamId: string,
  market: PropMarket,
  line: number,
  n: number,
  rng: Rng,
): PropTally {
  const key = norm(player);
  let over = 0;
  let under = 0;
  let push = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const value =
      league === "NFL"
        ? readNfl(away as NflTeam, home as NflTeam, teamId, key, market, rng)
        : readNba(away as NbaTeam, home as NbaTeam, teamId, key, market, rng);
    sum += value;
    if (value > line) over += 1;
    else if (value < line) under += 1;
    else push += 1;
  }
  return { over, under, push, sum, n };
}

function readNfl(away: NflTeam, home: NflTeam, teamId: string, key: string, market: PropMarket, rng: Rng) {
  const game = simulateNflGame(away, home, rng, false);
  const side = teamId === home.id ? game.home : game.away;
  const row = side.players.find((player) => norm(player.name) === key);
  return row ? nflValue(row, market) : 0;
}

function readNba(away: NbaTeam, home: NbaTeam, teamId: string, key: string, market: PropMarket, rng: Rng) {
  const game = simulateNbaGame(away, home, rng, false);
  const side = teamId === home.id ? game.home : game.away;
  const row = side.players.find((player) => norm(player.name) === key);
  return row ? nbaValue(row, market) : 0;
}
