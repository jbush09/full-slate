export type PropMarket =
  | "passYd"
  | "passTd"
  | "int"
  | "cmp"
  | "att"
  | "rushYd"
  | "car"
  | "rec"
  | "recYd"
  | "rushRec"
  | "passRush"
  | "fgm"
  | "kick"
  | "anytime"
  | "pts"
  | "reb"
  | "ast"
  | "tpm"
  | "stl"
  | "blk"
  | "pr"
  | "pa"
  | "ra"
  | "pra"
  | "dd"
  | "td3";

export type ListedProp = {
  id: string;
  player: string;
  teamId: string;
  pos: string;
  market: PropMarket;
  label: string;
  line: number;
  binary: boolean;
};

export type PropBoardData = {
  book: string;
  label: string;
  props: ListedProp[];
  note: string | null;
};

export const PROP_LABEL: Record<PropMarket, string> = {
  passYd: "Pass yards",
  passTd: "Pass TDs",
  int: "Interceptions",
  cmp: "Completions",
  att: "Pass attempts",
  rushYd: "Rush yards",
  car: "Carries",
  rec: "Receptions",
  recYd: "Rec yards",
  rushRec: "Rush + rec yards",
  passRush: "Pass + rush yards",
  fgm: "FG made",
  kick: "Kicking points",
  anytime: "Anytime TD",
  pts: "Points",
  reb: "Rebounds",
  ast: "Assists",
  tpm: "Threes",
  stl: "Steals",
  blk: "Blocks",
  pr: "Pts + reb",
  pa: "Pts + ast",
  ra: "Reb + ast",
  pra: "Pts + reb + ast",
  dd: "Double-double",
  td3: "Triple-double",
};

const ESPN_MARKET: Record<string, PropMarket> = {
  "Total Passing Yards (incl. overtime)": "passYd",
  "Total Passing Touchdowns (incl. overtime)": "passTd",
  "Total Passing Interceptions (incl. overtime)": "int",
  "Total Pass Completions (incl. overtime)": "cmp",
  "Total Passing Attempts (incl. overtime)": "att",
  "Total Rushing Yards (incl. overtime)": "rushYd",
  "Total Carries (incl. overtime)": "car",
  "Total Receptions (incl. overtime)": "rec",
  "Total Receiving Yards (incl. overtime)": "recYd",
  "Total Rushing Plus Receiving Yards (incl. overtime)": "rushRec",
  "Total Passing Plus Rushing Yards (incl. overtime)": "passRush",
  "Total Field Goals Made (incl. overtime)": "fgm",
  "Total Kicking Points (incl. overtime)": "kick",
  "Anytime Touchdown Scorer": "anytime",
  "Total Points": "pts",
  "Total Rebounds": "reb",
  "Total Assists": "ast",
  "Total 3-Point Field Goals": "tpm",
  "Total Steals": "stl",
  "Total Blocks": "blk",
  "Total Points and Rebounds": "pr",
  "Total Points and Assists": "pa",
  "Total Assists and Rebounds": "ra",
  "Total Points, Rebounds, and Assists": "pra",
  "To Record a Double Double": "dd",
  "To Record a Triple Double": "td3",
};

const ORDER: PropMarket[] = [
  "passYd",
  "passTd",
  "int",
  "cmp",
  "att",
  "rushYd",
  "car",
  "rec",
  "recYd",
  "rushRec",
  "passRush",
  "fgm",
  "kick",
  "anytime",
  "pts",
  "reb",
  "ast",
  "pra",
  "pr",
  "pa",
  "ra",
  "tpm",
  "stl",
  "blk",
  "dd",
  "td3",
];

export function marketOf(espnName: string): PropMarket | null {
  return ESPN_MARKET[espnName] ?? null;
}

export function marketRank(market: PropMarket) {
  const i = ORDER.indexOf(market);
  return i === -1 ? ORDER.length : i;
}

export function isBinary(market: PropMarket) {
  return market === "anytime" || market === "dd" || market === "td3";
}
