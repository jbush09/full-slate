import type { FinalChip } from "@/lib/live/results";
import type { League, SimResult } from "@/lib/sim/types";

export type SimMark = "pending" | "W" | "L" | "P" | "late";

export type SimLog = {
  id: string;
  at: number;
  league: League;
  awayId: string;
  homeId: string;
  simAway: number;
  simHome: number;
  pickId: string;
  actualAway: number | null;
  actualHome: number | null;
  mark: SimMark;
};

export function logFromSim(sim: SimResult): SimLog {
  const simAway = sim.proj.meanAway;
  const simHome = sim.proj.meanHome;
  const pickId = Math.abs(simAway - simHome) < 0.05 ? "" : simHome > simAway ? sim.homeId : sim.awayId;
  return {
    id: sim.id,
    at: sim.at,
    league: sim.league,
    awayId: sim.awayId,
    homeId: sim.homeId,
    simAway,
    simHome,
    pickId,
    actualAway: null,
    actualHome: null,
    mark: "pending",
  };
}

function findFinal(log: SimLog, games: FinalChip[]) {
  return games.find(
    (game) =>
      (game.awayId === log.awayId && game.homeId === log.homeId) ||
      (game.awayId === log.homeId && game.homeId === log.awayId),
  );
}

/** Write finals onto pending logs. Already settled rows stay put. */
export function settleLogs(logs: SimLog[], games: FinalChip[], league: League) {
  let changed = false;
  const next = logs.map((log) => {
    if (log.league !== league || log.mark !== "pending") return log;
    const game = findFinal(log, games);
    if (!game) return log;
    changed = true;
    const flipped = game.awayId !== log.awayId;
    const actualAway = flipped ? game.homeScore : game.awayScore;
    const actualHome = flipped ? game.awayScore : game.homeScore;
    const start = Date.parse(game.start);
    const late = Number.isFinite(start) && log.at >= start;
    const winner = actualHome === actualAway ? "" : actualHome > actualAway ? log.homeId : log.awayId;
    let mark: SimMark = "P";
    if (late) mark = "late";
    else if (log.pickId && winner) mark = winner === log.pickId ? "W" : "L";
    return { ...log, actualAway, actualHome, mark };
  });
  return changed ? next : logs;
}

/** One counted pick per game: the latest sim saved before kickoff. */
export function recordRows(logs: SimLog[], league?: League) {
  const groups = new Map<string, SimLog>();
  for (const log of logs) {
    if (league && log.league !== league) continue;
    if (log.mark !== "W" && log.mark !== "L" && log.mark !== "P") continue;
    const key = `${log.league}:${[log.awayId, log.homeId].sort().join(":")}`;
    const prev = groups.get(key);
    if (!prev || log.at > prev.at) groups.set(key, log);
  }
  return [...groups.values()];
}

export function tally(logs: SimLog[], league?: League) {
  const rows = recordRows(logs, league);
  return {
    w: rows.filter((row) => row.mark === "W").length,
    l: rows.filter((row) => row.mark === "L").length,
    p: rows.filter((row) => row.mark === "P").length,
  };
}
