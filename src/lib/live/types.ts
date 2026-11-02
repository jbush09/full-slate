import type { NbaTeam } from "@/data/nba";
import type { NflTeam } from "@/data/nfl";
import type { League } from "@/lib/sim/types";

export type LiveSpot = {
  name: string;
  pos: string;
  tag: string;
  note: string;
  role: "starter" | "rotation";
};

export type LiveRosterPlayer = {
  name: string;
  pos: string;
  tag: string;
  note: string;
  inLineup: boolean;
  lineup: "" | "START" | "ROT";
};

export type LiveLineup = {
  league: League;
  awayId: string;
  homeId: string;
  pulledAt: number;
  source: string;
  warning: string | null;
  slate: { label: string; whenLabel: string; state: string; flipped: boolean } | null;
  awaySpots: LiveSpot[];
  homeSpots: LiveSpot[];
  awayRoster: LiveRosterPlayer[];
  homeRoster: LiveRosterPlayer[];
  away: NflTeam | NbaTeam;
  home: NflTeam | NbaTeam;
};

export type SlateChip = {
  awayId: string;
  homeId: string;
  state: string;
};

export type LiveSlate = {
  title: string;
  games: SlateChip[];
};