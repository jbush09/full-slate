import type { NflTeam } from "@/data/nfl";
import { allocate, binomial, blendScore, clamp, clampInt, fitToTarget, normal, scaleToSum, skewed, weightedIndex, type Rng } from "@/lib/sim/random";
import type { Drive, NflGame, NflPlayerLine, NflProj, NflProjPlayer, NflSide, NflTeamAvg } from "@/lib/sim/types";

type Built = {
  abbr: string;
  result: Drive["result"];
  plays: number;
  yards: number;
  points: number;
  detail: string;
  passYd: number;
  rushYd: number;
  scorer: string | null;
  scoreKind: "pass" | "rush" | null;
  fgMade: boolean;
  fgAtt: boolean;
  turnover: "int" | "fumble" | null;
};

function qbOf(team: NflTeam) {
  const qb = team.players.find((p) => p.pos === "QB");
  if (!qb) throw new Error(`${team.abbr} has no quarterback`);
  return qb;
}

function kickerOf(team: NflTeam) {
  return team.players.find((p) => p.pos === "K") ?? team.players[team.players.length - 1];
}

function edgeOf(off: NflTeam, def: NflTeam, home: boolean) {
  const o = off.passOff * off.passRate + off.rushOff * (1 - off.passRate);
  const d = def.passDef * off.passRate + def.rushDef * (1 - off.passRate);
  return (o / d) * (home ? 1.045 : 0.985);
}

type Script = { lead: number; quarter: number; wind: number };

