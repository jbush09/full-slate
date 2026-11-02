import type { MarketLine, NflPos } from "@/lib/sim/types";

export type NflPlayer = {
  name: string;
  pos: NflPos;
  rush: number;
  tgt: number;
  ypc: number;
  ypr: number;
  comp: number;
  ypa: number;
  int: number;
  fg: number;
};

export type NflDiv = "East" | "North" | "South" | "West";
export type NflConf = "AFC" | "NFC";

export type NflTeam = {
  id: string;
  city: string;
  name: string;
  abbr: string;
  conf: NflConf;
  div: NflDiv;
  color: string;
  color2: string;
  passOff: number;
  rushOff: number;
  passDef: number;
  rushDef: number;
  passRate: number;
  toGive: number;
  toTake: number;
  rz: number;
  st: number;
  players: NflPlayer[];
  gamesPlayed?: number;
  windMph?: number | null;
  line?: MarketLine | null;
};

const z = { rush: 0, tgt: 0, ypc: 4.3, ypr: 11, comp: 0.65, ypa: 7.2, int: 0.021, fg: 0.85 };

function qb(name: string, rush: number, ypc: number, comp: number, ypa: number, int = 0.021): NflPlayer {
  return { ...z, name, pos: "QB", rush, ypc, comp, ypa, int };
}
function rb(name: string, rush: number, ypc: number, tgt: number, ypr = 8): NflPlayer {
  return { ...z, name, pos: "RB", rush, ypc, tgt, ypr };
}
function wr(name: string, tgt: number, ypr: number): NflPlayer {
  return { ...z, name, pos: "WR", tgt, ypr };
}
function te(name: string, tgt: number, ypr = 10.6): NflPlayer {
  return { ...z, name, pos: "TE", tgt, ypr };
}
function k(name: string, fg = 0.85): NflPlayer {
  return { ...z, name, pos: "K", fg };
}

type Rates = [number, number, number, number, number, number, number, number, number];

function T(
  abbr: string,
  city: string,
  name: string,
  conf: NflConf,
  div: NflDiv,
  color: string,
  color2: string,
  r: Rates,
  players: NflPlayer[],
): NflTeam {
  const [passOff, rushOff, passDef, rushDef, passRate, toGive, toTake, rz, st] = r;
  return {
    id: abbr,
    city,
    name,
    abbr,
    conf,
    div,
    color,
    color2,
    passOff,
    rushOff,
    passDef,
    rushDef,
    passRate,
    toGive,
    toTake,
    rz,
    st,
    players,
  };
}

