import { NBA_BY_ID, type NbaPlayer, type NbaTeam } from "@/data/nba";
import { NFL_BY_ID, type NflPlayer, type NflTeam } from "@/data/nfl";
import { clamp } from "@/lib/sim/random";
import type { League, NbaPos, NflPos } from "@/lib/sim/types";
import type { LiveLineup, LiveRosterPlayer, LiveSlate, LiveSpot, SlateChip } from "@/lib/live/types";
import { NFL_VENUE } from "@/lib/live/venues";

type Ath = {
  id: string;
  displayName: string;
  injuries?: { status?: string; type?: { abbreviation?: string } }[];
};

type Depth = {
  name?: string;
  positions?: Record<string, { athletes?: Ath[] }>;
};

type Cat = { name?: string; stats?: { name?: string; value?: number; displayValue?: string }[] };

type Chosen = {
  athlete: Ath;
  pos: NflPos | NbaPos;
  slot: number;
  tag: string;
  note: string;
  role: "starter" | "rotation";
};

const LINE_MS = 20_000;
const STAT_MS = 8 * 60_000;
const SLATE_MS = 2 * 60_000;

const lineupCache = new Map<string, { at: number; value: LiveLineup }>();
const statCache = new Map<string, { at: number; row: Record<string, Record<string, number>> }>();
const slateCache = new Map<string, { at: number; value: LiveSlate }>();
let nflIds: Map<string, string> | null = null;
let nbaIds: Map<string, string> | null = null;
let nbaForm: { at: number; map: Map<string, { for: number; against: number; games: number }> } | null = null;

const NFL_BASE: Record<NflPos, { rush: number; tgt: number; ypc: number; ypr: number; comp: number; ypa: number; int: number; fg: number }> = {
  QB: { rush: 10, tgt: 0, ypc: 4.8, ypr: 8, comp: 0.645, ypa: 7.15, int: 0.021, fg: 0.84 },
  RB: { rush: 40, tgt: 7, ypc: 4.5, ypr: 7.6, comp: 0.64, ypa: 7.1, int: 0.02, fg: 0.84 },
  WR: { rush: 1, tgt: 22, ypc: 6, ypr: 12, comp: 0.64, ypa: 7.1, int: 0.02, fg: 0.84 },
  TE: { rush: 0, tgt: 16, ypc: 4, ypr: 10.4, comp: 0.64, ypa: 7.1, int: 0.02, fg: 0.84 },
  K: { rush: 0, tgt: 0, ypc: 4, ypr: 8, comp: 0.64, ypa: 7.1, int: 0.02, fg: 0.85 },
};

const NBA_BASE: Record<NbaPos, Omit<NbaPlayer, "name" | "pos">> = {
  PG: { min: 32, usg: 0.22, fg2: 0.48, fg3: 0.37, three: 0.4, ft: 0.82, ftr: 0.22, reb: 3.8, ast: 5.4, stl: 1.05, blk: 0.3, tov: 2.1 },
  SG: { min: 32, usg: 0.21, fg2: 0.49, fg3: 0.37, three: 0.44, ft: 0.82, ftr: 0.2, reb: 4.2, ast: 3.2, stl: 0.95, blk: 0.35, tov: 1.6 },
  SF: { min: 32, usg: 0.2, fg2: 0.51, fg3: 0.36, three: 0.36, ft: 0.8, ftr: 0.24, reb: 5.6, ast: 3, stl: 0.9, blk: 0.5, tov: 1.6 },
  PF: { min: 30, usg: 0.19, fg2: 0.55, fg3: 0.34, three: 0.26, ft: 0.76, ftr: 0.26, reb: 7.4, ast: 2.2, stl: 0.75, blk: 0.85, tov: 1.5 },
  C: { min: 28, usg: 0.18, fg2: 0.62, fg3: 0.31, three: 0.12, ft: 0.72, ftr: 0.3, reb: 9.2, ast: 1.8, stl: 0.6, blk: 1.2, tov: 1.5 },
};

function ourId(league: League, abbr: string | undefined) {
  const code = (abbr ?? "").toUpperCase();
  if (league === "NFL") return code === "WSH" ? "WAS" : code;
  const nba: Record<string, string> = { NY: "NYK", WSH: "WAS", GS: "GSW", NO: "NOP", SA: "SAS", UTAH: "UTA" };
  return nba[code] ?? code;
}

function sits(status: string) {
  return /^(out|doubtful)\b|injured reserve|\bir\b|suspension|suspended|\bpup\b|physically unable|inactive|\bnfi\b|did not report|reserve\/|season-ending/i.test(
    status,
  );
}

function tagOf(status: string) {
  if (/day[- ]to[- ]day|\bdtd\b/i.test(status)) return "DTD";
  if (/questionable/i.test(status)) return "Q";
  if (/probable/i.test(status)) return "P";
  if (sits(status)) return "OUT";
  return "";
}

function num(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string" || raw === "" || raw === "--") return null;
  const v = Number(raw.replace(/,/g, "").replace("%", ""));
  return Number.isFinite(v) ? v : null;
}

const windCache = new Map<string, { at: number; mph: number | null }>();