function buildDrive(off: NflTeam, def: NflTeam, home: boolean, rng: Rng, script: Script = { lead: 0, quarter: 2, wind: off.windMph ?? 0 }): Built {
  const edge = edgeOf(off, def, home);
  let tdP = clamp(0.2 * edge * off.rz, 0.07, 0.4);
  let toP = clamp(0.1 * (off.toGive / def.toTake), 0.035, 0.2);
  let fgaP = clamp(0.16 * (0.85 + 0.15 * edge) * (0.92 + 0.08 * off.st), 0.06, 0.28);
  if (script.quarter >= 3 && script.lead >= 14) {
    tdP *= script.quarter >= 4 ? 0.78 : 0.88;
    fgaP *= 0.9;
  } else if (script.quarter >= 4 && script.lead <= -10) {
    tdP *= 1.06;
    fgaP *= 0.9;
  }
  let sum = tdP + toP + fgaP;
  if (sum > 0.9) {
    const s = 0.9 / sum;
    tdP *= s;
    toP *= s;
    fgaP *= s;
    sum = 0.9;
  }
  const rest = 1 - sum;
  const downsP = rest * 0.16;
  const roll = rng();
  let kind: "TD" | "FGA" | "TO" | "DOWNS" | "PUNT" = "PUNT";
  if (roll < tdP) kind = "TD";
  else if (roll < tdP + fgaP) kind = "FGA";
  else if (roll < tdP + fgaP + toP) kind = "TO";
  else if (roll < tdP + fgaP + toP + downsP) kind = "DOWNS";

  const qb = qbOf(off);
  const kicker = kickerOf(off);
  const skill = off.players.filter((p) => p.pos !== "K");
  let passRate = off.passRate;
  if (script.quarter >= 3 && script.lead >= 14) passRate -= script.quarter >= 4 ? 0.16 : 0.1;
  else if (script.quarter >= 4 && script.lead <= -10) passRate += 0.08;
  if (script.wind >= 15) passRate -= Math.min(0.14, (script.wind - 12) * 0.008);
  passRate = clamp(passRate, 0.34, 0.78);

  let yards = 0;
  let plays = 3;
  let result: Drive["result"] = "PUNT";
  let detail = "Punt";
  let points = 0;
  let scorer: string | null = null;
  let scoreKind: "pass" | "rush" | null = null;
  let fgMade = false;
  let fgAtt = false;
  let turnover: "int" | "fumble" | null = null;

  if (kind === "TD") {
    yards = clampInt(skewed(rng, 62, 18), 8, 99);
    plays = clampInt(normal(rng, 8.2, 2), 1, 15);
    const passBias = clamp(passRate + 0.08, 0.38, 0.82);
    const isPass = rng() < passBias;
    if (isPass) {
      const receivers = skill.filter((p) => p.pos !== "QB" && p.tgt > 0);
      const idx = weightedIndex(
        rng,
        receivers.map((p) => p.tgt * (p.pos === "TE" ? 1.15 : p.pos === "RB" ? 0.75 : 1)),
      );
      scorer = receivers[idx]?.name ?? receivers[0].name;
      scoreKind = "pass";
      detail = `${qb.name} to ${scorer}`;
    } else {
      const rushers = skill.filter((p) => p.rush > 0);
      const idx = weightedIndex(
        rng,
        rushers.map((p) => p.rush * (p.pos === "RB" ? 1.35 : 1)),
      );
      scorer = rushers[idx]?.name ?? qb.name;
      scoreKind = "rush";
      detail = `${scorer} run`;
    }
    const xp = rng() < clamp(0.94 * off.st, 0.8, 0.98);
    points = xp ? 7 : 6;
    detail += xp ? "" : ", extra point missed";
    result = "TD";
  } else if (kind === "FGA") {
    yards = clampInt(normal(rng, 44, 11), 12, 68);
    plays = clampInt(normal(rng, 7.4, 1.7), 3, 14);
    const dist = clampInt(92 - yards, 22, 58);
    let make = kicker.fg;
    if (dist >= 50) make -= (dist - 50) * 0.035;
    else if (dist <= 35) make += 0.06;
    if (script.wind >= 15 && dist >= 40) make -= Math.min(0.16, (script.wind - 12) * 0.007);
    make = clamp(make * (0.92 + 0.08 * off.st), 0.28, 0.97);
    fgAtt = true;
    fgMade = rng() < make;
    points = fgMade ? 3 : 0;
    result = fgMade ? "FG" : "MISS";
    detail = fgMade ? `${kicker.name} from ${dist}` : `${kicker.name} missed from ${dist}`;
  } else if (kind === "TO") {
    yards = clampInt(normal(rng, 16, 10), 0, 42);
    plays = clampInt(normal(rng, 4.6, 1.5), 1, 11);
    const isInt = rng() < 0.62;
    turnover = isInt ? "int" : "fumble";
    result = "TO";
    detail = isInt ? `${qb.name} intercepted` : "Fumble lost";
  } else if (kind === "DOWNS") {
    yards = clampInt(normal(rng, 34, 10), 8, 58);
    plays = clampInt(normal(rng, 6.8, 1.4), 4, 12);
    result = "DOWNS";
    detail = "Turned over on downs";
  } else {
    yards = clampInt(normal(rng, 13, 8), 0, 36);
    plays = clampInt(normal(rng, 4.1, 1.2), 3, 8);
    result = "PUNT";
    detail = "Punt";
  }

  const share = clamp(passRate + (qb.ypa - 7.2) * 0.04 + normal(rng, 0, 0.06), 0.32, 0.8);
  const passYd = Math.round(yards * share);
  const rushYd = yards - passYd;
  if (script.quarter >= 4 && script.lead >= 14) {
    plays = Math.max(3, Math.round(plays * 0.9));
  }

  return {
    abbr: off.abbr,
    result,
    plays,
    yards,
    points,
    detail,
    passYd,
    rushYd,
    scorer,
    scoreKind,
    fgMade,
    fgAtt,
    turnover,
  };
}

function rating(cmp: number, att: number, yds: number, td: number, int: number) {
  if (att <= 0) return 0;
  const a = clamp((cmp / att - 0.3) * 5, 0, 2.375);
  const b = clamp((yds / att - 3) * 0.25, 0, 2.375);
  const c = clamp((td / att) * 20, 0, 2.375);
  const d = clamp(2.375 - (int / att) * 25, 0, 2.375);
  return Math.round(((a + b + c + d) / 6) * 1000) / 10;
}

function emptyLine(name: string, pos: NflPlayerLine["pos"]): NflPlayerLine {
  return {
    name,
    pos,
    cmp: 0,
    att: 0,
    passYd: 0,
    passTd: 0,
    int: 0,
    sack: 0,
    car: 0,
    rushYd: 0,
    rushTd: 0,
    tgt: 0,
    rec: 0,
    recYd: 0,
    recTd: 0,
    fgm: 0,
    fga: 0,
    xpm: 0,
    xpa: 0,
    rating: 0,
  };
}

