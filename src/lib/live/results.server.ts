import { NBA_BY_ID } from "@/data/nba";
import { NFL_BY_ID } from "@/data/nfl";
import type { League } from "@/lib/sim/types";
import type { ActualGame, ActualPlayer, ActualSide, FinalChip } from "@/lib/live/results";

const cache = new Map<string, { at: number; games: FinalChip[] }>();
const boxCache = new Map<string, { at: number; game: ActualGame }>();

function ourId(league: League, abbr: string | undefined) {
  const code = (abbr ?? "").toUpperCase();
  if (league === "NFL") return code === "WSH" ? "WAS" : code;
  const nba: Record<string, string> = { NY: "NYK", WSH: "WAS", GS: "GSW", NO: "NOP", SA: "SAS", UTAH: "UTA" };
  return nba[code] ?? code;
}

function known(league: League, id: string) {
  return league === "NFL" ? Boolean(NFL_BY_ID[id]) : Boolean(NBA_BY_ID[id]);
}

function ymd(offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 86_400_000));
  const g = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${g("year")}${g("month")}${g("day")}`;
}

async function espn(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "FullSlate/1.0" },
    });
    if (!res.ok) throw new Error(`Results feed ${res.status}`);
    return (await res.json()) as Record<string, any>;
  } finally {
    clearTimeout(timer);
  }
}

function num(raw: unknown) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string" || raw === "" || raw === "--") return 0;
  const v = Number(raw.replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
}

function pair(raw: unknown) {
  const [a, b] = String(raw ?? "0-0").split(/[-/]/);
  return [num(a), num(b)] as const;
}

function emptySide(id: string, score: number): ActualSide {
  return {
    id,
    score,
    yards: 0,
    passYd: 0,
    rushYd: 0,
    firstDowns: 0,
    turnovers: 0,
    sacks: 0,
    top: "—",
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
  };
}

function stat(list: { name?: string; displayValue?: string }[] | undefined, name: string) {
  return list?.find((row) => row.name === name)?.displayValue ?? "";
}

function readFinals(league: League, events: any[]): FinalChip[] {
  const out: FinalChip[] = [];
  for (const event of events ?? []) {
    if (String(event?.status?.type?.state ?? "") !== "post") continue;
    const comp = event?.competitions?.[0];
    const sides = comp?.competitors ?? [];
    const away = sides.find((s: any) => s.homeAway === "away");
    const home = sides.find((s: any) => s.homeAway === "home");
    const awayId = ourId(league, away?.team?.abbreviation);
    const homeId = ourId(league, home?.team?.abbreviation);
    if (!awayId || !homeId || !known(league, awayId) || !known(league, homeId)) continue;
    out.push({
      awayId,
      homeId,
      awayScore: num(away?.score),
      homeScore: num(home?.score),
      status: String(event?.status?.type?.shortDetail ?? event?.status?.type?.description ?? "Final"),
      start: String(event?.date ?? ""),
    });
  }
  return out;
}

export async function listFinals(league: League): Promise<FinalChip[]> {
  const hit = cache.get(league);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.games;
  let games: FinalChip[] = [];
  if (league === "NFL") {
    const data = await espn("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    games = readFinals(league, data.events ?? []);
  } else {
    const pages = await Promise.all(
      [0, -1].map((offset) =>
        espn(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(offset)}`),
      ),
    );
    const seen = new Set<string>();
    games = pages.flatMap((page) => readFinals(league, page.events ?? [])).filter((game) => {
      const key = `${game.awayId}-${game.homeId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  cache.set(league, { at: Date.now(), games });
  return games;
}

const recentCache = new Map<string, { at: number; games: FinalChip[] }>();

export async function listRecentFinals(league: League): Promise<FinalChip[]> {
  const hit = recentCache.get(league);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.games;
  const seen = new Set<string>();
  const add = (rows: FinalChip[]) => {
    const out: FinalChip[] = [];
    for (const game of rows) {
      const key = `${game.awayId}-${game.homeId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(game);
    }
    return out;
  };
  let games: FinalChip[] = [];
  if (league === "NFL") {
    const data = await espn("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const year = Number(data.season?.year ?? 2026);
    const week = Number(data.week?.number ?? 1);
    const weeks = [week, week - 1, week - 2].filter((value) => value > 0);
    const pages = await Promise.all(
      weeks.map((value) =>
        espn(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=${value}&seasontype=2&year=${year}`,
        ).catch(() => ({ events: [] })),
      ),
    );
    games = add(pages.flatMap((page) => readFinals(league, page.events ?? [])));
  } else {
    const pages = await Promise.all(
      [0, -1, -2, -3, -4, -5, -6, -7].map((offset) =>
        espn(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(offset)}`).catch(() => ({
          events: [],
        })),
      ),
    );
    games = add(pages.flatMap((page) => readFinals(league, page.events ?? [])));
  }
  recentCache.set(league, { at: Date.now(), games });
  return games;
}

function blankPlayer(name: string, teamId: string): ActualPlayer {
  return {
    name,
    teamId,
    passYd: 0,
    passTd: 0,
    int: 0,
    rushYd: 0,
    rushTd: 0,
    rec: 0,
    recYd: 0,
    recTd: 0,
    fgm: 0,
    fga: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    min: 0,
    tpm: 0,
  };
}

function applyNfl(players: Map<string, ActualPlayer>, block: any, teamId: string) {
  for (const cat of block?.statistics ?? []) {
    const name = String(cat?.name ?? "");
    for (const row of cat?.athletes ?? []) {
      const who = String(row?.athlete?.displayName ?? "");
      if (!who) continue;
      const key = `${teamId}:${who}`;
      const player = players.get(key) ?? blankPlayer(who, teamId);
      const stats = (row?.stats ?? []) as string[];
      if (name === "passing") {
        player.passYd += num(stats[1]);
        player.passTd += num(stats[3]);
        player.int += num(stats[4]);
      } else if (name === "rushing") {
        player.rushYd += num(stats[1]);
        player.rushTd += num(stats[3]);
      } else if (name === "receiving") {
        player.rec += num(stats[0]);
        player.recYd += num(stats[1]);
        player.recTd += num(stats[3]);
      } else if (name === "kicking") {
        const [made, att] = pair(stats[0]);
        player.fgm += made;
        player.fga += att;
      } else {
        continue;
      }
      players.set(key, player);
    }
  }
}

function applyNba(players: Map<string, ActualPlayer>, block: any, teamId: string) {
  const cat = (block?.statistics ?? [])[0];
  for (const row of cat?.athletes ?? []) {
    const who = String(row?.athlete?.displayName ?? "");
    if (!who || row?.didNotPlay) continue;
    const stats = (row?.stats ?? []) as string[];
    if (!stats.length || stats[0] === "--") continue;
    const player = blankPlayer(who, teamId);
    player.min = num(stats[0]);
    player.pts = num(stats[1]);
    const [fgm, fga] = pair(stats[2]);
    const [tpm] = pair(stats[3]);
    player.fgm = fgm;
    player.fga = fga;
    player.tpm = tpm;
    player.reb = num(stats[5]);
    player.ast = num(stats[6]);
    player.tov = num(stats[7]);
    player.stl = num(stats[8]);
    player.blk = num(stats[9]);
    players.set(`${teamId}:${who}`, player);
  }
}

function sideFromNfl(id: string, score: number, stats: { name?: string; displayValue?: string }[], oppSacks: string): ActualSide {
  const side = emptySide(id, score);
  side.yards = num(stat(stats, "totalYards"));
  side.passYd = num(stat(stats, "netPassingYards"));
  side.rushYd = num(stat(stats, "rushingYards"));
  side.firstDowns = num(stat(stats, "firstDowns"));
  side.turnovers = num(stat(stats, "turnovers"));
  side.top = stat(stats, "possessionTime") || "—";
  side.sacks = pair(oppSacks)[0];
  return side;
}

function sideFromNba(id: string, score: number, stats: { name?: string; displayValue?: string }[]): ActualSide {
  const side = emptySide(id, score);
  const [fgm, fga] = pair(stat(stats, "fieldGoalsMade-fieldGoalsAttempted"));
  const [tpm, tpa] = pair(stat(stats, "threePointFieldGoalsMade-threePointFieldGoalsAttempted"));
  side.fgm = fgm;
  side.fga = fga;
  side.tpm = tpm;
  side.tpa = tpa;
  side.reb = num(stat(stats, "totalRebounds"));
  side.ast = num(stat(stats, "assists"));
  side.stl = num(stat(stats, "steals"));
  side.blk = num(stat(stats, "blocks"));
  side.tov = num(stat(stats, "turnovers"));
  return side;
}

export async function loadActual(input: { league: League; awayId: string; homeId: string }): Promise<ActualGame> {
  const key = `${input.league}:${input.awayId}:${input.homeId}`;
  const hit = boxCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.game;
  const games = await listFinals(input.league);
  const chip = games.find((game) => game.awayId === input.awayId && game.homeId === input.homeId);
  if (!chip) throw new Error("That game is not in the finals");
  const sport = input.league === "NFL" ? "football/nfl" : "basketball/nba";
  const board =
    input.league === "NFL"
      ? await espn("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard")
      : null;
  const pages =
    input.league === "NBA"
      ? await Promise.all(
          [0, -1].map((offset) =>
            espn(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${ymd(offset)}`),
          ),
        )
      : [];
  const events = input.league === "NFL" ? (board?.events ?? []) : pages.flatMap((page) => page.events ?? []);
  const event = events.find((item: any) => {
    const sides = item?.competitions?.[0]?.competitors ?? [];
    const away = ourId(input.league, sides.find((s: any) => s.homeAway === "away")?.team?.abbreviation);
    const home = ourId(input.league, sides.find((s: any) => s.homeAway === "home")?.team?.abbreviation);
    return away === input.awayId && home === input.homeId;
  });
  if (!event?.id) throw new Error("Could not find that box score");
  const summary = await espn(`https://site.api.espn.com/apis/site/v2/sports/${sport}/summary?event=${event.id}`);
  const teams = (summary.boxscore?.teams ?? []) as any[];
  const awayTeam = teams.find((t) => t.homeAway === "away") ?? teams[0];
  const homeTeam = teams.find((t) => t.homeAway === "home") ?? teams[1];
  const players = new Map<string, ActualPlayer>();
  for (const block of summary.boxscore?.players ?? []) {
    const id = ourId(input.league, block?.team?.abbreviation);
    if (!id) continue;
    if (input.league === "NFL") applyNfl(players, block, id);
    else applyNba(players, block, id);
  }
  const away =
    input.league === "NFL"
      ? sideFromNfl(input.awayId, chip.awayScore, awayTeam?.statistics, stat(homeTeam?.statistics, "sacksYardsLost"))
      : sideFromNba(input.awayId, chip.awayScore, awayTeam?.statistics);
  const home =
    input.league === "NFL"
      ? sideFromNfl(input.homeId, chip.homeScore, homeTeam?.statistics, stat(awayTeam?.statistics, "sacksYardsLost"))
      : sideFromNba(input.homeId, chip.homeScore, homeTeam?.statistics);
  const game: ActualGame = {
    league: input.league,
    awayId: input.awayId,
    homeId: input.homeId,
    status: chip.status,
    away,
    home,
    players: [...players.values()],
  };
  boxCache.set(key, { at: Date.now(), game });
  return game;
}