async function windAt(lat: number, lon: number, whenIso: string): Promise<number | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${whenIso.slice(0, 13)}`;
  const hit = windCache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60_000) return hit.mph;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=wind_speed_10m&wind_speed_unit=mph&forecast_days=7&timezone=UTC`;
    const data = await fetch(url).then((res) => res.json());
    const times = (data?.hourly?.time ?? []) as string[];
    const speeds = (data?.hourly?.wind_speed_10m ?? []) as number[];
    const when = Date.parse(whenIso);
    let best = -1;
    let bestDt = Infinity;
    for (let i = 0; i < times.length; i++) {
      const stamp = Date.parse(times[i].endsWith("Z") ? times[i] : `${times[i]}Z`);
      const dt = Math.abs(stamp - when);
      if (dt < bestDt) {
        bestDt = dt;
        best = i;
      }
    }
    const mph = best >= 0 && bestDt < 6 * 3600_000 ? speeds[best] : null;
    const value = mph != null && Number.isFinite(mph) ? mph : null;
    windCache.set(key, { at: Date.now(), mph: value });
    return value;
  } catch {
    windCache.set(key, { at: Date.now(), mph: null });
    return null;
  }
}

function asPct(value: number | null | undefined) {
  if (value == null) return null;
  return value > 1.5 ? value / 100 : value;
}

function catStat(cats: Cat[] | undefined, cat: string, name: string) {
  const found = cats?.find((c) => c.name === cat)?.stats?.find((s) => s.name === name);
  if (!found) return null;
  if (typeof found.value === "number" && Number.isFinite(found.value)) return found.value;
  return num(found.displayValue);
}

async function espn(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "FullSlate/1.0" },
    });
    if (!res.ok) throw new Error(`Lineup feed ${res.status}`);
    return (await res.json()) as Record<string, any>;
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => run()));
  return out;
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

function whenLabel(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(t);
}

async function teamIds(league: League) {
  const cached = league === "NFL" ? nflIds : nbaIds;
  if (cached) return cached;
  const sport = league === "NFL" ? "football/nfl" : "basketball/nba";
  const data = await espn(`https://site.api.espn.com/apis/site/v2/sports/${sport}/teams?limit=50`);
  const rows = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
  const map = new Map<string, string>();
  for (const row of rows) {
    const team = row.team ?? row;
    const id = ourId(league, team.abbreviation);
    if (id && team.id) map.set(id, String(team.id));
  }
  if (league === "NFL") nflIds = map;
  else nbaIds = map;
  return map;
}

type EventHit = {
  id: string;
  awayId: string;
  homeId: string;
  awayEspn: string;
  homeEspn: string;
  when: string;
  state: string;
  awayAbbr: string;
  homeAbbr: string;
  spread: number | null;
  total: number | null;
  book: string | null;
};

function readEvents(league: League, events: any[]): EventHit[] {
  const out: EventHit[] = [];
  for (const event of events ?? []) {
    const comp = event?.competitions?.[0];
    const sides = comp?.competitors ?? [];
    const away = sides.find((s: any) => s.homeAway === "away");
    const home = sides.find((s: any) => s.homeAway === "home");
    if (!away?.team || !home?.team) continue;
    const awayId = ourId(league, away.team.abbreviation);
    const homeId = ourId(league, home.team.abbreviation);
    if (!awayId || !homeId) continue;
    const odds = comp?.odds?.[0];
    const spread = typeof odds?.spread === "number" ? odds.spread : num(odds?.spread);
    const total = typeof odds?.overUnder === "number" ? odds.overUnder : num(odds?.overUnder);
    out.push({
      id: String(event.id),
      awayId,
      homeId,
      awayEspn: String(away.team.id),
      homeEspn: String(home.team.id),
      when: String(event.date ?? ""),
      state: String(event.status?.type?.state ?? ""),
      awayAbbr: awayId,
      homeAbbr: homeId,
      spread,
      total,
      book: String(odds?.provider?.displayName ?? odds?.provider?.name ?? "the market"),
    });
  }
  return out;
}