function boxTeam(
  off: NflTeam,
  def: NflTeam,
  drives: Built[],
  quarters: number[],
  oppPlays: number,
  home: boolean,
  rng: Rng,
): NflSide {
  const qb = qbOf(off);
  const edge = edgeOf(off, def, home);
  const players = off.players.map((p) => emptyLine(p.name, p.pos));
  const byName = new Map(players.map((p) => [p.name, p]));

  let passYd = 0;
  let rushYd = 0;
  let plays = 0;
  let tds = 0;
  let ints = 0;
  let fumbles = 0;
  const recTd = new Map<string, number>();
  const rushTd = new Map<string, number>();

  for (const d of drives) {
    passYd += d.passYd;
    rushYd += d.rushYd;
    plays += d.plays;
    if (d.scoreKind === "pass" && d.scorer) {
      tds += 1;
      recTd.set(d.scorer, (recTd.get(d.scorer) ?? 0) + 1);
      const q = byName.get(qb.name);
      if (q) q.passTd += 1;
    }
    if (d.scoreKind === "rush" && d.scorer) {
      tds += 1;
      rushTd.set(d.scorer, (rushTd.get(d.scorer) ?? 0) + 1);
    }
    if (d.turnover === "int") ints += 1;
    if (d.turnover === "fumble") fumbles += 1;
  }

  const ypa = clamp(qb.ypa * (off.passOff / def.passDef) * (0.9 + rng() * 0.2), 5.3, 10.4);
  let att = clampInt(passYd / Math.max(4.5, ypa), 14, 52);
  att = Math.max(att, (byName.get(qb.name)?.passTd ?? 0) + ints);
  const sackP = clamp(0.072 * (def.passDef / off.passOff), 0.03, 0.13);
  const sacks = binomial(rng, att, sackP);
  const compP = clamp(qb.comp * (0.94 + 0.08 * (off.passOff / def.passDef)) * (0.96 + rng() * 0.08), 0.5, 0.82);
  let cmp = binomial(rng, att, compP);
  const passTd = byName.get(qb.name)?.passTd ?? 0;
  if (cmp < passTd) cmp = passTd;
  if (cmp > att) cmp = att;

  const targetsTotal = Math.max(cmp, clampInt(att * 0.95, cmp, att));
  const receivers = off.players.filter((p) => p.pos !== "QB" && p.pos !== "K");
  const tgtMins = receivers.map((p) => recTd.get(p.name) ?? 0);
  const tgtCaps = receivers.map(() => Math.max(targetsTotal, 18));
  const tgts = allocate(
    targetsTotal,
    receivers.map((p) => p.tgt * (0.82 + rng() * 0.36)),
    tgtMins,
    tgtCaps,
  );
  // Fix sum if allocate undershot because of drift.
  let tgtSum = tgts.reduce((a, b) => a + b, 0);
  if (tgtSum < targetsTotal && receivers.length) tgts[0] += targetsTotal - tgtSum;
  tgtSum = tgts.reduce((a, b) => a + b, 0);

  const rec = receivers.map((p, i) => Math.min(tgts[i], recTd.get(p.name) ?? 0));
  let recSum = rec.reduce((a, b) => a + b, 0);
  const catchP = receivers.map((p, i) => {
    if (tgts[i] <= 0) return 0;
    const slot = p.pos === "RB" || p.pos === "TE" ? 0.06 : 0;
    return clamp(compP + slot - Math.max(0, p.ypr - 12) * 0.012, 0.45, 0.86);
  });
  for (let i = 0; i < receivers.length; i++) {
    const extra = Math.max(0, tgts[i] - rec[i]);
    const made = binomial(rng, extra, catchP[i]);
    rec[i] += made;
  }
  recSum = rec.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (recSum > cmp && guard++ < 80) {
    let i = -1;
    for (let k = 0; k < rec.length; k++) {
      if (rec[k] > (recTd.get(receivers[k].name) ?? 0) && (i < 0 || rec[k] > rec[i])) i = k;
    }
    if (i < 0) break;
    rec[i] -= 1;
    recSum -= 1;
  }
  guard = 0;
  while (recSum < cmp && guard++ < 80) {
    const open = receivers.map((p, i) => (rec[i] < tgts[i] ? Math.max(1, p.tgt) : 0));
    if (open.every((v) => v === 0)) {
      // Grow a target so a completion can land.
      const i = weightedIndex(
        rng,
        receivers.map((p) => p.tgt),
      );
      tgts[i] += 1;
      rec[i] += 1;
      recSum += 1;
      continue;
    }
    const i = weightedIndex(rng, open);
    rec[i] += 1;
    recSum += 1;
  }

  const wind = off.windMph ?? 0;
  const yprOf = (ypr: number) => (wind >= 15 && ypr > 11 ? clamp(ypr - Math.min(2.2, (wind - 12) * 0.11), 7.5, 18) : ypr);
  const recYards = fitToTarget(
    scaleToSum(
      receivers.map((p, i) => rec[i] * yprOf(p.ypr)),
      passYd,
    ),
    passYd,
    receivers.map((p) => (recTd.get(p.name) ?? 0) * 4),
  );

  const rushers = off.players.filter((p) => p.rush > 0);
  const ypcGuess = rushers.reduce((s, p) => s + p.ypc * p.rush, 0) / Math.max(1, rushers.reduce((s, p) => s + p.rush, 0));
  let carriesTotal = clampInt(rushYd / Math.max(3.2, ypcGuess * (0.92 + rng() * 0.16)), 12, 42);
  const rushMins = rushers.map((p) => rushTd.get(p.name) ?? 0);
  carriesTotal = Math.max(carriesTotal, rushMins.reduce((a, b) => a + b, 0));
  const cars = allocate(
    carriesTotal,
    rushers.map((p) => p.rush * (0.85 + rng() * 0.3)),
    rushMins,
    rushers.map(() => carriesTotal),
  );
  const rushYards = fitToTarget(
    scaleToSum(
      rushers.map((p, i) => cars[i] * p.ypc),
      rushYd,
    ),
    rushYd,
    rushers.map((p) => rushTd.get(p.name) ?? 0),
  );

  const qLine = byName.get(qb.name)!;
  qLine.cmp = cmp;
  qLine.att = att;
  qLine.passYd = passYd;
  qLine.int = ints;
  qLine.sack = sacks;
  qLine.rating = rating(cmp, att, passYd, qLine.passTd, ints);

  receivers.forEach((p, i) => {
    const line = byName.get(p.name)!;
    line.tgt = tgts[i];
    line.rec = rec[i];
    line.recYd = recYards[i];
    line.recTd = recTd.get(p.name) ?? 0;
  });
  rushers.forEach((p, i) => {
    const line = byName.get(p.name)!;
    line.car = cars[i];
    line.rushYd = rushYards[i];
    line.rushTd = rushTd.get(p.name) ?? 0;
  });

  const kicker = kickerOf(off);
  const kLine = byName.get(kicker.name)!;
  kLine.fga = drives.filter((d) => d.fgAtt).length;
  kLine.fgm = drives.filter((d) => d.fgMade).length;
  kLine.xpa = drives.filter((d) => d.result === "TD").length;
  kLine.xpm = drives.filter((d) => d.result === "TD" && d.points === 7).length;

  const yards = passYd + rushYd;
  const thirdAtt = clampInt(plays * 0.21 + normal(rng, 0, 0.6), 7, 16);
  const thirdMade = binomial(rng, thirdAtt, clamp(0.3 + (edge - 1) * 0.28, 0.2, 0.58));
  const penalties = clampInt(normal(rng, 5.5, 1.5), 1, 12);
  const penaltyYds = penalties * clampInt(normal(rng, 8.2, 1.4), 4, 15);
  const totalPlays = Math.max(1, plays + oppPlays);
  const top = plays / totalPlays * 3600;

  const ordered = [...players].sort((a, b) => {
    if (a.pos === "K" && b.pos !== "K") return 1;
    if (b.pos === "K" && a.pos !== "K") return -1;
    const va = a.passYd + a.rushYd + a.recYd + a.passTd * 40 + a.rushTd * 40 + a.recTd * 40 + (a.fgm * 3 + a.xpm);
    const vb = b.passYd + b.rushYd + b.recYd + b.passTd * 40 + b.rushTd * 40 + b.recTd * 40 + (b.fgm * 3 + b.xpm);
    return vb - va;
  });

  return {
    id: off.id,
    abbr: off.abbr,
    score: quarters.reduce((a, b) => a + b, 0),
    quarters,
    yards,
    passYd,
    rushYd,
    plays,
    firstDowns: clampInt(yards / 15.5 + tds * 0.45 + normal(rng, 0, 1), 8, 34),
    thirdMade,
    thirdAtt,
    turnovers: ints + fumbles,
    sacks: 0,
    penalties,
    penaltyYds,
    top: clock(top),
    players: ordered,
  };
}

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function quartersFrom(drives: { points: number; quarter: number }[]) {
  const q = [0, 0, 0, 0];
  let ot = 0;
  let playedOt = false;
  for (const d of drives) {
    if (d.quarter >= 5) {
      playedOt = true;
      ot += d.points;
    } else q[d.quarter - 1] += d.points;
  }
  if (playedOt) q.push(ot);
  return q;
}