export const NFL_TEAMS: NflTeam[] = [
  T("BUF", "Buffalo", "Bills", "AFC", "East", "#00338D", "#C60C30", [1.14, 1.12, 0.97, 0.99, 0.52, 0.9, 1.02, 1.12, 1.02], [
    qb("Josh Allen", 18, 5.7, 0.648, 7.6, 0.02),
    rb("James Cook", 50, 5.2, 8, 8.4),
    rb("Ray Davis", 18, 4.4, 4, 7.2),
    wr("Khalil Shakir", 26, 11.4),
    wr("Keon Coleman", 22, 13.6),
    wr("Joshua Palmer", 15, 12.2),
    te("Dalton Kincaid", 18, 11),
    k("Tyler Bass", 0.86),
  ]),
  T("MIA", "Miami", "Dolphins", "AFC", "East", "#008E97", "#FC4C02", [1.02, 1.1, 0.94, 0.95, 0.55, 1.05, 0.95, 1.0, 0.97], [
    qb("Tua Tagovailoa", 4, 3.6, 0.69, 7.35, 0.02),
    rb("De'Von Achane", 46, 5.3, 12, 9.2),
    rb("Jaylen Wright", 22, 4.5, 4, 7),
    wr("Tyreek Hill", 26, 13.8),
    wr("Jaylen Waddle", 24, 12.4),
    wr("Malik Washington", 12, 10.6),
    te("Jonnu Smith", 12, 10.2),
    k("Jason Sanders", 0.84),
  ]),
  T("NE", "New England", "Patriots", "AFC", "East", "#002244", "#C60C30", [1.02, 1.04, 1.03, 1.01, 0.52, 0.98, 1.02, 1.0, 0.97], [
    qb("Drake Maye", 12, 5.2, 0.665, 7.25, 0.02),
    rb("Rhamondre Stevenson", 40, 4.4, 8, 7.4),
    rb("TreVeyon Henderson", 28, 4.7, 6, 8),
    wr("Stefon Diggs", 26, 12.2),
    wr("DeMario Douglas", 18, 10.4),
    wr("Kayshon Boutte", 14, 13.2),
    te("Hunter Henry", 14, 10.8),
    k("Joey Slye", 0.83),
  ]),
  T("NYJ", "New York", "Jets", "AFC", "East", "#125740", "#FFFFFF", [0.93, 1.02, 0.99, 0.97, 0.54, 1.08, 0.97, 0.92, 0.95], [
    qb("Justin Fields", 16, 5.6, 0.615, 6.85, 0.026),
    rb("Breece Hall", 48, 4.6, 10, 8),
    rb("Braelon Allen", 20, 4.3, 3, 6.8),
    wr("Garrett Wilson", 30, 12.6),
    wr("Allen Lazard", 14, 11.4),
    wr("Xavier Gipson", 10, 9.8),
    te("Mason Taylor", 12, 10.2),
    k("Nick Folk", 0.84),
  ]),
  T("BAL", "Baltimore", "Ravens", "AFC", "North", "#241773", "#9E7C0C", [1.06, 1.16, 1.04, 1.08, 0.46, 0.88, 1.1, 1.08, 1.04], [
    qb("Lamar Jackson", 20, 6.0, 0.665, 7.45, 0.016),
    rb("Derrick Henry", 52, 4.9, 4, 7.2),
    rb("Justice Hill", 14, 4.6, 6, 8.4),
    wr("Zay Flowers", 26, 11.6),
    wr("Rashod Bateman", 16, 14.2),
    wr("DeAndre Hopkins", 12, 12.4),
    te("Mark Andrews", 16, 11.2),
    k("Tyler Loop", 0.84),
  ]),
  T("CIN", "Cincinnati", "Bengals", "AFC", "North", "#FB4F14", "#000000", [1.16, 0.96, 0.94, 0.93, 0.62, 0.96, 0.96, 1.1, 0.99], [
    qb("Joe Burrow", 6, 3.8, 0.7, 7.65, 0.016),
    rb("Chase Brown", 48, 4.5, 10, 8.2),
    rb("Samaje Perine", 14, 4.0, 6, 7.4),
    wr("Ja'Marr Chase", 30, 13.4),
    wr("Tee Higgins", 24, 14.2),
    wr("Andrei Iosivas", 10, 12.6),
    te("Mike Gesicki", 12, 10.8),
    k("Evan McPherson", 0.86),
  ]),
  T("CLE", "Cleveland", "Browns", "AFC", "North", "#311D00", "#FF3C00", [0.92, 1.0, 1.02, 1.0, 0.52, 1.06, 1.0, 0.92, 0.98], [
    qb("Shedeur Sanders", 8, 4.4, 0.62, 6.75, 0.026),
    rb("Quinshon Judkins", 46, 4.4, 6, 7.2),
    rb("Dylan Sampson", 20, 4.3, 5, 7),
    wr("Jerry Jeudy", 26, 12.8),
    wr("Cedric Tillman", 18, 13.2),
    wr("Jamari Thrash", 10, 11.4),
    te("David Njoku", 16, 11),
    k("Andre Szmyt", 0.83),
  ]),
  T("PIT", "Pittsburgh", "Steelers", "AFC", "North", "#FFB612", "#101820", [0.98, 1.02, 1.06, 1.04, 0.56, 0.96, 1.05, 0.96, 1.06], [
    qb("Aaron Rodgers", 4, 3.2, 0.655, 7.05, 0.018),
    rb("Jaylen Warren", 44, 4.4, 10, 8),
    rb("Kaleb Johnson", 22, 4.3, 3, 6.6),
    wr("DK Metcalf", 28, 13.6),
    wr("Calvin Austin III", 16, 12.2),
    wr("Roman Wilson", 12, 11.8),
    te("Pat Freiermuth", 16, 10.4),
    k("Chris Boswell", 0.9),
  ]),
  T("HOU", "Houston", "Texans", "AFC", "South", "#03202F", "#A71930", [1.05, 1.0, 1.06, 1.04, 0.58, 0.97, 1.06, 1.02, 1.0], [
    qb("C.J. Stroud", 6, 4.2, 0.665, 7.35, 0.017),
    rb("Joe Mixon", 44, 4.3, 8, 7.4),
    rb("Dameon Pierce", 18, 4.2, 3, 6.4),
    wr("Nico Collins", 28, 14.4),
    wr("Tank Dell", 20, 12.6),
    wr("Jayden Higgins", 12, 12.8),
    te("Dalton Schultz", 14, 10.2),
    k("Ka'imi Fairbairn", 0.86),
  ]),
  T("IND", "Indianapolis", "Colts", "AFC", "South", "#002C5F", "#A2AAAD", [0.98, 1.08, 0.98, 0.98, 0.5, 1.04, 0.97, 0.98, 0.98], [
    qb("Anthony Richardson", 16, 5.8, 0.555, 7.4, 0.028),
    rb("Jonathan Taylor", 52, 4.8, 6, 7.6),
    rb("Khalil Herbert", 16, 4.2, 3, 6.4),
    wr("Michael Pittman Jr.", 26, 12.2),
    wr("Josh Downs", 20, 10.2),
    wr("Adonai Mitchell", 12, 13.4),
    te("Tyler Warren", 16, 10.8),
    k("Spencer Shrader", 0.82),
  ]),
  T("JAX", "Jacksonville", "Jaguars", "AFC", "South", "#006778", "#D7A22A", [1.02, 1.0, 1.0, 0.99, 0.58, 1.0, 0.99, 0.98, 0.97], [
    qb("Trevor Lawrence", 8, 4.6, 0.645, 7.05, 0.022),
    rb("Travis Etienne", 42, 4.5, 8, 7.8),
    rb("Tank Bigsby", 24, 4.4, 2, 6.2),
    wr("Brian Thomas Jr.", 28, 14.6),
    wr("Travis Hunter", 20, 12.4),
    wr("Dyami Brown", 10, 12.8),
    te("Brenton Strange", 12, 10.4),
    k("Cam Little", 0.84),
  ]),
  T("TEN", "Tennessee", "Titans", "AFC", "South", "#0C2340", "#4B92DB", [0.95, 0.98, 0.96, 0.95, 0.56, 1.06, 0.95, 0.93, 0.95], [
    qb("Cam Ward", 7, 4.2, 0.63, 6.9, 0.024),
    rb("Tony Pollard", 40, 4.3, 8, 7.2),
    rb("Tyjae Spears", 22, 4.5, 6, 7.6),
    wr("Calvin Ridley", 26, 13.8),
    wr("Van Jefferson", 14, 13.2),
    wr("Chimere Dike", 10, 11.6),
    te("Chigoziem Okonkwo", 12, 11.2),
    k("Joey Slye", 0.82),
  ]),
  T("KC", "Kansas City", "Chiefs", "AFC", "West", "#E31837", "#FFB81C", [1.12, 1.0, 1.04, 1.02, 0.6, 0.92, 1.06, 1.08, 1.08], [
    qb("Patrick Mahomes", 10, 5.0, 0.675, 7.35, 0.017),
    rb("Isiah Pacheco", 40, 4.4, 6, 7.4),
    rb("Kareem Hunt", 22, 4.0, 4, 6.6),
    wr("Xavier Worthy", 22, 13.8),
    wr("Rashee Rice", 24, 12.2),
    wr("Marquise Brown", 14, 12.6),
    te("Travis Kelce", 22, 11.4),
    k("Harrison Butker", 0.88),
  ]),
  T("LAC", "Los Angeles", "Chargers", "AFC", "West", "#0080C6", "#FFC20E", [1.08, 1.04, 1.03, 1.01, 0.58, 0.96, 1.03, 1.03, 1.0], [
    qb("Justin Herbert", 8, 4.4, 0.665, 7.4, 0.018),
    rb("Omarion Hampton", 46, 4.6, 6, 7.2),
    rb("Najee Harris", 20, 4.1, 4, 6.6),
    wr("Ladd McConkey", 28, 11.8),
    wr("Quentin Johnston", 16, 13.6),
    wr("Tre Harris", 12, 12.8),
    te("Will Dissly", 10, 9.6),
    k("Cameron Dicker", 0.88),
  ]),
  T("DEN", "Denver", "Broncos", "AFC", "West", "#FB4F14", "#002244", [1.03, 1.05, 1.08, 1.06, 0.54, 0.94, 1.06, 1.0, 1.02], [
    qb("Bo Nix", 10, 4.8, 0.66, 7.05, 0.018),
    rb("RJ Harvey", 40, 4.6, 6, 7.6),
    rb("J.K. Dobbins", 24, 4.4, 3, 6.4),
    wr("Courtland Sutton", 26, 13.4),
    wr("Marvin Mims Jr.", 14, 13.8),
    wr("Troy Franklin", 16, 12.6),
    te("Evan Engram", 14, 10.4),
    k("Wil Lutz", 0.85),
  ]),
  T("LV", "Las Vegas", "Raiders", "AFC", "West", "#2B2B2B", "#A5ACAF", [0.95, 1.02, 0.95, 0.95, 0.55, 1.06, 0.95, 0.94, 0.96], [
    qb("Geno Smith", 4, 3.4, 0.665, 6.95, 0.02),
    rb("Ashton Jeanty", 50, 4.7, 8, 7.8),
    rb("Zamir White", 16, 4.1, 2, 6),
    wr("Jakobi Meyers", 24, 11.8),
    wr("Tre Tucker", 16, 13.4),
    wr("Dont'e Thornton", 10, 14.6),
    te("Brock Bowers", 26, 11.6),
    k("Daniel Carlson", 0.87),
  ]),
  T("PHI", "Philadelphia", "Eagles", "NFC", "East", "#004C54", "#A5ACAF", [1.08, 1.14, 1.08, 1.1, 0.5, 0.9, 1.08, 1.08, 1.02], [
    qb("Jalen Hurts", 16, 5.2, 0.665, 7.2, 0.017),
    rb("Saquon Barkley", 52, 5.2, 8, 8.2),
    rb("Will Shipley", 14, 4.4, 3, 7),
    wr("A.J. Brown", 28, 14.2),
    wr("DeVonta Smith", 24, 12.8),
    wr("Jahan Dotson", 10, 11.4),
    te("Dallas Goedert", 14, 11),
    k("Jake Elliott", 0.85),
  ]),
  T("DAL", "Dallas", "Cowboys", "NFC", "East", "#003594", "#869397", [1.06, 0.99, 0.97, 0.96, 0.6, 0.98, 0.98, 1.02, 1.02], [
    qb("Dak Prescott", 8, 4.6, 0.675, 7.25, 0.019),
    rb("Javonte Williams", 42, 4.3, 6, 7),
    rb("Deuce Vaughn", 16, 4.2, 5, 7.2),
    wr("CeeDee Lamb", 30, 12.4),
    wr("George Pickens", 22, 14.6),
    wr("KaVontae Turpin", 8, 12.8),
    te("Jake Ferguson", 16, 10.2),
    k("Brandon Aubrey", 0.9),
  ]),
  T("NYG", "New York", "Giants", "NFC", "East", "#0B2265", "#A71930", [0.95, 0.98, 0.96, 0.96, 0.56, 1.06, 0.96, 0.93, 0.94], [
    qb("Jaxson Dart", 10, 5.0, 0.62, 6.85, 0.025),
    rb("Tyrone Tracy", 36, 4.5, 6, 7.4),
    rb("Cam Skattebo", 26, 4.3, 5, 6.8),
    wr("Malik Nabers", 30, 13.2),
    wr("Wan'Dale Robinson", 16, 9.6),
    wr("Darius Slayton", 12, 14.4),
    te("Theo Johnson", 12, 11),
    k("Graham Gano", 0.82),
  ]),
  T("WAS", "Washington", "Commanders", "NFC", "East", "#5A1414", "#FFB612", [1.06, 1.08, 0.97, 0.96, 0.52, 1.0, 0.98, 1.04, 0.98], [
    qb("Jayden Daniels", 18, 5.8, 0.675, 7.25, 0.016),
    rb("Brian Robinson Jr.", 36, 4.3, 4, 6.6),
    rb("Austin Ekeler", 18, 4.2, 10, 7.8),
    wr("Terry McLaurin", 26, 14.2),
    wr("Deebo Samuel", 20, 11.2),
    wr("Jaylin Lane", 10, 12.4),
    te("Zach Ertz", 12, 9.8),
    k("Matt Gay", 0.84),
  ]),
  T("DET", "Detroit", "Lions", "NFC", "North", "#0076B6", "#B0B7BC", [1.12, 1.1, 0.99, 1.0, 0.56, 0.94, 1.04, 1.1, 1.0], [
    qb("Jared Goff", 3, 2.8, 0.69, 7.45, 0.017),
    rb("Jahmyr Gibbs", 40, 5.3, 12, 9.4),
    rb("David Montgomery", 28, 4.4, 4, 6.8),
    wr("Amon-Ra St. Brown", 30, 12.2),
    wr("Jameson Williams", 18, 15.2),
    wr("Kalif Raymond", 8, 11.4),
    te("Sam LaPorta", 18, 11.2),
    k("Jake Bates", 0.84),
  ]),
  T("GB", "Green Bay", "Packers", "NFC", "North", "#203731", "#FFB612", [1.05, 1.04, 1.05, 1.03, 0.56, 0.96, 1.03, 1.02, 1.02], [
    qb("Jordan Love", 8, 4.8, 0.655, 7.35, 0.021),
    rb("Josh Jacobs", 48, 4.6, 6, 7.2),
    rb("Emanuel Wilson", 16, 4.3, 3, 6.4),
    wr("Jayden Reed", 22, 12.4),
    wr("Romeo Doubs", 18, 13.2),
    wr("Dontayvion Wicks", 14, 13.6),
    te("Tucker Kraft", 16, 11.6),
    k("Brandon McManus", 0.84),
  ]),
  T("MIN", "Minnesota", "Vikings", "NFC", "North", "#4F2683", "#FFC62F", [1.04, 1.02, 1.02, 1.0, 0.58, 0.98, 1.02, 1.0, 1.0], [
    qb("J.J. McCarthy", 8, 4.6, 0.645, 7.1, 0.022),
    rb("Aaron Jones", 36, 4.6, 8, 8),
    rb("Jordan Mason", 26, 4.4, 2, 6.2),
    wr("Justin Jefferson", 30, 13.6),
    wr("Jordan Addison", 20, 13.8),
    wr("Jalen Nailor", 10, 12.6),
    te("T.J. Hockenson", 16, 11),
    k("Will Reichard", 0.85),
  ]),
  T("CHI", "Chicago", "Bears", "NFC", "North", "#0B162A", "#C83803", [1.02, 1.04, 1.0, 1.01, 0.55, 1.0, 1.0, 0.98, 0.97], [
    qb("Caleb Williams", 10, 5.0, 0.64, 7.0, 0.023),
    rb("D'Andre Swift", 40, 4.5, 8, 7.6),
    rb("Roschon Johnson", 18, 4.2, 3, 6.4),
    wr("DJ Moore", 26, 12.6),
    wr("Rome Odunze", 22, 13.4),
    wr("Luther Burden III", 14, 11.8),
    te("Cole Kmet", 12, 10.4),
    k("Cairo Santos", 0.86),
  ]),
  T("TB", "Tampa Bay", "Buccaneers", "NFC", "South", "#D50A0A", "#FF7900", [1.02, 1.04, 0.99, 0.99, 0.58, 0.99, 0.99, 1.0, 1.0], [
    qb("Baker Mayfield", 7, 4.4, 0.655, 7.1, 0.02),
    rb("Bucky Irving", 44, 4.7, 8, 7.8),
    rb("Rachaad White", 18, 4.0, 6, 6.8),
    wr("Mike Evans", 24, 13.8),
    wr("Chris Godwin", 22, 11.6),
    wr("Emeka Egbuka", 14, 12.8),
    te("Cade Otton", 14, 10.2),
    k("Chase McLaughlin", 0.86),
  ]),
  T("ATL", "Atlanta", "Falcons", "NFC", "South", "#A71930", "#000000", [1.0, 1.08, 0.97, 0.97, 0.52, 1.02, 0.97, 0.98, 0.98], [
    qb("Michael Penix", 6, 4.0, 0.65, 7.25, 0.021),
    rb("Bijan Robinson", 46, 4.9, 10, 8.6),
    rb("Tyler Allgeier", 20, 4.3, 2, 6.2),
    wr("Drake London", 28, 13.2),
    wr("Darnell Mooney", 16, 14.2),
    wr("Ray-Ray McCloud", 8, 9.4),
    te("Kyle Pitts", 16, 12.2),
    k("Younghoe Koo", 0.85),
  ]),
  T("CAR", "Carolina", "Panthers", "NFC", "South", "#0085CA", "#101820", [0.97, 1.0, 0.95, 0.95, 0.56, 1.04, 0.95, 0.95, 0.96], [
    qb("Bryce Young", 8, 4.8, 0.63, 6.85, 0.023),
    rb("Chuba Hubbard", 44, 4.4, 6, 6.8),
    rb("Rico Dowdle", 20, 4.3, 3, 6.4),
    wr("Tetairoa McMillan", 26, 13.2),
    wr("Xavier Legette", 16, 12.6),
    wr("Jalen Coker", 12, 12.2),
    te("Tommy Tremble", 10, 9.8),
    k("Eddy Pineiro", 0.84),
  ]),
  T("NO", "New Orleans", "Saints", "NFC", "South", "#D3BC8D", "#101820", [0.94, 0.98, 0.95, 0.95, 0.56, 1.07, 0.94, 0.92, 0.96], [
    qb("Tyler Shough", 6, 4.2, 0.62, 6.7, 0.027),
    rb("Alvin Kamara", 40, 4.3, 12, 7.6),
    rb("Kendre Miller", 20, 4.2, 2, 6.2),
    wr("Chris Olave", 26, 12.8),
    wr("Rashid Shaheed", 16, 15.2),
    wr("Brandin Cooks", 12, 12.2),
    te("Juwan Johnson", 12, 11.4),
    k("Blake Grupe", 0.82),
  ]),
  T("SF", "San Francisco", "49ers", "NFC", "West", "#AA0000", "#B3995D", [1.1, 1.08, 1.06, 1.08, 0.54, 0.92, 1.08, 1.06, 1.04], [
    qb("Brock Purdy", 6, 4.4, 0.685, 7.55, 0.016),
    rb("Christian McCaffrey", 42, 4.8, 14, 8.8),
    rb("Isaac Guerendo", 16, 4.6, 2, 7),
    wr("Brandon Aiyuk", 22, 13.4),
    wr("Ricky Pearsall", 18, 12.8),
    wr("Jauan Jennings", 14, 12.2),
    te("George Kittle", 18, 12.6),
    k("Jake Moody", 0.83),
  ]),
  T("SEA", "Seattle", "Seahawks", "NFC", "West", "#002244", "#69BE28", [1.02, 1.05, 1.04, 1.03, 0.54, 0.97, 1.04, 1.0, 1.0], [
    qb("Sam Darnold", 5, 3.6, 0.66, 7.15, 0.02),
    rb("Kenneth Walker III", 44, 4.6, 6, 7.4),
    rb("Zach Charbonnet", 24, 4.3, 4, 6.6),
    wr("Jaxon Smith-Njigba", 30, 12.8),
    wr("Cooper Kupp", 20, 11.4),
    wr("Tory Horton", 10, 13.2),
    te("AJ Barner", 10, 10.6),
    k("Jason Myers", 0.85),
  ]),
  T("LAR", "Los Angeles", "Rams", "NFC", "West", "#003594", "#FFA300", [1.08, 1.04, 1.03, 1.01, 0.58, 0.94, 1.04, 1.04, 1.02], [
    qb("Matthew Stafford", 3, 2.6, 0.66, 7.55, 0.019),
    rb("Kyren Williams", 48, 4.5, 6, 7),
    rb("Blake Corum", 16, 4.3, 2, 6.2),
    wr("Puka Nacua", 30, 12.6),
    wr("Davante Adams", 24, 12.8),
    wr("Tutu Atwell", 8, 13.6),
    te("Tyler Higbee", 10, 10.4),
    k("Joshua Karty", 0.83),
  ]),
  T("ARI", "Arizona", "Cardinals", "NFC", "West", "#97233F", "#FFB612", [1.02, 1.0, 0.97, 0.96, 0.56, 1.02, 0.97, 1.0, 0.98], [
    qb("Kyler Murray", 14, 5.6, 0.67, 7.05, 0.019),
    rb("James Conner", 42, 4.4, 6, 6.8),
    rb("Trey Benson", 22, 4.6, 3, 7),
    wr("Marvin Harrison Jr.", 28, 13.8),
    wr("Michael Wilson", 16, 12.6),
    wr("Greg Dortch", 8, 9.2),
    te("Trey McBride", 24, 11.2),
    k("Chad Ryland", 0.82),
  ]),
];

function assertNfl() {
  if (NFL_TEAMS.length !== 32) throw new Error(`NFL teams ${NFL_TEAMS.length}`);
  const ids = new Set<string>();
  for (const t of NFL_TEAMS) {
    if (ids.has(t.id)) throw new Error(`dup ${t.id}`);
    ids.add(t.id);
    const qbs = t.players.filter((p) => p.pos === "QB");
    if (qbs.length !== 1) throw new Error(`${t.abbr} qb`);
  }
}
assertNfl();

export const NFL_BY_ID: Record<string, NflTeam> = Object.fromEntries(NFL_TEAMS.map((t) => [t.id, t]));

export const NFL_DIVS: NflDiv[] = ["East", "North", "South", "West"];

/** Away abbr, home abbr. Marquee pairs, not a claimed schedule. */
export const NFL_MARQUEE: [string, string][] = [
  ["BUF", "KC"],
  ["BAL", "CIN"],
  ["PHI", "DAL"],
  ["DET", "GB"],
  ["SF", "SEA"],
  ["LAR", "ARI"],
];
