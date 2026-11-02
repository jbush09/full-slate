import type { MarketLine, NbaPos } from "@/lib/sim/types";

export type NbaPlayer = {
  name: string;
  pos: NbaPos;
  min: number;
  usg: number;
  fg2: number;
  fg3: number;
  three: number;
  ft: number;
  ftr: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
};

export type NbaConf = "East" | "West";
export type NbaDiv = "Atlantic" | "Central" | "Southeast" | "Northwest" | "Pacific" | "Southwest";

export type NbaTeam = {
  id: string;
  city: string;
  name: string;
  abbr: string;
  conf: NbaConf;
  div: NbaDiv;
  color: string;
  color2: string;
  off: number;
  def: number;
  pace: number;
  orb: number;
  tov: number;
  players: NbaPlayer[];
  gamesPlayed?: number;
  line?: MarketLine | null;
};

type Role = "sg" | "sw" | "sb" | "sec" | "st" | "role" | "big" | "bn";

const ROLES: Record<Role, Omit<NbaPlayer, "name" | "pos">> = {
  sg: { min: 35, usg: 0.3, fg2: 0.51, fg3: 0.37, three: 0.4, ft: 0.86, ftr: 0.3, reb: 4.2, ast: 6.4, stl: 1.2, blk: 0.3, tov: 2.8 },
  sw: { min: 36, usg: 0.29, fg2: 0.52, fg3: 0.37, three: 0.36, ft: 0.84, ftr: 0.26, reb: 6.6, ast: 4.4, stl: 1.1, blk: 0.6, tov: 2.4 },
  sb: { min: 34, usg: 0.27, fg2: 0.61, fg3: 0.33, three: 0.2, ft: 0.78, ftr: 0.32, reb: 10.4, ast: 3.6, stl: 0.8, blk: 1.4, tov: 2.6 },
  sec: { min: 33, usg: 0.23, fg2: 0.51, fg3: 0.37, three: 0.4, ft: 0.83, ftr: 0.22, reb: 4.8, ast: 3.8, stl: 1.0, blk: 0.4, tov: 1.8 },
  st: { min: 30, usg: 0.17, fg2: 0.51, fg3: 0.37, three: 0.44, ft: 0.8, ftr: 0.16, reb: 4.4, ast: 2.6, stl: 0.9, blk: 0.4, tov: 1.3 },
  role: { min: 22, usg: 0.14, fg2: 0.5, fg3: 0.37, three: 0.5, ft: 0.78, ftr: 0.12, reb: 3.2, ast: 1.8, stl: 0.7, blk: 0.3, tov: 0.9 },
  big: { min: 26, usg: 0.16, fg2: 0.64, fg3: 0.3, three: 0.1, ft: 0.72, ftr: 0.26, reb: 8.6, ast: 1.6, stl: 0.6, blk: 1.2, tov: 1.3 },
  bn: { min: 16, usg: 0.15, fg2: 0.49, fg3: 0.36, three: 0.42, ft: 0.76, ftr: 0.14, reb: 3.0, ast: 2.0, stl: 0.6, blk: 0.3, tov: 1.0 },
};

function guy(name: string, pos: NbaPos, role: Role, tweak?: Partial<NbaPlayer>): NbaPlayer {
  return { name, pos, ...ROLES[role], ...tweak };
}

function club(
  abbr: string,
  city: string,
  name: string,
  conf: NbaConf,
  div: NbaDiv,
  color: string,
  color2: string,
  off: number,
  def: number,
  pace: number,
  orb: number,
  tov: number,
  players: NbaPlayer[],
): NbaTeam {
  return { id: abbr, city, name, abbr, conf, div, color, color2, off, def, pace, orb, tov, players };
}