async function board(league: League) {
  if (league === "NFL") {
    const data = await espn("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const year = Number(data.season?.year ?? data.leagues?.[0]?.season?.year ?? 2026);
    const week = data.week?.number;
    return {
      year,
      title: week ? `Week ${week}` : "This week",
      events: readEvents(league, data.events ?? []),
    };
  }
  const dates = [ymd(0), ymd(1)];
  const pages = await Promise.all(
    dates.map((d) => espn(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}`)),
  );
  const year = Number(pages[0]?.season?.year ?? pages[0]?.leagues?.[0]?.season?.year ?? 2027);
  const events = pages.flatMap((p) => readEvents(league, p.events ?? []));
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  return { year, title: "Today", events: unique };
}

export async function listSlate(league: League): Promise<LiveSlate> {
  const hit = slateCache.get(league);
  if (hit && Date.now() - hit.at < SLATE_MS) return hit.value;
  const data = await board(league);
  const rank: Record<string, number> = { in: 0, pre: 1, post: 2 };
  const games: SlateChip[] = data.events
    .filter((e) => e.state === "pre" || e.state === "in")
    .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || a.when.localeCompare(b.when))
    .slice(0, 16)
    .map((e) => ({ awayId: e.awayId, homeId: e.homeId, state: e.state }));
  const value = { title: data.title, games };
  slateCache.set(league, { at: Date.now(), value });
  return value;
}

function withReport(a: Ath, report: Map<string, string>): Ath {
  const status = report.get(String(a.id));
  if (!status) return a;
  return { ...a, injuries: [{ status, type: { abbreviation: tagOf(status) } }] };
}

function rankAthletes(lists: (Ath[] | undefined)[], report: Map<string, string>) {
  const columns = lists.map((list) => (list ?? []).map((a) => withReport(a, report)));
  const out: Ath[] = [];
  const seen = new Set<string>();
  const max = Math.max(0, ...columns.map((col) => col.length));
  for (let depth = 0; depth < max; depth++) {
    for (const col of columns) {
      const athlete = col[depth];
      if (!athlete || seen.has(athlete.id)) continue;
      seen.add(athlete.id);
      out.push(athlete);
    }
  }
  return out;
}

function takePos(
  athletes: Ath[],
  pos: NflPos | NbaPos,
  limit: number,
  starters: number,
  used: Set<string>,
): Chosen[] {
  const chosen: Chosen[] = [];
  let sat: string | null = null;
  let slot = 0;
  for (const athlete of athletes) {
    if (used.has(athlete.id)) continue;
    const status = athlete.injuries?.[0]?.status ?? "";
    if (sits(status)) {
      sat = sat ?? `${athlete.displayName} (${status})`;
      continue;
    }
    used.add(athlete.id);
    chosen.push({
      athlete,
      pos,
      slot,
      tag: tagOf(status),
      note: slot === 0 && sat ? `in for ${sat}` : "",
      role: slot < starters ? "starter" : "rotation",
    });
    slot += 1;
    if (slot >= limit) break;
  }
  return chosen;
}

function chooseNfl(charts: Depth[], report: Map<string, string>): Chosen[] {
  const withQb = charts.filter((c) => c.positions?.qb?.athletes?.length);
  const off = withQb.find((c) => /wr|off|personnel|11|12/i.test(c.name ?? "")) ?? withQb[0];
  const kicking = charts.find((c) => c.positions?.pk?.athletes?.length);
  if (!off?.positions) return [];
  const P = off.positions;
  const used = new Set<string>();
  const chosen: Chosen[] = [];
  const add = (list: Ath[] | undefined, pos: NflPos, limit: number, starters: number) => {
    chosen.push(...takePos(rankAthletes([list], report), pos, limit, starters, used));
  };
  add(P.qb?.athletes, "QB", 1, 1);
  add(P.rb?.athletes, "RB", 3, 1);
  const wrKeys = Object.keys(P)
    .filter((k) => /^wr\d?$/i.test(k))
    .sort();
  const wrLists = (wrKeys.length ? wrKeys : ["wr"]).map((k) => P[k]?.athletes);
  const starterWr = wrKeys.length <= 1 ? 3 : Math.min(3, wrKeys.length);
  chosen.push(...takePos(rankAthletes(wrLists, report), "WR", 4, starterWr, used));
  add(P.te?.athletes, "TE", 2, 1);
  chosen.push(...takePos(rankAthletes([kicking?.positions?.pk?.athletes], report), "K", 1, 1, used));
  return chosen;
}

function chooseNba(charts: Depth[], report: Map<string, string>): Chosen[] {
  const chart = charts.find((c) => c.positions?.pg || c.positions?.c) ?? charts[0];
  const P = chart?.positions ?? {};
  const order: [string, NbaPos][] = [
    ["pg", "PG"],
    ["sg", "SG"],
    ["sf", "SF"],
    ["pf", "PF"],
    ["c", "C"],
  ];
  const used = new Set<string>();
  const chosen: Chosen[] = [];
  for (const [key, pos] of order) {
    chosen.push(...takePos(rankAthletes([P[key]?.athletes], report), pos, 1, 1, used));
  }
  const columns = order.map(([key, pos]) => ({
    pos,
    athletes: rankAthletes([P[key]?.athletes], report),
  }));
  const max = Math.max(0, ...columns.map((col) => col.athletes.length));
  let backups = 0;
  for (let depth = 1; depth < max && backups < 4; depth++) {
    for (const col of columns) {
      if (backups >= 4) break;
      const athlete = col.athletes[depth];
      if (!athlete || used.has(athlete.id)) continue;
      const status = athlete.injuries?.[0]?.status ?? "";
      if (sits(status)) continue;
      used.add(athlete.id);
      chosen.push({
        athlete,
        pos: col.pos,
        slot: backups,
        tag: tagOf(status),
        note: "",
        role: "rotation",
      });
      backups += 1;
    }
  }
  return chosen;
}

async function athleteStats(sport: "football/nfl" | "basketball/nba", id: string, year: number) {
  const key = `${sport}:${id}:${year}`;
  const hit = statCache.get(key);
  if (hit && Date.now() - hit.at < STAT_MS) return hit.row;
  try {
    const data = await espn(
      `https://site.web.api.espn.com/apis/common/v3/sports/${sport}/athletes/${id}/stats?region=us&lang=en`,
    );
    const row: Record<string, Record<string, number>> = {};
    for (const cat of data.categories ?? []) {
      const season = (cat.statistics ?? []).find((s: any) => Number(s.season?.year) === year);
      if (!season || !Array.isArray(cat.names)) continue;
      const bag: Record<string, number> = {};
      cat.names.forEach((name: string, i: number) => {
        const text = season.stats?.[i] == null ? "" : String(season.stats[i]);
        if (name.includes("-")) {
          const [left, right] = name.split("-");
          const [a, b] = text.split("-");
          const va = num(a);
          const vb = num(b);
          if (left && va != null) bag[left] = va;
          if (right && vb != null) bag[right] = vb;
        }
        const v = num(text);
        if (v != null) bag[name] = v;
      });
      if (cat.name) row[cat.name] = bag;
    }
    statCache.set(key, { at: Date.now(), row });
    return row;
  } catch {
    return {};
  }
}

function nflPlayer(chosen: Chosen, stats: Record<string, Record<string, number>>, rich: boolean): NflPlayer {
  const base = NFL_BASE[chosen.pos as NflPos];
  const pass = stats.passing ?? {};
  const rush = stats.rushing ?? {};
  const rec = stats.receiving ?? {};
  const kick = stats.kicking ?? {};
  const attempts = pass.passingAttempts ?? 0;
  const carries = rush.rushingAttempts ?? 0;
  const targets = rec.receivingTargets ?? rec.receptions ?? 0;
  const has = attempts >= 8 || carries >= 4 || targets >= 4 || (kick.fieldGoalAttempts ?? 0) >= 1;
  let comp = asPct(pass.completionPct);
  if ((comp == null || attempts < 15) && attempts >= 15 && pass.completions != null) comp = pass.completions / attempts;
  let intRate = attempts >= 20 && pass.interceptions != null ? pass.interceptions / attempts : null;
  const fgPct = asPct(kick.fieldGoalPct) ?? (kick.fieldGoalAttempts >= 3 ? kick.fieldGoalsMade / kick.fieldGoalAttempts : null);
  const ypc = rush.yardsPerRushAttempt;
  const ypr = rec.yardsPerReception;
  const ypa = pass.yardsPerPassAttempt;
  const starter = chosen.role === "starter";
  const thin = !has;
  const prior = !rich ? (starter ? 1 : 0.6) : starter && thin ? 1.55 : starter ? 1 : 0.55;
  const rushTd = rush.rushingTouchdowns ?? 0;
  const recTd = rec.receivingTouchdowns ?? 0;
  return {
    name: chosen.athlete.displayName,
    pos: chosen.pos as NflPos,
    rush: carries >= 8 ? carries * (1 + rushTd * 0.1) : base.rush * prior,
    tgt: chosen.pos === "QB" ? 0 : targets >= 6 ? targets * (1 + recTd * 0.08) : base.tgt * prior,
    ypc: clamp(ypc && carries >= 8 ? ypc : base.ypc, 3.1, 6.8),
    ypr: clamp(ypr && targets >= 6 ? ypr : base.ypr, 6, 18),
    comp: clamp(comp != null && attempts >= 15 ? comp : base.comp, 0.54, 0.75),
    ypa: clamp(ypa != null && attempts >= 15 ? ypa : base.ypa, 5.5, 9.5),
    int: clamp(intRate ?? base.int, 0.008, 0.05),
    fg: clamp(fgPct ?? base.fg, 0.68, 0.96),
  };
}

function nbaPlayer(chosen: Chosen, stats: Record<string, Record<string, number>>): NbaPlayer {
  const pos = chosen.pos as NbaPos;
  const base = NBA_BASE[pos];
  const avg = stats.averages ?? {};
  const gen = stats.general ?? {};
  const off = stats.offensive ?? {};
  const def = stats.defensive ?? {};
  const fga = avg.avgFieldGoalsAttempted ?? off.avgFieldGoalsAttempted;
  const fgm = avg.avgFieldGoalsMade ?? off.avgFieldGoalsMade;
  const tpa = avg.avgThreePointFieldGoalsAttempted ?? off.avgThreePointFieldGoalsAttempted;
  const tpm = avg.avgThreePointFieldGoalsMade ?? off.avgThreePointFieldGoalsMade;
  const fta = avg.avgFreeThrowsAttempted ?? off.avgFreeThrowsAttempted;
  const enough = (fga ?? 0) >= 4;
  let fg2: number | null = null;
  if (enough && fgm != null && fga != null && tpm != null && tpa != null && fga - tpa > 1) fg2 = (fgm - tpm) / (fga - tpa);
  const fg3 = tpa != null && tpa >= 2 ? asPct(avg.threePointFieldGoalPct ?? off.threePointFieldGoalPct ?? null) : null;
  const ft = fta != null && fta >= 1.5 ? asPct(avg.freeThrowPct ?? off.freeThrowPct ?? null) : null;
  const starter = chosen.role === "starter";
  const minutes = avg.avgMinutes ?? gen.avgMinutes;
  return {
    name: chosen.athlete.displayName,
    pos,
    min: clamp(minutes && minutes > 6 ? minutes : starter ? 33 - chosen.slot : 16, 10, 38),
    usg: clamp(minutes && minutes > 6 && fga != null ? fga / minutes : starter ? base.usg : 0.14, 0.08, 0.8),
    fg2: clamp(fg2 ?? base.fg2, 0.4, 0.74),
    fg3: clamp(fg3 ?? base.fg3, 0.26, 0.46),
    three: clamp(enough && fga && tpa != null ? tpa / fga : base.three, 0.02, 0.72),
    ft: clamp(ft ?? base.ft, 0.55, 0.95),
    ftr: clamp(enough && fga && fta != null ? fta / fga : base.ftr, 0.04, 0.6),
    reb: clamp(avg.avgRebounds ?? gen.avgRebounds ?? base.reb, 0.4, 16),
    ast: clamp(avg.avgAssists ?? off.avgAssists ?? base.ast, 0.2, 12),
    stl: clamp(avg.avgSteals ?? def.avgSteals ?? base.stl, 0.05, 3),
    blk: clamp(avg.avgBlocks ?? def.avgBlocks ?? base.blk, 0, 4),
    tov: clamp(avg.avgTurnovers ?? off.avgTurnovers ?? base.tov, 0.2, 5),
  };
}

function spotsOf(chosen: Chosen[]): LiveSpot[] {
  return chosen.map((c) => ({
    name: c.athlete.displayName,
    pos: c.pos,
    tag: c.tag,
    note: c.note,
    role: c.role,
  }));
}

type RawRoster = {
  id: string;
  name: string;
  pos: string;
  status: string;
  group: string;
};

function readStatus(player: any, group: string) {
  const inj = player?.injuries?.[0]?.status;
  if (typeof inj === "string" && inj.trim()) return inj.trim();
  if (group === "injuredReserveOrOut") return "Injured Reserve";
  if (group === "suspended") return "Suspended";
  const st = player?.status;
  if (typeof st === "string" && st && !/active/i.test(st)) return st;
  if (st && typeof st === "object") {
    const label = String(st.description || st.name || "");
    if (label && !/active/i.test(label)) return label;
  }
  return "";
}

async function loadRoster(sport: string, espnId: string): Promise<RawRoster[]> {
  const data = await espn(`https://site.api.espn.com/apis/site/v2/sports/${sport}/teams/${espnId}/roster`);
  const athletes = (data.athletes ?? []) as any[];
  const rows: RawRoster[] = [];
  if (athletes[0]?.items) {
    for (const group of athletes) {
      const name = String(group.position || "");
      for (const player of group.items ?? []) {
        rows.push({
          id: String(player.id),
          name: String(player.displayName || player.fullName || "Unknown"),
          pos: String(player.position?.abbreviation || ""),
          status: readStatus(player, name),
          group: name,
        });
      }
    }
  } else {
    for (const player of athletes) {
      rows.push({
        id: String(player.id),
        name: String(player.displayName || player.fullName || "Unknown"),
        pos: String(player.position?.abbreviation || ""),
        status: readStatus(player, ""),
        group: "active",
      });
    }
  }
  const map = new Map<string, RawRoster>();
  for (const row of rows) {
    const prev = map.get(row.id);
    if (!prev) map.set(row.id, row);
    else if (sits(row.status) && !sits(prev.status)) map.set(row.id, row);
    else if (row.status && !prev.status) map.set(row.id, row);
  }
  return [...map.values()];
}

function clipCharts(charts: Depth[], allowed: Set<string>): Depth[] {
  return charts.map((chart) => {
    const positions: NonNullable<Depth["positions"]> = {};
    for (const [key, slot] of Object.entries(chart.positions ?? {})) {
      positions[key] = { athletes: (slot?.athletes ?? []).filter((a) => allowed.has(String(a.id))) };
    }
    return { ...chart, positions };
  });
}

function rosterBoard(rows: RawRoster[], lineup: Chosen[], league: League): LiveRosterPlayer[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const used = new Set<string>();
  const skill = league === "NFL" ? new Set(["QB", "RB", "FB", "WR", "TE", "K", "PK"]) : null;
  const order = league === "NFL" ? ["QB", "RB", "FB", "WR", "TE", "K", "PK"] : ["PG", "SG", "SF", "PF", "C", "G", "F"];
  const rank = (pos: string) => {
    const i = order.indexOf(pos);
    return i === -1 ? 40 : i;
  };
  const top: LiveRosterPlayer[] = lineup.map((c) => {
    used.add(String(c.athlete.id));
    const row = byId.get(String(c.athlete.id));
    const status = row?.status ?? "";
    return {
      name: c.athlete.displayName,
      pos: c.pos,
      tag: c.tag || tagOf(status),
      note: c.note || (sits(status) ? status : ""),
      inLineup: true,
      lineup: c.role === "starter" ? "START" : "ROT",
    };
  });
  const rest = rows
    .filter((row) => row.group !== "practiceSquad" && !used.has(row.id) && (!skill || skill.has(row.pos)))
    .map((row) => ({
      name: row.name,
      pos: row.pos === "PK" ? "K" : row.pos === "FB" ? "RB" : row.pos,
      tag: tagOf(row.status),
      note: sits(row.status) ? row.status : "",
      inLineup: false,
      lineup: "" as const,
    }))
    .sort((a, b) => {
      const ao = a.tag === "OUT" ? 1 : 0;
      const bo = b.tag === "OUT" ? 1 : 0;
      if (ao !== bo) return ao - bo;
      const ap = rank(a.pos);
      const bp = rank(b.pos);
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  return [...top, ...rest];
}

async function depthCharts(sport: string, espnId: string): Promise<Depth[]> {
  const data = await espn(`https://site.api.espn.com/apis/site/v2/sports/${sport}/teams/${espnId}/depthcharts`);
  return (data.depthchart ?? []) as Depth[];
}

async function injuryMaps(sport: string, eventId: string) {
  const data = await espn(`https://site.api.espn.com/apis/site/v2/sports/${sport}/summary?event=${eventId}`);
  const byTeam = new Map<string, Map<string, string>>();
  for (const block of data.injuries ?? []) {
    const tid = String(block?.team?.id ?? "");
    const map = new Map<string, string>();
    for (const item of block?.injuries ?? []) {
      const id = String(item?.athlete?.id ?? "");
      const status = String(item?.status ?? "");
      if (id && status) map.set(id, status);
    }
    if (tid) byTeam.set(tid, map);
  }
  return byTeam;
}

function mix(prior: number, live: number | null, weight: number, lo: number, hi: number) {
  if (live == null || !Number.isFinite(live)) return prior;
  return clamp(prior * (1 - weight) + live * weight, lo, hi);
}

async function tuneNfl(base: NflTeam, espnId: string, players: NflPlayer[]): Promise<NflTeam> {
  try {
    const data = await espn(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${espnId}/statistics`);
    const own = (data.results?.stats?.categories ?? []) as Cat[];
    const opp = (Array.isArray(data.results?.opponent) ? data.results.opponent : []) as Cat[];
    const passYpg = catStat(own, "passing", "netPassingYardsPerGame") ?? catStat(own, "passing", "passingYardsPerGame");
    const rushYpg = catStat(own, "rushing", "rushingYardsPerGame");
    const oppPass = catStat(opp, "passing", "netPassingYardsPerGame") ?? catStat(opp, "passing", "passingYardsPerGame");
    const oppRush = catStat(opp, "rushing", "rushingYardsPerGame");
    const passYds = catStat(own, "passing", "netPassingYards") ?? catStat(own, "passing", "passingYards");
    const rushYds = catStat(own, "rushing", "rushingYards");
    const points = catStat(own, "scoring", "totalPoints");
    const ppg = catStat(own, "scoring", "totalPointsPerGame");
    const games = catStat(own, "general", "gamesPlayed") ?? (ppg && points ? Math.max(1, Math.round(points / ppg)) : null);
    const liveW = clamp(0.22 + ((games ?? 8) / 17) * 0.58, 0.22, 0.82);
    const rateW = clamp(0.5 + ((games ?? 8) / 17) * 0.35, 0.5, 0.85);
    const give =
      games && games > 0
        ? ((catStat(own, "passing", "interceptions") ?? 0) + (catStat(own, "miscellaneous", "fumblesLost") ?? 0)) / games
        : null;
    const picks = catStat(own, "defensiveInterceptions", "interceptions");
    const take = games && picks != null ? picks / games : null;
    const rzRaw = catStat(own, "miscellaneous", "redzoneTouchdownPct");
    const rz = rzRaw == null ? null : rzRaw > 2 ? rzRaw / 56 : rzRaw / 0.56;
    const rate = passYds != null && rushYds != null && passYds + rushYds > 0 ? passYds / (passYds + rushYds) : null;
    return {
      ...base,
      passOff: mix(base.passOff, passYpg != null ? passYpg / 210 : null, liveW, 0.86, 1.18),
      rushOff: mix(base.rushOff, rushYpg != null ? rushYpg / 115 : null, liveW, 0.86, 1.18),
      passDef: mix(base.passDef, oppPass != null ? 210 / oppPass : null, liveW, 0.86, 1.16),
      rushDef: mix(base.rushDef, oppRush != null ? 115 / oppRush : null, liveW, 0.86, 1.16),
      passRate: mix(base.passRate, rate, rateW, 0.44, 0.68),
      toGive: mix(base.toGive, give != null ? give / 1.15 : null, liveW, 0.78, 1.25),
      toTake: mix(base.toTake, take != null ? take / 0.85 : null, liveW, 0.78, 1.25),
      rz: mix(base.rz, rz, liveW, 0.86, 1.2),
      gamesPlayed: games ?? undefined,
      players,
    };
  } catch {
    return { ...base, players };
  }
}

async function tuneNba(base: NbaTeam, espnId: string, players: NbaPlayer[], form: Map<string, { for: number; against: number; games: number }>) {
  const record = form.get(base.id);
  const games = record?.games ?? 0;
  const liveW = clamp(0.25 + (games / 82) * 0.55, 0.25, 0.8);
  let pace = base.pace;
  let orb = base.orb;
  let tov = base.tov;
  try {
    const data = await espn(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnId}/statistics`);
    const cats = (data.results?.stats?.categories ?? []) as Cat[];
    const fga = catStat(cats, "offensive", "avgFieldGoalsAttempted");
    const fta = catStat(cats, "offensive", "avgFreeThrowsAttempted");
    const to = catStat(cats, "offensive", "avgTurnovers");
    const oreb = catStat(cats, "offensive", "avgOffensiveRebounds");
    if (fga != null && fta != null && to != null) {
      const estimate = fga + 0.44 * fta + to - (oreb ?? 10);
      pace = clamp(estimate, 94, 108);
      if (oreb != null) orb = clamp(oreb / (oreb + 33), 0.18, 0.36);
      tov = clamp(to / Math.max(90, estimate), 0.1, 0.17);
    }
  } catch {
    // keep the prior pace profile
  }
  return {
    ...base,
    off: mix(base.off, record ? record.for / 114.5 : null, liveW, 0.88, 1.16),
    def: mix(base.def, record ? 114.5 / record.against : null, liveW, 0.88, 1.16),
    pace,
    orb,
    tov,
    gamesPlayed: games || undefined,
    players,
  };
}

async function nbaStandings() {
  if (nbaForm && Date.now() - nbaForm.at < 10 * 60_000) return nbaForm.map;
  const data = await espn("https://site.api.espn.com/apis/v2/sports/basketball/nba/standings");
  const map = new Map<string, { for: number; against: number; games: number }>();
  for (const child of data.children ?? []) {
    for (const entry of child?.standings?.entries ?? []) {
      const id = ourId("NBA", entry?.team?.abbreviation);
      const stats = entry?.stats ?? [];
      const pf = stats.find((s: any) => s.name === "avgPointsFor");
      const pa = stats.find((s: any) => s.name === "avgPointsAgainst");
      const gp = stats.find((s: any) => s.name === "gamesPlayed");
      const scored = typeof pf?.value === "number" ? pf.value : num(pf?.displayValue);
      const allowed = typeof pa?.value === "number" ? pa.value : num(pa?.displayValue);
      const games = typeof gp?.value === "number" ? gp.value : num(gp?.displayValue) ?? 0;
      if (id && scored != null && allowed != null && allowed > 0) map.set(id, { for: scored, against: allowed, games });
    }
  }
  nbaForm = { at: Date.now(), map };
  return map;
}

async function buildSide(league: League, our: string, espnId: string, report: Map<string, string>, year: number, form: Map<string, { for: number; against: number; games: number }>) {
  const sport = league === "NFL" ? "football/nfl" : "basketball/nba";
  const [chartsRaw, roster] = await Promise.all([depthCharts(sport, espnId), loadRoster(sport, espnId)]);
  const allowed = new Set(roster.filter((row) => row.group !== "practiceSquad").map((row) => row.id));
  const merged = new Map<string, string>();
  for (const row of roster) if (row.status) merged.set(row.id, row.status);
  for (const [id, status] of report) if (status) merged.set(id, status);
  const clipped = allowed.size > 0 ? clipCharts(chartsRaw, allowed) : chartsRaw;
  let chosen = league === "NFL" ? chooseNfl(clipped, merged) : chooseNba(clipped, merged);
  if (chosen.length < 5 || (league === "NFL" && !chosen.some((c) => c.pos === "QB"))) {
    chosen = league === "NFL" ? chooseNfl(chartsRaw, merged) : chooseNba(chartsRaw, merged);
  }
  const names = new Map(roster.map((row) => [row.id, row.name]));
  for (const player of chosen) {
    const name = names.get(String(player.athlete.id));
    if (name) player.athlete = { ...player.athlete, displayName: name };
  }
  if (league === "NFL" && !chosen.some((c) => c.pos === "K")) {
    const kicker = roster.find((row) => (row.pos === "K" || row.pos === "PK") && row.group !== "practiceSquad" && !sits(row.status));
    chosen.push({
      athlete: { id: kicker?.id ?? `k-${our}`, displayName: kicker?.name ?? `${our} K` },
      pos: "K",
      slot: 0,
      tag: tagOf(kicker?.status ?? ""),
      note: "",
      role: "starter",
    });
  }
  if (chosen.length < 5 || (league === "NFL" && !chosen.some((c) => c.pos === "QB"))) {
    throw new Error(`Roster for ${our} was incomplete`);
  }
  const board = rosterBoard(roster, chosen, league);
  const stats = await pool(chosen, 6, (c) => athleteStats(sport, c.athlete.id, year));
  if (league === "NFL") {
    const rich = stats.some((row) => {
      const p = row.passing ?? {};
      const r = row.rushing ?? {};
      const c = row.receiving ?? {};
      return (p.passingAttempts ?? 0) >= 8 || (r.rushingAttempts ?? 0) >= 4 || (c.receivingTargets ?? 0) >= 4;
    });
    const players = chosen.map((c, i) => nflPlayer(c, stats[i] ?? {}, !rich));
    chosen.forEach((c, i) => {
      const player = players[i];
      if (c.role !== "starter") return;
      if (player.pos === "QB" && player.rush < 3) player.rush = 3;
      if (player.pos === "RB" && player.rush < 16) player.rush = 16;
      if (player.pos === "WR" && player.tgt < 7) player.tgt = 7;
      if (player.pos === "TE" && player.tgt < 5) player.tgt = 5;
    });
    if (!players.some((p) => p.pos === "QB")) throw new Error(`${our} has no quarterback on the roster`);
    if (!players.some((p) => p.pos !== "QB" && p.pos !== "K" && p.tgt > 0)) {
      const wr = players.find((p) => p.pos === "WR" || p.pos === "TE" || p.pos === "RB");
      if (wr) wr.tgt = 20;
    }
    const team = await tuneNfl(NFL_BY_ID[our], espnId, players);
    return { team, spots: spotsOf(chosen), roster: board };
  }
  const players = chosen.map((c, i) => nbaPlayer(c, stats[i] ?? {}));
  const team = await tuneNba(NBA_BY_ID[our], espnId, players, form);
  return { team, spots: spotsOf(chosen), roster: board };
}

export async function pullMatchup(input: { league: League; awayId: string; homeId: string; force?: boolean }): Promise<LiveLineup> {
  const { league, awayId, homeId, force } = input;
  const key = `${league}:${awayId}:${homeId}`;
  const cached = lineupCache.get(key);
  if (!force && cached && Date.now() - cached.at < LINE_MS) return cached.value;
  if (!NFL_BY_ID[awayId] && league === "NFL") throw new Error("Unknown NFL team");
  if (!NBA_BY_ID[awayId] && league === "NBA") throw new Error("Unknown NBA team");
  if (league === "NFL" && (!NFL_BY_ID[awayId] || !NFL_BY_ID[homeId])) throw new Error("Unknown NFL team");
  if (league === "NBA" && (!NBA_BY_ID[awayId] || !NBA_BY_ID[homeId])) throw new Error("Unknown NBA team");

  const [ids, slate] = await Promise.all([teamIds(league), board(league)]);
  const awayEspn = ids.get(awayId);
  const homeEspn = ids.get(homeId);
  if (!awayEspn || !homeEspn) throw new Error("Could not match those teams to the live feed");
  const event = slate.events.find(
    (e) => (e.awayId === awayId && e.homeId === homeId) || (e.awayId === homeId && e.homeId === awayId),
  );
  let reports = new Map<string, Map<string, string>>();
  if (event && (event.state === "pre" || event.state === "in")) {
    const sport = league === "NFL" ? "football/nfl" : "basketball/nba";
    try {
      reports = await injuryMaps(sport, event.id);
    } catch {
      reports = new Map();
    }
  }
  const form = league === "NBA" ? await nbaStandings() : new Map<string, { for: number; against: number; games: number }>();
  const [awaySide, homeSide] = await Promise.all([
    buildSide(league, awayId, awayEspn, reports.get(awayEspn) ?? new Map(), slate.year, form),
    buildSide(league, homeId, homeEspn, reports.get(homeEspn) ?? new Map(), slate.year, form),
  ]);
  const flipped = Boolean(event && (event.awayId !== awayId || event.homeId !== homeId));
  const season = league === "NFL" ? `${slate.year}` : `${slate.year - 1}-${String(slate.year).slice(2)}`;
  const games = Math.max(awaySide.team.gamesPlayed ?? 0, homeSide.team.gamesPlayed ?? 0);
  const weight = league === "NFL" ? clamp(0.55 - (games / 17) * 0.22, 0.3, 0.55) : clamp(0.48 - (games / 82) * 0.18, 0.28, 0.48);
  const line =
    event && event.spread != null && event.total != null
      ? {
          homeMargin: event.homeId === homeId ? -event.spread : event.spread,
          total: event.total,
          book: event.book || "the market",
          weight,
        }
      : null;
  let wind: number | null = null;
  if (league === "NFL" && event) {
    const venue = NFL_VENUE[event.homeId];
    if (venue?.dome) wind = 0;
    else if (venue) wind = await windAt(venue.lat, venue.lon, event.when);
  }
  if (league === "NFL") {
    const awayNfl = awaySide.team as NflTeam;
    const homeNfl = homeSide.team as NflTeam;
    awayNfl.line = line;
    homeNfl.line = line;
    awayNfl.windMph = wind;
    homeNfl.windMph = wind;
  } else {
    const awayNba = awaySide.team as NbaTeam;
    const homeNba = homeSide.team as NbaTeam;
    awayNba.line = line;
    homeNba.line = line;
  }
  const value: LiveLineup = {
    league,
    awayId,
    homeId,
    pulledAt: Date.now(),
    source: `ESPN active roster · ${season} season`,
    warning: flipped && event ? `The live game is ${event.awayAbbr} at ${event.homeAbbr}. This sim keeps the home team you picked.` : null,
    slate: event
      ? {
          label: `${event.awayAbbr} at ${event.homeAbbr}`,
          whenLabel: whenLabel(event.when),
          state: event.state,
          flipped,
        }
      : null,
    awaySpots: awaySide.spots,
    homeSpots: homeSide.spots,
    awayRoster: awaySide.roster,
    homeRoster: homeSide.roster,
    away: awaySide.team,
    home: homeSide.team,
  };
  lineupCache.set(key, { at: Date.now(), value });
  return value;
}