export function simulateNflGame(away: NflTeam, home: NflTeam, rng: Rng, detail: boolean): NflGame {
  const wind = home.windMph ?? away.windMph ?? 0;
  const nAway = clampInt(skewed(rng, 10.7, 1.15), 8, 15);
  const nHome = clampInt(nAway + normal(rng, 0, 0.85), 8, 15);
  const builtA: Built[] = [];
  const builtH: Built[] = [];
  const seq: { side: "A" | "H"; d: Built; quarter: number }[] = [];
  const n = Math.max(nAway, nHome);
  let aPts = 0;
  let hPts = 0;
  for (let i = 0; i < n; i++) {
    const quarter = Math.min(4, Math.floor((i / n) * 4) + 1);
    if (i < nAway) {
      const d = buildDrive(away, home, false, rng, { lead: aPts - hPts, quarter, wind });
      builtA.push(d);
      seq.push({ side: "A", d, quarter });
      aPts += d.points;
    }
    if (i < nHome) {
      const d = buildDrive(home, away, true, rng, { lead: hPts - aPts, quarter, wind });
      builtH.push(d);
      seq.push({ side: "H", d, quarter });
      hPts += d.points;
    }
  }
  const stamped = seq;
  const score = (side: "A" | "H") => stamped.filter((x) => x.side === side).reduce((s, x) => s + x.d.points, 0);
  let ot = false;
  let round = 0;
  while (score("A") === score("H") && round < 3) {
    ot = true;
    round += 1;
    const a = buildDrive(away, home, false, rng, { lead: 0, quarter: 5, wind });
    const h = buildDrive(home, away, true, rng, { lead: 0, quarter: 5, wind });
    builtA.push(a);
    builtH.push(h);
    stamped.push({ side: "A", d: a, quarter: 5 });
    stamped.push({ side: "H", d: h, quarter: 5 });
  }

  const aQuarters = quartersFrom(stamped.filter((x) => x.side === "A").map((x) => ({ points: x.d.points, quarter: x.quarter })));
  const hQuarters = quartersFrom(stamped.filter((x) => x.side === "H").map((x) => ({ points: x.d.points, quarter: x.quarter })));
  const len = Math.max(aQuarters.length, hQuarters.length);
  while (aQuarters.length < len) aQuarters.push(0);
  while (hQuarters.length < len) hQuarters.push(0);

  const aPlays = builtA.reduce((s, d) => s + d.plays, 0);
  const hPlays = builtH.reduce((s, d) => s + d.plays, 0);
  const awayBox = boxTeam(away, home, builtA, aQuarters, hPlays, false, rng);
  const homeBox = boxTeam(home, away, builtH, hQuarters, aPlays, true, rng);
  // Sacks are recorded on the offense QB; show them as the opponent's defensive sacks.
  awayBox.sacks = homeBox.players.find((p) => p.pos === "QB")?.sack ?? 0;
  homeBox.sacks = awayBox.players.find((p) => p.pos === "QB")?.sack ?? 0;

  // Recompute TOP now that both play counts are final (OT included).
  const playsSum = Math.max(1, awayBox.plays + homeBox.plays);
  awayBox.top = clock((awayBox.plays / playsSum) * (ot ? 3900 : 3600));
  homeBox.top = clock((homeBox.plays / playsSum) * (ot ? 3900 : 3600));

  const drives: Drive[] = detail
    ? stamped.map((x) => ({
        abbr: x.d.abbr,
        quarter: x.quarter,
        result: x.d.result,
        plays: x.d.plays,
        yards: x.d.yards,
        points: x.d.points,
        detail: x.d.detail,
      }))
    : [];

  return {
    away: awayBox,
    home: homeBox,
    drives,
    narrative: narrate(away, home, awayBox, homeBox),
    notes: notes(away, home, awayBox, homeBox),
    ot,
  };
}

