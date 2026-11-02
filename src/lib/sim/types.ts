export type League = "NFL" | "NBA";

export type MarketLine = {
  homeMargin: number;
  total: number;
  book: string;
  weight: number;
};

export type DriveResult = "TD" | "FG" | "PUNT" | "TO" | "DOWNS" | "MISS";

export type Drive = {
  abbr: string;
  quarter: number;
  result: DriveResult;
  plays: number;
  yards: number;
  points: number;
  detail: string;
};

export type NflPos = "QB" | "RB" | "WR" | "TE" | "K";

export type NflPlayerLine = {
  name: string;
  pos: NflPos;
  cmp: number;
  att: number;
  passYd: number;
  passTd: number;
  int: number;
  sack: number;
  car: number;
  rushYd: number;
  rushTd: number;
  tgt: number;
  rec: number;
  recYd: number;
  recTd: number;
  fgm: number;
  fga: number;
  xpm: number;
  xpa: number;
  rating: number;
};

export type NflSide = {
  id: string;
  abbr: string;
  score: number;
  quarters: number[];
  yards: number;
  passYd: number;
  rushYd: number;
  plays: number;
  firstDowns: number;
  thirdMade: number;
  thirdAtt: number;
  turnovers: number;
  sacks: number;
  penalties: number;
  penaltyYds: number;
  top: string;
  players: NflPlayerLine[];
};

export type NflGame = {
  away: NflSide;
  home: NflSide;
  drives: Drive[];
  narrative: string;
  notes: string[];
  ot: boolean;
};

export type Bin = { label: string; count: number; hint: string };

export type NflProjPlayer = {
  name: string;
  pos: NflPos;
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
};

export type NflTeamAvg = {
  abbr: string;
  yards: number;
  passYd: number;
  rushYd: number;
  firstDowns: number;
  sacks: number;
  thirdMade: number;
  thirdAtt: number;
  turnovers: number;
  penalties: number;
  penaltyYds: number;
  top: string;
};

export type Proj = {
  n: number;
  homeWin: number;
  awayWin: number;
  tie: number;
  meanHome: number;
  meanAway: number;
  bins: Bin[];
};

export type NflProj = Proj & {
  awayPlayers: NflProjPlayer[];
  homePlayers: NflProjPlayer[];
  awayAvg: NflTeamAvg;
  homeAvg: NflTeamAvg;
};

export type NbaPos = "PG" | "SG" | "SF" | "PF" | "C";

export type NbaPlayerLine = {
  name: string;
  pos: NbaPos;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
};

export type NbaSide = {
  id: string;
  abbr: string;
  score: number;
  quarters: number[];
  players: NbaPlayerLine[];
};

export type QuarterNote = { quarter: string; text: string };

export type NbaGame = {
  away: NbaSide;
  home: NbaSide;
  log: QuarterNote[];
  narrative: string;
  notes: string[];
  ot: boolean;
};

export type NbaProjPlayer = {
  name: string;
  pos: NbaPos;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
};

export type NbaProj = Proj & {
  awayPlayers: NbaProjPlayer[];
  homePlayers: NbaProjPlayer[];
};

export type SimResult =
  | {
      league: "NFL";
      id: string;
      at: number;
      awayId: string;
      homeId: string;
      notes: string[];
      proj: NflProj;
    }
  | {
      league: "NBA";
      id: string;
      at: number;
      awayId: string;
      homeId: string;
      notes: string[];
      proj: NbaProj;
    };