export const NBA_TEAMS: NbaTeam[] = [
  club("BOS", "Boston", "Celtics", "East", "Atlantic", "#007A33", "#BA9653", 1.08, 1.08, 98, 0.24, 0.12, [
    guy("Jayson Tatum", "SF", "sw", { usg: 0.31, ast: 5 }),
    guy("Jaylen Brown", "SG", "sw", { usg: 0.28, three: 0.34 }),
    guy("Derrick White", "PG", "sec", { stl: 1.3, three: 0.52, fg3: 0.39 }),
    guy("Jrue Holiday", "SG", "st", { ast: 4.4, stl: 1.2 }),
    guy("Kristaps Porzingis", "C", "sb", { three: 0.42, fg3: 0.37, reb: 7.5, blk: 1.8 }),
    guy("Payton Pritchard", "PG", "role", { usg: 0.2, three: 0.55, fg3: 0.4 }),
    guy("Sam Hauser", "SF", "role", { three: 0.62, fg3: 0.41, usg: 0.14 }),
    guy("Al Horford", "C", "bn", { reb: 6, three: 0.45, fg3: 0.37 }),
  ]),
  club("NYK", "New York", "Knicks", "East", "Atlantic", "#006BB6", "#F58426", 1.06, 1.07, 97, 0.28, 0.13, [
    guy("Jalen Brunson", "PG", "sg", { usg: 0.32, ftr: 0.36, ast: 7.2 }),
    guy("Karl-Anthony Towns", "C", "sb", { three: 0.38, fg3: 0.4, usg: 0.28, reb: 12 }),
    guy("Mikal Bridges", "SF", "sec", { stl: 1.2, three: 0.46 }),
    guy("OG Anunoby", "SF", "st", { three: 0.48, fg3: 0.38, stl: 1.4 }),
    guy("Josh Hart", "SG", "st", { reb: 8, ast: 4.5, usg: 0.14, three: 0.28 }),
    guy("Miles McBride", "PG", "role", { three: 0.52, fg3: 0.39 }),
    guy("Mitchell Robinson", "C", "big", { reb: 10, blk: 1.6, usg: 0.12, min: 22 }),
    guy("Precious Achiuwa", "PF", "bn", { reb: 6 }),
  ]),
  club("PHI", "Philadelphia", "76ers", "East", "Atlantic", "#006BB6", "#ED174C", 1.05, 1.01, 98, 0.25, 0.13, [
    guy("Joel Embiid", "C", "sb", { usg: 0.34, fg2: 0.58, ftr: 0.42, reb: 11, min: 32, blk: 1.6 }),
    guy("Tyrese Maxey", "PG", "sg", { usg: 0.3, three: 0.42, ast: 6 }),
    guy("Paul George", "SF", "sec", { three: 0.48, fg3: 0.38 }),
    guy("VJ Edgecombe", "SG", "st", { stl: 1.2 }),
    guy("Kelly Oubre Jr.", "SF", "st"),
    guy("Jared McCain", "PG", "role", { three: 0.5, usg: 0.2 }),
    guy("Andre Drummond", "C", "big", { reb: 10, usg: 0.14 }),
    guy("Guerschon Yabusele", "PF", "bn", { reb: 5.5 }),
  ]),
  club("BKN", "Brooklyn", "Nets", "East", "Atlantic", "#222222", "#FFFFFF", 0.94, 0.96, 99, 0.24, 0.145, [
    guy("Cam Thomas", "SG", "sg", { usg: 0.3, ast: 3.4 }),
    guy("Nic Claxton", "C", "big", { reb: 9, blk: 2, usg: 0.16 }),
    guy("Dennis Schröder", "PG", "sec", { ast: 6 }),
    guy("Cameron Johnson", "SF", "sec", { three: 0.52, fg3: 0.39, usg: 0.2 }),
    guy("Ziaire Williamson", "SF", "st"),
    guy("Day'Ron Sharpe", "C", "role", { reb: 7, usg: 0.14 }),
    guy("Trendon Watford", "PF", "bn"),
    guy("Keon Johnson", "SG", "bn"),
  ]),
  club("TOR", "Toronto", "Raptors", "East", "Atlantic", "#CE1141", "#000000", 0.99, 1.0, 100, 0.27, 0.135, [
    guy("Scottie Barnes", "SF", "sw", { ast: 6.5, reb: 8, usg: 0.26, three: 0.28, fg3: 0.33 }),
    guy("RJ Barrett", "SF", "sec", { ftr: 0.32, three: 0.3 }),
    guy("Immanuel Quickley", "PG", "sec", { ast: 6, three: 0.48 }),
    guy("Jakob Poeltl", "C", "big", { fg2: 0.66, reb: 9, usg: 0.16 }),
    guy("Gradey Dick", "SG", "st", { three: 0.55, fg3: 0.38 }),
    guy("Ochai Agbaji", "SG", "role"),
    guy("Ja'Kobe Walter", "SG", "bn"),
    guy("Jonathan Mogbo", "PF", "bn", { reb: 6, usg: 0.12 }),
  ]),
  club("MIL", "Milwaukee", "Bucks", "East", "Central", "#00471B", "#EEE1C6", 1.06, 1.0, 100, 0.25, 0.13, [
    guy("Giannis Antetokounmpo", "PF", "sb", { usg: 0.33, fg2: 0.68, three: 0.16, fg3: 0.29, ftr: 0.55, ft: 0.68, reb: 11.5, ast: 6.4, blk: 1.2 }),
    guy("Damian Lillard", "PG", "sg", { three: 0.5, fg3: 0.37, ast: 7, usg: 0.29 }),
    guy("Kyle Kuzma", "PF", "sec"),
    guy("Brook Lopez", "C", "st", { blk: 2.2, three: 0.4, fg3: 0.36, reb: 5.5 }),
    guy("Bobby Portis", "PF", "st", { reb: 8, usg: 0.2 }),
    guy("Gary Trent Jr.", "SG", "role", { three: 0.55 }),
    guy("AJ Green", "SG", "role", { three: 0.62, fg3: 0.41, usg: 0.14 }),
    guy("Ryan Rollins", "PG", "bn", { ast: 4 }),
  ]),
  club("CLE", "Cleveland", "Cavaliers", "East", "Central", "#860038", "#FDBB30", 1.08, 1.07, 99, 0.25, 0.125, [
    guy("Donovan Mitchell", "SG", "sg", { usg: 0.31, ftr: 0.28 }),
    guy("Darius Garland", "PG", "sec", { ast: 6.8, three: 0.42 }),
    guy("Evan Mobley", "PF", "sb", { usg: 0.24, fg2: 0.6, blk: 1.6, reb: 9.5, three: 0.22 }),
    guy("Jarrett Allen", "C", "big", { fg2: 0.68, reb: 10, usg: 0.16 }),
    guy("Max Strus", "SF", "st", { three: 0.58, fg3: 0.37 }),
    guy("De'Andre Hunter", "SF", "st"),
    guy("Sam Merrill", "SG", "role", { three: 0.64, fg3: 0.4, usg: 0.15 }),
    guy("Dean Wade", "PF", "bn", { three: 0.48 }),
  ]),
  club("IND", "Indiana", "Pacers", "East", "Central", "#002D62", "#FDBB30", 1.05, 0.98, 102, 0.23, 0.125, [
    guy("Tyrese Haliburton", "PG", "sg", { usg: 0.26, ast: 9.2, three: 0.48, fg3: 0.39, ftr: 0.16 }),
    guy("Pascal Siakam", "PF", "sw", { usg: 0.25, reb: 7, ast: 3.8, three: 0.28 }),
    guy("Myles Turner", "C", "sec", { blk: 2, three: 0.42, fg3: 0.37, reb: 7 }),
    guy("Andrew Nembhard", "SG", "st", { ast: 5 }),
    guy("Aaron Nesmith", "SF", "st", { three: 0.5 }),
    guy("Bennedict Mathurin", "SG", "sec", { usg: 0.24, ftr: 0.3 }),
    guy("Jarace Walker", "PF", "role"),
    guy("Obi Toppin", "PF", "bn", { fg2: 0.62, usg: 0.18 }),
  ]),
  club("DET", "Detroit", "Pistons", "East", "Central", "#C8102E", "#1D42BA", 1.02, 1.0, 100, 0.26, 0.14, [
    guy("Cade Cunningham", "PG", "sg", { usg: 0.31, ast: 8.2, reb: 6 }),
    guy("Jaden Ivey", "SG", "sec"),
    guy("Ausar Thompson", "SF", "st", { three: 0.22, fg3: 0.3, reb: 6, stl: 1.4, usg: 0.15 }),
    guy("Jalen Duren", "C", "big", { reb: 11, fg2: 0.68, usg: 0.16 }),
    guy("Tobias Harris", "PF", "st"),
    guy("Malik Beasley", "SG", "role", { three: 0.6, fg3: 0.39 }),
    guy("Ron Holland", "SF", "bn", { stl: 1.2 }),
    guy("Isaiah Stewart", "C", "bn", { reb: 7, three: 0.35 }),
  ]),
  club("CHI", "Chicago", "Bulls", "East", "Central", "#CE1141", "#000000", 0.98, 0.97, 100, 0.24, 0.14, [
    guy("Josh Giddey", "PG", "sec", { ast: 7.5, reb: 8, usg: 0.22, three: 0.32 }),
    guy("Coby White", "SG", "sg", { usg: 0.27, three: 0.46 }),
    guy("Matas Buzelis", "SF", "st", { blk: 1.2 }),
    guy("Nikola Vučević", "C", "sec", { reb: 9.5, three: 0.32, fg3: 0.37, usg: 0.22 }),
    guy("Patrick Williams", "PF", "st"),
    guy("Ayo Dosunmu", "SG", "role", { ast: 3.5 }),
    guy("Jalen Smith", "C", "role", { reb: 7 }),
    guy("Kevin Huerter", "SG", "bn", { three: 0.55 }),
  ]),
  club("MIA", "Miami", "Heat", "East", "Southeast", "#98002E", "#F9A01B", 1.01, 1.05, 97, 0.25, 0.13, [
    guy("Bam Adebayo", "C", "sb", { usg: 0.24, fg2: 0.56, three: 0.12, ast: 4.2, reb: 10, blk: 0.9 }),
    guy("Tyler Herro", "SG", "sg", { usg: 0.28, three: 0.42 }),
    guy("Andrew Wiggins", "SF", "sec"),
    guy("Kel'el Ware", "C", "big", { reb: 9, blk: 1.5 }),
    guy("Jaime Jaquez Jr.", "SF", "st", { three: 0.28 }),
    guy("Nikola Jović", "PF", "role", { three: 0.42 }),
    guy("Davion Mitchell", "PG", "role", { ast: 4, stl: 1.2, usg: 0.14 }),
    guy("Duncan Robinson", "SG", "bn", { three: 0.68, fg3: 0.4, usg: 0.16 }),
  ]),
  club("ORL", "Orlando", "Magic", "East", "Southeast", "#0077C0", "#C4CED4", 1.01, 1.07, 97, 0.26, 0.14, [
    guy("Paolo Banchero", "PF", "sw", { usg: 0.3, reb: 8, ast: 5, three: 0.3, ftr: 0.36 }),
    guy("Franz Wagner", "SF", "sec", { usg: 0.24, ast: 4.5 }),
    guy("Jalen Suggs", "PG", "st", { stl: 1.5, three: 0.48 }),
    guy("Wendell Carter Jr.", "C", "big", { reb: 8 }),
    guy("Jett Howard", "SG", "sec", { three: 0.5, fg3: 0.37 }),
    guy("Anthony Black", "PG", "role", { ast: 3.5 }),
    guy("Cole Anthony", "PG", "bn"),
    guy("Jonathan Isaac", "PF", "bn", { blk: 1.6, reb: 6, usg: 0.12 }),
  ]),
  club("ATL", "Atlanta", "Hawks", "East", "Southeast", "#E03A3E", "#C1D32F", 1.03, 0.97, 102, 0.25, 0.135, [
    guy("Trae Young", "PG", "sg", { usg: 0.3, ast: 10.5, three: 0.42, fg3: 0.36, reb: 3, stl: 1.2, tov: 3.6 }),
    guy("Jalen Johnson", "SF", "sw", { usg: 0.24, reb: 9, ast: 5 }),
    guy("Dyson Daniels", "SG", "st", { stl: 2.2, usg: 0.15, three: 0.32, ast: 4 }),
    guy("Onyeka Okongwu", "C", "big", { reb: 9, blk: 1.2 }),
    guy("Zaccharie Risacher", "SF", "st", { three: 0.42 }),
    guy("Bogdan Bogdanović", "SG", "role", { three: 0.52, usg: 0.2 }),
    guy("Terance Mann", "SG", "bn"),
    guy("Keaton Wallace", "PG", "bn"),
  ]),
  club("CHA", "Charlotte", "Hornets", "East", "Southeast", "#1D1160", "#00788C", 0.98, 0.96, 100, 0.24, 0.145, [
    guy("LaMelo Ball", "PG", "sg", { usg: 0.31, ast: 8, reb: 5.5, three: 0.5, fg3: 0.36, tov: 3.4 }),
    guy("Brandon Miller", "SF", "sw", { usg: 0.26, three: 0.46 }),
    guy("Miles Bridges", "PF", "sec"),
    guy("Kon Knueppel", "SG", "st", { three: 0.48 }),
    guy("Mark Williams", "C", "big", { reb: 10, fg2: 0.68 }),
    guy("Collin Sexton", "SG", "role", { usg: 0.22 }),
    guy("Moussa Diabaté", "C", "bn", { reb: 7 }),
    guy("Josh Green", "SG", "bn"),
  ]),
  club("WAS", "Washington", "Wizards", "East", "Southeast", "#002B5C", "#E31837", 0.94, 0.93, 101, 0.24, 0.15, [
    guy("Jordan Poole", "SG", "sg", { usg: 0.28, three: 0.46, tov: 3 }),
    guy("Alexandre Sarr", "C", "sb", { usg: 0.22, blk: 1.8, reb: 8, three: 0.28 }),
    guy("Bilal Coulibaly", "SF", "st", { stl: 1.3 }),
    guy("Bub Carrington", "PG", "sec", { ast: 6, usg: 0.2 }),
    guy("Kyshawn George", "SF", "st", { three: 0.48 }),
    guy("Corey Kispert", "SF", "role", { three: 0.58, fg3: 0.39 }),
    guy("Saddiq Bey", "PF", "bn"),
    guy("Richaun Holmes", "C", "bn", { reb: 6 }),
  ]),
  club("OKC", "Oklahoma City", "Thunder", "West", "Northwest", "#007AC1", "#EF3B24", 1.1, 1.12, 99, 0.26, 0.115, [
    guy("Shai Gilgeous-Alexander", "PG", "sg", { usg: 0.33, fg2: 0.56, three: 0.28, fg3: 0.35, ftr: 0.46, ft: 0.88, reb: 5.5, ast: 6.2, stl: 1.6 }),
    guy("Jalen Williams", "SF", "sw", { usg: 0.25, ast: 5 }),
    guy("Chet Holmgren", "C", "sb", { three: 0.38, fg3: 0.36, blk: 2.4, reb: 8, usg: 0.24 }),
    guy("Luguentz Dort", "SG", "st", { stl: 1.2, three: 0.46 }),
    guy("Alex Caruso", "SG", "role", { stl: 1.6, usg: 0.12, three: 0.42 }),
    guy("Isaiah Hartenstein", "C", "big", { reb: 10, ast: 3, usg: 0.14 }),
    guy("Cason Wallace", "PG", "role", { stl: 1.3, three: 0.42 }),
    guy("Aaron Wiggins", "SF", "bn"),
  ]),
  club("DEN", "Denver", "Nuggets", "West", "Northwest", "#0E2240", "#FEC524", 1.1, 1.02, 99, 0.28, 0.13, [
    guy("Nikola Jokić", "C", "sb", { usg: 0.31, fg2: 0.64, three: 0.24, fg3: 0.36, reb: 12.5, ast: 10.2, stl: 1.4, blk: 0.8, tov: 3.2, ft: 0.82 }),
    guy("Jamal Murray", "PG", "sec", { usg: 0.26, three: 0.42 }),
    guy("Michael Porter Jr.", "SF", "sec", { three: 0.5, fg3: 0.39, reb: 7 }),
    guy("Aaron Gordon", "PF", "st", { fg2: 0.58, three: 0.28, reb: 6 }),
    guy("Christian Braun", "SG", "st", { fg2: 0.58, three: 0.36 }),
    guy("Peyton Watson", "SF", "role", { blk: 1.3, stl: 1.1 }),
    guy("Julian Strawther", "SG", "bn", { three: 0.5 }),
    guy("DaRon Holmes", "C", "bn", { reb: 5 }),
  ]),
  club("MIN", "Minnesota", "Timberwolves", "West", "Northwest", "#0C2340", "#78BE20", 1.05, 1.08, 98, 0.25, 0.13, [
    guy("Anthony Edwards", "SG", "sg", { usg: 0.32, ftr: 0.32, reb: 5.5 }),
    guy("Julius Randle", "PF", "sw", { usg: 0.26, reb: 8, ast: 4.5 }),
    guy("Jaden McDaniels", "SF", "st", { three: 0.4, stl: 1.2 }),
    guy("Rudy Gobert", "C", "big", { reb: 12, blk: 1.8, fg2: 0.68, usg: 0.14, three: 0.01, fg3: 0.1 }),
    guy("Donte DiVincenzo", "SG", "st", { three: 0.58, fg3: 0.39 }),
    guy("Naz Reid", "C", "sec", { three: 0.42, fg3: 0.38, reb: 6 }),
    guy("Rob Dillingham", "PG", "role", { ast: 4, usg: 0.2 }),
    guy("Nickeil Alexander-Walker", "SG", "bn", { stl: 1.1 }),
  ]),
  club("UTA", "Utah", "Jazz", "West", "Northwest", "#002B5C", "#00471B", 0.96, 0.94, 101, 0.25, 0.15, [
    guy("Lauri Markkanen", "PF", "sw", { three: 0.48, fg3: 0.39, reb: 8 }),
    guy("Keyonte George", "PG", "sec", { usg: 0.24, ast: 5.5 }),
    guy("Walker Kessler", "C", "big", { reb: 11, blk: 2.2, fg2: 0.7, usg: 0.14 }),
    guy("Isaiah Collier", "PG", "st", { ast: 6, usg: 0.18, three: 0.28 }),
    guy("Cody Williams", "SF", "st"),
    guy("Brice Sensabaugh", "SF", "role", { usg: 0.2 }),
    guy("Kyle Filipowski", "C", "bn", { reb: 7 }),
    guy("Taylor Hendricks", "PF", "bn", { reb: 5, blk: 1 }),
  ]),
  club("POR", "Portland", "Trail Blazers", "West", "Northwest", "#E03A3E", "#000000", 0.97, 0.96, 101, 0.26, 0.145, [
    guy("Anfernee Simons", "SG", "sg", { three: 0.48, usg: 0.27 }),
    guy("Deni Avdija", "SF", "sw", { ast: 5, reb: 7, usg: 0.24 }),
    guy("Scoot Henderson", "PG", "sec", { ast: 5.5, usg: 0.22 }),
    guy("Donovan Clingan", "C", "big", { reb: 10, blk: 1.8, usg: 0.14 }),
    guy("Shaedon Sharpe", "SG", "sec", { usg: 0.24 }),
    guy("Jerami Grant", "PF", "st", { three: 0.4 }),
    guy("Toumani Camara", "SF", "role", { stl: 1.3, reb: 5 }),
    guy("Matisse Thybulle", "SF", "bn", { stl: 1.6, usg: 0.1 }),
  ]),
  club("LAL", "Los Angeles", "Lakers", "West", "Pacific", "#552583", "#FDB927", 1.06, 0.99, 100, 0.25, 0.135, [
    guy("Luka Dončić", "PG", "sg", { usg: 0.34, ast: 8.4, reb: 8, three: 0.42, fg3: 0.37, tov: 3.6, ftr: 0.36, ft: 0.78 }),
    guy("LeBron James", "SF", "sw", { min: 32, usg: 0.28, ast: 8, reb: 7.2, fg2: 0.56, three: 0.34 }),
    guy("Austin Reaves", "SG", "sec", { ast: 5.5, usg: 0.23 }),
    guy("Rui Hachimura", "PF", "st", { fg2: 0.58 }),
    guy("Dorian Finney-Smith", "PF", "role", { three: 0.52, usg: 0.12 }),
    guy("Jaxson Hayes", "C", "big", { reb: 7, usg: 0.12, fg2: 0.7 }),
    guy("Gabe Vincent", "PG", "bn", { three: 0.46 }),
    guy("Dalton Knecht", "SF", "bn", { three: 0.48, usg: 0.18 }),
  ]),
  club("LAC", "Los Angeles", "Clippers", "West", "Pacific", "#C8102E", "#1D428A", 1.03, 1.02, 98, 0.24, 0.13, [
    guy("James Harden", "PG", "sg", { usg: 0.26, ast: 8.5, three: 0.46, fg3: 0.37, ftr: 0.34 }),
    guy("Kawhi Leonard", "SF", "sw", { usg: 0.28, min: 32, fg2: 0.54, stl: 1.5 }),
    guy("Norman Powell", "SG", "sec", { three: 0.44, usg: 0.22 }),
    guy("Ivica Zubac", "C", "big", { reb: 11, fg2: 0.66, usg: 0.16 }),
    guy("Derrick Jones Jr.", "SF", "st", { blk: 0.9, stl: 1.1 }),
    guy("Kris Dunn", "PG", "role", { stl: 1.6, usg: 0.12, ast: 4 }),
    guy("John Collins", "PF", "role", { fg2: 0.58, reb: 6, usg: 0.18 }),
    guy("Amir Coffey", "SG", "bn"),
  ]),
  club("GSW", "Golden State", "Warriors", "West", "Pacific", "#1D428A", "#FFC72C", 1.04, 1.0, 101, 0.26, 0.14, [
    guy("Stephen Curry", "PG", "sg", { usg: 0.3, three: 0.6, fg3: 0.41, ast: 6, ft: 0.92, ftr: 0.22, min: 32 }),
    guy("Jimmy Butler", "SF", "sw", { usg: 0.24, ftr: 0.46, ft: 0.82, three: 0.18, fg3: 0.32, ast: 5, stl: 1.4 }),
    guy("Draymond Green", "PF", "st", { usg: 0.14, ast: 6, reb: 7, stl: 1.2, blk: 0.9, three: 0.38 }),
    guy("Jonathan Kuminga", "SF", "sec", { fg2: 0.58, three: 0.28, usg: 0.24 }),
    guy("Brandin Podziemski", "SG", "st", { ast: 4.5, reb: 5.5 }),
    guy("Buddy Hield", "SG", "role", { three: 0.62, fg3: 0.38, usg: 0.18 }),
    guy("Moses Moody", "SG", "bn"),
    guy("Quinten Post", "C", "bn", { three: 0.46, reb: 5 }),
  ]),
  club("PHX", "Phoenix", "Suns", "West", "Pacific", "#1D1160", "#E56020", 1.04, 0.98, 99, 0.23, 0.135, [
    guy("Devin Booker", "SG", "sg", { usg: 0.31, ast: 6.5 }),
    guy("Kevin Durant", "SF", "sw", { usg: 0.29, fg2: 0.58, fg3: 0.4, three: 0.36, ft: 0.88, min: 34 }),
    guy("Bradley Beal", "SG", "sec", { usg: 0.22 }),
    guy("Jusuf Nurkić", "C", "big", { reb: 10, ast: 2.5 }),
    guy("Grayson Allen", "SG", "st", { three: 0.55, fg3: 0.4 }),
    guy("Dillon Brooks", "SF", "st", { three: 0.42 }),
    guy("Royce O'Neale", "PF", "role", { three: 0.52 }),
    guy("Oso Ighodaro", "C", "bn", { reb: 6 }),
  ]),
  club("SAC", "Sacramento", "Kings", "West", "Pacific", "#5A2D81", "#63727A", 1.02, 0.97, 100, 0.24, 0.135, [
    guy("DeMar DeRozan", "SF", "sw", { usg: 0.26, three: 0.18, fg3: 0.34, ftr: 0.32, ft: 0.84 }),
    guy("Domantas Sabonis", "C", "sb", { usg: 0.22, fg2: 0.64, reb: 13, ast: 6.5, three: 0.12, blk: 0.6 }),
    guy("Zach LaVine", "SG", "sec", { usg: 0.25, three: 0.44 }),
    guy("Keegan Murray", "PF", "st", { three: 0.48, fg3: 0.38 }),
    guy("Malik Monk", "SG", "st", { usg: 0.22, three: 0.42 }),
    guy("Keon Ellis", "SG", "role", { stl: 1.4, three: 0.48 }),
    guy("Devin Carter", "PG", "bn", { stl: 1.2 }),
    guy("Trey Lyles", "PF", "bn"),
  ]),
  club("DAL", "Dallas", "Mavericks", "West", "Southwest", "#00538C", "#B8C4CA", 1.04, 1.03, 100, 0.25, 0.13, [
    guy("Cooper Flagg", "SF", "sw", { usg: 0.26, reb: 7.5, ast: 4.5, stl: 1.2, blk: 1 }),
    guy("Kyrie Irving", "PG", "sg", { usg: 0.28, fg2: 0.54, ast: 5.5 }),
    guy("Anthony Davis", "PF", "sb", { usg: 0.28, fg2: 0.58, reb: 11.5, blk: 2.1, three: 0.18, min: 32 }),
    guy("Klay Thompson", "SG", "st", { three: 0.6, fg3: 0.38, usg: 0.2 }),
    guy("P.J. Washington", "PF", "st", { three: 0.42 }),
    guy("Daniel Gafford", "C", "big", { fg2: 0.72, reb: 7, blk: 1.6, usg: 0.14 }),
    guy("Naji Marshall", "SF", "role"),
    guy("Dereck Lively II", "C", "bn", { reb: 7, blk: 1.4, usg: 0.1 }),
  ]),
  club("HOU", "Houston", "Rockets", "West", "Southwest", "#CE1141", "#000000", 1.05, 1.06, 100, 0.3, 0.135, [
    guy("Alperen Sengün", "C", "sb", { usg: 0.26, ast: 5.2, reb: 10.5, fg2: 0.58, three: 0.14 }),
    guy("Jalen Green", "SG", "sg", { usg: 0.28, three: 0.4 }),
    guy("Amen Thompson", "SF", "sec", { fg2: 0.58, three: 0.14, fg3: 0.28, ast: 4.5, reb: 7, stl: 1.4 }),
    guy("Jabari Smith Jr.", "PF", "st", { three: 0.42, reb: 7 }),
    guy("Fred VanVleet", "PG", "st", { ast: 6, three: 0.48, usg: 0.16 }),
    guy("Cam Whitmore", "SF", "role", { usg: 0.2, fg2: 0.52 }),
    guy("Tari Eason", "SF", "role", { stl: 1.5, reb: 5.5 }),
    guy("Reed Sheppard", "PG", "bn", { three: 0.5, ast: 3.5 }),
  ]),
  club("SAS", "San Antonio", "Spurs", "West", "Southwest", "#C4CED4", "#000000", 1.03, 1.03, 100, 0.26, 0.135, [
    guy("Victor Wembanyama", "C", "sb", { usg: 0.31, three: 0.36, fg3: 0.35, reb: 11, blk: 3.6, ast: 3.8, stl: 1.1 }),
    guy("De'Aaron Fox", "PG", "sg", { usg: 0.28, ast: 6.5, fg2: 0.52, three: 0.32, stl: 1.4 }),
    guy("Stephon Castle", "SG", "sec", { ast: 4.5, usg: 0.2 }),
    guy("Devin Vassell", "SF", "st", { three: 0.46 }),
    guy("Jeremy Sochan", "PF", "st", { reb: 6.5, three: 0.22 }),
    guy("Harrison Barnes", "PF", "role"),
    guy("Keldon Johnson", "SF", "role", { usg: 0.18 }),
    guy("Chris Paul", "PG", "bn", { ast: 7, usg: 0.14, min: 20 }),
  ]),
  club("MEM", "Memphis", "Grizzlies", "West", "Southwest", "#5D76A9", "#12173F", 1.03, 1.02, 101, 0.27, 0.14, [
    guy("Ja Morant", "PG", "sg", { usg: 0.31, ast: 8, fg2: 0.52, three: 0.28, ftr: 0.32, stl: 1.2 }),
    guy("Jaren Jackson Jr.", "PF", "sb", { blk: 1.8, three: 0.36, fg3: 0.35, reb: 6.5, usg: 0.25 }),
    guy("Desmond Bane", "SG", "sec"),
    guy("Zach Edey", "C", "big", { reb: 9, fg2: 0.64, usg: 0.16 }),
    guy("Jaylen Wells", "SF", "st", { three: 0.46 }),
    guy("Santi Aldama", "PF", "role", { three: 0.42 }),
    guy("Vince Williams Jr.", "SG", "bn", { stl: 1.3 }),
    guy("Scotty Pippen Jr.", "PG", "bn", { ast: 4 }),
  ]),
  club("NOP", "New Orleans", "Pelicans", "West", "Southwest", "#0C2340", "#C8102E", 0.99, 0.97, 99, 0.25, 0.14, [
    guy("Zion Williamson", "PF", "sw", { usg: 0.3, fg2: 0.6, three: 0.1, fg3: 0.32, ftr: 0.42, ft: 0.7, reb: 7, ast: 4.8 }),
    guy("Trey Murphy III", "SF", "sec", { three: 0.52, fg3: 0.39 }),
    guy("Dejounte Murray", "PG", "sec", { ast: 6, stl: 1.4 }),
    guy("Herb Jones", "SF", "st", { stl: 1.6, three: 0.4, usg: 0.14 }),
    guy("Yves Missi", "C", "big", { reb: 8, blk: 1.3, usg: 0.13 }),
    guy("Jordan Hawkins", "SG", "role", { three: 0.52 }),
    guy("Jose Alvarado", "PG", "bn", { stl: 1.5, ast: 3.5 }),
    guy("Brandon Boston", "SG", "bn"),
  ]),
];

function assertNba() {
  if (NBA_TEAMS.length !== 30) throw new Error(`NBA teams ${NBA_TEAMS.length}`);
  const ids = new Set<string>();
  for (const t of NBA_TEAMS) {
    if (ids.has(t.id)) throw new Error(`dup ${t.id}`);
    ids.add(t.id);
    if (t.players.length < 8) throw new Error(`${t.abbr} roster`);
  }
}
assertNba();

export const NBA_BY_ID: Record<string, NbaTeam> = Object.fromEntries(NBA_TEAMS.map((t) => [t.id, t]));

export const NBA_DIVS: Record<NbaConf, NbaDiv[]> = {
  East: ["Atlantic", "Central", "Southeast"],
  West: ["Northwest", "Pacific", "Southwest"],
};

export const NBA_MARQUEE: [string, string][] = [
  ["BOS", "NYK"],
  ["OKC", "DEN"],
  ["LAL", "GSW"],
  ["DAL", "MIN"],
  ["MIL", "PHI"],
  ["NYK", "BOS"],
];