function narrate(away: NflTeam, home: NflTeam, a: NflSide, h: NflSide) {
  const tie = a.score === h.score;
  const homeWon = h.score > a.score;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const margin = Math.abs(h.score - a.score);
  const verb = margin >= 17 ? "pulled away from" : margin <= 3 ? "edged" : "beat";
  const lead = tie
    ? `${away.city} and ${home.city} played to a ${a.score}–${h.score} tie.`
    : `${winner.city} ${verb} ${loser.city} ${Math.max(a.score, h.score)}–${Math.min(a.score, h.score)}.`;
  const wBox = tie ? h : homeWon ? h : a;
  const qb = wBox.players.find((p) => p.pos === "QB");
  const pass =
    qb && qb.att > 0
      ? `${qb.name} finished ${qb.cmp}/${qb.att} for ${qb.passYd} yards and ${qb.passTd} passing TD${qb.passTd === 1 ? "" : "s"}${
          qb.int ? ` with ${qb.int} interception${qb.int === 1 ? "" : "s"}` : ""
        }.`
      : "";
  const skill = [...a.players, ...h.players]
    .filter((p) => p.pos !== "QB" && p.pos !== "K")
    .sort((x, y) => y.rushYd + y.recYd + y.rushTd * 25 + y.recTd * 25 - (x.rushYd + x.recYd + x.rushTd * 25 + x.recTd * 25))[0];
  let skillLine = "";
  if (skill && (skill.rushYd > 0 || skill.rec > 0)) {
    const bits: string[] = [];
    if (skill.car > 0) bits.push(`${skill.car} ${skill.car === 1 ? "carry" : "carries"} for ${skill.rushYd}`);
    if (skill.rec > 0) bits.push(`${skill.rec} catch${skill.rec === 1 ? "" : "es"} for ${skill.recYd}`);
    const team = a.players.some((p) => p.name === skill.name) ? a.abbr : h.abbr;
    skillLine = `${skill.name} (${team}) added ${bits.join(" and ")}.`;
  }
  return [lead, pass, skillLine].filter(Boolean).join(" ");
}

