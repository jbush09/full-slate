import { createServerFn } from "@tanstack/react-start";
import type { League } from "@/lib/sim/types";

export type FinalChip = {
  awayId: string;
  homeId: string;
  awayScore: number;
  homeScore: number;
  status: string;
  start: string;
};

export type ActualSide = {
  id: string;
  score: number;
  yards: number;
  passYd: number;
  rushYd: number;
  firstDowns: number;
  turnovers: number;
  sacks: number;
  top: string;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
};

export type ActualPlayer = {
  name: string;
  teamId: string;
  passYd: number;
  passTd: number;
  int: number;
  rushYd: number;
  rushTd: number;
  rec: number;
  recYd: number;
  recTd: number;
  fgm: number;
  fga: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  min: number;
  tpm: number;
};

export type ActualGame = {
  league: League;
  awayId: string;
  homeId: string;
  status: string;
  away: ActualSide;
  home: ActualSide;
  players: ActualPlayer[];
};

export const listFinalGames = createServerFn({ method: "POST" })
  .validator((input: { league: League }) => {
    if (input?.league !== "NFL" && input?.league !== "NBA") throw new Error("Pick a league");
    return input;
  })
  .handler(async ({ data }): Promise<FinalChip[]> => {
    const { listFinals } = await import("./results.server");
    return listFinals(data.league);
  });

export const listRecentFinals = createServerFn({ method: "POST" })
  .validator((input: { league: League }) => {
    if (input?.league !== "NFL" && input?.league !== "NBA") throw new Error("Pick a league");
    return input;
  })
  .handler(async ({ data }): Promise<FinalChip[]> => {
    const { listRecentFinals } = await import("./results.server");
    return listRecentFinals(data.league);
  });

export const loadActualGame = createServerFn({ method: "POST" })
  .validator((input: { league: League; awayId: string; homeId: string }) => {
    if (input?.league !== "NFL" && input?.league !== "NBA") throw new Error("Pick a league");
    if (!input.awayId || !input.homeId) throw new Error("Pick a game");
    return input;
  })
  .handler(async ({ data }): Promise<ActualGame> => {
    const { loadActual } = await import("./results.server");
    return loadActual(data);
  });
