import { NBA_BY_ID, type NbaTeam } from "@/data/nba";
import { NFL_BY_ID, type NflTeam } from "@/data/nfl";
import { projectNba } from "@/lib/sim/nba-sim";
import { projectNfl } from "@/lib/sim/nfl-sim";
import { freshRng } from "@/lib/sim/random";
import type { League, SimResult } from "@/lib/sim/types";

export const SIM_COUNT = 10_000;

export function simulateMatch(
  league: League,
  awayId: string,
  homeId: string,
  live?: { away: NflTeam | NbaTeam; home: NflTeam | NbaTeam },
): SimResult {
  const rng = freshRng();
  const id = `${Date.now().toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`;
  const at = Date.now();
  if (league === "NFL") {
    const away = (live?.away as NflTeam | undefined) ?? NFL_BY_ID[awayId];
    const home = (live?.home as NflTeam | undefined) ?? NFL_BY_ID[homeId];
    if (!away || !home) throw new Error("Pick two NFL teams");
    const proj = projectNfl(away, home, rng, SIM_COUNT);
    return { league, id, at, awayId, homeId, notes: [], proj };
  }
  const away = (live?.away as NbaTeam | undefined) ?? NBA_BY_ID[awayId];
  const home = (live?.home as NbaTeam | undefined) ?? NBA_BY_ID[homeId];
  if (!away || !home) throw new Error("Pick two NBA teams");
  const proj = projectNba(away, home, rng, SIM_COUNT);
  return { league, id, at, awayId, homeId, notes: [], proj };
}

export function spreadLabel(homeAbbr: string, awayAbbr: string, meanHome: number, meanAway: number) {
  const margin = meanHome - meanAway;
  const pts = Math.round(Math.abs(margin) * 2) / 2;
  if (pts < 0.5) return "Pick'em";
  if (margin > 0) return `${homeAbbr} −${pts.toFixed(1)}`;
  return `${awayAbbr} −${pts.toFixed(1)}`;
}

export function totalLabel(meanHome: number, meanAway: number) {
  const total = Math.round((meanHome + meanAway) * 2) / 2;
  return total.toFixed(1);
}

export function pct(count: number, n: number) {
  if (n <= 0) return 0;
  return Math.round((count / n) * 1000) / 10;
}