function notes(away: NflTeam, home: NflTeam, a: NflSide, h: NflSide) {
  const yardEdge = a.yards === h.yards ? "The yards finished even." : a.yards > h.yards ? `${away.abbr} won the yardage battle ${a.yards}–${h.yards}.` : `${home.abbr} won the yardage battle ${h.yards}–${a.yards}.`;
  const to =
    a.turnovers === h.turnovers
      ? `Turnovers were even at ${a.turnovers}.`
      : `${a.turnovers < h.turnovers ? away.abbr : home.abbr} won the turnover margin ${Math.min(a.turnovers, h.turnovers)}–${Math.max(a.turnovers, h.turnovers)}.`;
  const third = `Third down: ${away.abbr} ${a.thirdMade}-${a.thirdAtt}, ${home.abbr} ${h.thirdMade}-${h.thirdAtt}.`;
  return [yardEdge, to, third];
}

const CENTERS = [-28, -21, -14, -7, 0, 7, 14, 21, 28];

function emptyBin() {
  return CENTERS.map((c, i) => ({
    label: `${c > 0 ? "+" : ""}${c}`,
    count: 0,
    hint:
      i === 0
        ? "Home margin −32 or worse"
        : i === CENTERS.length - 1
          ? "Home margin +32 or better"
          : `Home margin near ${c > 0 ? "+" : ""}${c}`,
  }));
}

function binIndex(margin: number) {
  if (margin <= -32) return 0;
  if (margin >= 32) return CENTERS.length - 1;
  const idx = Math.round((margin - CENTERS[0]) / 7);
  return Math.min(CENTERS.length - 1, Math.max(0, idx));
}

function addProj(map: Map<string, NflProjPlayer>, line: NflPlayerLine, n: number) {
  const cur = map.get(line.name) ?? {
    name: line.name,
    pos: line.pos,
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
  };
  cur.passYd += line.passYd / n;
  cur.passTd += line.passTd / n;
  cur.int += line.int / n;
  cur.rushYd += line.rushYd / n;
  cur.rushTd += line.rushTd / n;
  cur.rec += line.rec / n;
  cur.recYd += line.recYd / n;
  cur.recTd += line.recTd / n;
  cur.fgm += line.fgm / n;
  cur.fga += line.fga / n;
  map.set(line.name, cur);
}

function clockSeconds(top: string) {
  const [m, s] = top.split(":");
  const min = Number(m);
  const sec = Number(s);
  if (!Number.isFinite(min) || !Number.isFinite(sec)) return 0;
  return min * 60 + sec;
}

function takenSacks(side: NflSide) {
  return side.players.reduce((sum, player) => sum + player.sack, 0);
}

type TeamAcc = {
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
  top: number;
};

function emptyAcc(): TeamAcc {
  return {
    yards: 0,
    passYd: 0,
    rushYd: 0,
    firstDowns: 0,
    sacks: 0,
    thirdMade: 0,
    thirdAtt: 0,
    turnovers: 0,
    penalties: 0,
    penaltyYds: 0,
    top: 0,
  };
}

function addAcc(acc: TeamAcc, side: NflSide, sacksMade: number) {
  acc.yards += side.yards;
  acc.passYd += side.passYd;
  acc.rushYd += side.rushYd;
  acc.firstDowns += side.firstDowns;
  acc.sacks += sacksMade;
  acc.thirdMade += side.thirdMade;
  acc.thirdAtt += side.thirdAtt;
  acc.turnovers += side.turnovers;
  acc.penalties += side.penalties;
  acc.penaltyYds += side.penaltyYds;
  acc.top += clockSeconds(side.top);
}

function finishAcc(acc: TeamAcc, abbr: string, n: number): NflTeamAvg {
  const d = (value: number) => value / n;
  return {
    abbr,
    yards: d(acc.yards),
    passYd: d(acc.passYd),
    rushYd: d(acc.rushYd),
    firstDowns: d(acc.firstDowns),
    sacks: d(acc.sacks),
    thirdMade: d(acc.thirdMade),
    thirdAtt: d(acc.thirdAtt),
    turnovers: d(acc.turnovers),
    penalties: d(acc.penalties),
    penaltyYds: d(acc.penaltyYds),
    top: clock(d(acc.top)),
  };
}

export function projectNfl(away: NflTeam, home: NflTeam, rng: Rng, n: number): NflProj {
  let homeWin = 0;
  let awayWin = 0;
  let tie = 0;
  let sumHome = 0;
  let sumAway = 0;
  const bins = emptyBin();
  const awayMap = new Map<string, NflProjPlayer>();
  const homeMap = new Map<string, NflProjPlayer>();
  const awayAcc = emptyAcc();
  const homeAcc = emptyAcc();
  for (let i = 0; i < n; i++) {
    const g = simulateNflGame(away, home, rng, false);
    const blended = blendScore(g.away.score, g.home.score, home.line ?? away.line);
    g.away.score = blended.away;
    g.home.score = blended.home;
    sumHome += g.home.score;
    sumAway += g.away.score;
    if (g.home.score > g.away.score) homeWin += 1;
    else if (g.home.score < g.away.score) awayWin += 1;
    else tie += 1;
    bins[binIndex(g.home.score - g.away.score)].count += 1;
    addAcc(awayAcc, g.away, takenSacks(g.home));
    addAcc(homeAcc, g.home, takenSacks(g.away));
    for (const p of g.away.players) addProj(awayMap, p, n);
    for (const p of g.home.players) addProj(homeMap, p, n);
  }
  const sort = (list: NflProjPlayer[]) =>
    [...list].sort((a, b) => {
      if (a.pos === "K" && b.pos !== "K") return 1;
      if (b.pos === "K" && a.pos !== "K") return -1;
      return b.passYd + b.rushYd + b.recYd + b.passTd * 30 - (a.passYd + a.rushYd + a.recYd + a.passTd * 30);
    });
  return {
    n,
    homeWin,
    awayWin,
    tie,
    meanHome: sumHome / n,
    meanAway: sumAway / n,
    bins,
    awayPlayers: sort([...awayMap.values()]),
    homePlayers: sort([...homeMap.values()]),
    awayAvg: finishAcc(awayAcc, away.abbr, n),
    homeAvg: finishAcc(homeAcc, home.abbr, n),
  };
}
