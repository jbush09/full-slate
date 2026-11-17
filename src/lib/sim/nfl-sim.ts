import type { NflCalls, NflTeam } from "@/data/nfl";
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
  grossPass: number;
  scorer: string | null;
  scoreKind: "pass" | "rush" | null;
  fgMade: boolean;
  fgAtt: boolean;
  turnover: "int" | "fumble" | null;
  thirdMade: number;
  thirdAtt: number;
  spot: number;
  passPlays: number;
  rushPlays: number;
  sacks: number;
  sackYds: number;
  firstDowns: number;
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

type Script = { lead: number; quarter: number; wind: number; start?: number; maxPlays?: number; hurry?: boolean };

function callsOf(off: NflTeam): NflCalls {
  const pass = off.passRate;
  return (
    off.calls ?? {
      drives: 11,
      plays: 6.2,
      sec: 28,
      ypp: 5.4,
      pass,
      passLead: clamp(pass - 0.12, 0.34, 0.78),
      passTrail: clamp(pass + 0.1, 0.4, 0.84),
      passShort: clamp(pass - 0.14, 0.28, 0.7),
      passLong: clamp(pass + 0.16, 0.48, 0.86),
      td: 0.22,
      fg: 0.14,
      to: clamp(0.11 * off.toGive, 0.05, 0.22),
      go4: 0.28,
    }
  );
}

/** Completion or rush yards. Mean is set so a league snap lands near 5.4 yards once sacks and incompletions are included. */
function chunkGain(isPass: boolean, rng: Rng, scale: number) {
  const u = rng();
  if (isPass) {
    const base =
      u < 0.46 ? skewed(rng, 3.6, 1.4) : u < 0.74 ? skewed(rng, 9, 2) : u < 0.91 ? skewed(rng, 16.2, 3) : skewed(rng, 28.5, 6);
    return Math.round(clamp(base * scale, 0, 60));
  }
  const base =
    u < 0.3 ? skewed(rng, -0.6, 1.1) : u < 0.68 ? skewed(rng, 2.9, 1.15) : u < 0.9 ? skewed(rng, 6.4, 1.7) : skewed(rng, 14.2, 3.6);
  return Math.round(clamp(base * scale, -5, 55));
}

function buildDrive(off: NflTeam, def: NflTeam, home: boolean, rng: Rng, script: Script = { lead: 0, quarter: 2, wind: off.windMph ?? 0 }): Built {
  const edge = clamp(edgeOf(off, def, home), 0.84, 1.2);
  const calls = callsOf(off);
  const qb = qbOf(off);
  const kicker = kickerOf(off);
  const skill = off.players.filter((p) => p.pos !== "K");
  let ytg = clampInt(script.start ?? skewed(rng, 70, 3), 6, 92);
  const start = ytg;
  let down = 1;
  let toGo = 10;
  let plays = 0;
  let grossPass = 0;
  let sackYds = 0;
  let rushYd = 0;
  let thirdMade = 0;
  let thirdAtt = 0;
  let passPlays = 0;
  let rushPlays = 0;
  let sacks = 0;
  let firstDowns = 0;
  let result: Drive["result"] | null = null;
  let detail = "Punt";
  let points = 0;
  let scorer: string | null = null;
  let scoreKind: "pass" | "rush" | null = null;
  let fgMade = false;
  let fgAtt = false;
  let turnover: "int" | "fumble" | null = null;
  const toPlay = clamp((calls.to / Math.max(3.2, calls.plays)) * (off.toGive / Math.max(0.75, def.toTake)), 0.006, 0.04);
  const spot = off.spot;
  const scale = clamp((calls.ypp / 5.12) * edge * (spot?.form ?? 1), 0.7, 1.36);
  const cap = clampInt(script.maxPlays ?? 14, 1, 14);

  const finishTd = (isPass: boolean) => {
    if (isPass) {
      const receivers = skill.filter((p) => p.pos !== "QB" && p.tgt > 0);
      const idx = weightedIndex(
        rng,
        receivers.map((p) => p.tgt * (p.pos === "TE" ? 1.15 : p.pos === "RB" ? 0.7 : 1)),
      );
      scorer = receivers[idx]?.name ?? qb.name;
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
    firstDowns += 1;
    ytg = 0;
  };

  for (let n = 0; n < cap && result == null; n++) {
    if (down === 4) {
      const dist = clampInt(ytg + 17, 18, 68);
      const inRange = dist <= 52 || (dist <= 57 && kicker.fg >= 0.84 && script.wind < 15);
      let goP = calls.go4 * (script.quarter >= 4 && script.lead < 0 ? 1.4 : 1);
      if (script.hurry && script.lead < 0) goP = Math.max(goP, 0.62);
      if (ytg <= 2) goP = Math.max(goP, 0.8);
      const go = toGo <= 3 && ytg <= 58 && rng() < goP;
      if (!go && inRange) {
        let make = kicker.fg;
        if (dist >= 50) make -= (dist - 50) * 0.038;
        else if (dist <= 35) make += 0.06;
        if (script.wind >= 15 && dist >= 40) make -= Math.min(0.16, (script.wind - 12) * 0.007);
        if (spot?.wet) make -= 0.04;
        if (spot?.cold) make -= 0.03;
        make = clamp(make * (0.92 + 0.08 * off.st), 0.28, 0.97);
        fgAtt = true;
        fgMade = rng() < make;
        points = fgMade ? 3 : 0;
        result = fgMade ? "FG" : "MISS";
        detail = fgMade ? `${kicker.name} from ${dist}` : `${kicker.name} missed from ${dist}`;
        break;
      }
      if (!go) {
        result = "PUNT";
        detail = script.maxPlays != null && script.maxPlays <= 2 && script.quarter >= 4 ? "End of half" : "Punt";
        break;
      }
    }

    let passP = calls.pass;
    if (script.quarter >= 4 && script.lead >= 8) passP = calls.passLead;
    else if (script.quarter >= 4 && script.lead <= -8) passP = calls.passTrail;
    if (toGo <= 2) passP = calls.passShort;
    if (down >= 3 && toGo >= 7) passP = calls.passLong;
    if (ytg <= 8 && toGo <= 6) passP = Math.min(passP, calls.passShort + 0.06);
    if (script.wind >= 15) passP -= Math.min(0.12, (script.wind - 12) * 0.008);
    if (spot) passP += spot.call;
    if (spot?.wet) passP -= 0.04;
    if (spot?.cold) passP -= 0.03;
    if (script.hurry && script.lead < 0) passP = Math.max(passP, calls.passTrail);
    passP = clamp(passP, 0.28, 0.88);
    const isPass = rng() < passP;
    const onThird = down === 3;
    if (onThird) thirdAtt += 1;
    plays += 1;
    if (isPass) passPlays += 1;
    else rushPlays += 1;

    if (isPass && rng() < toPlay * 1.15) {
      turnover = "int";
      result = "TO";
      detail = `${qb.name} intercepted`;
      break;
    }
    if (!isPass && rng() < toPlay * 0.7 * (spot?.wet ? 1.4 : 1)) {
      turnover = "fumble";
      result = "TO";
      detail = "Fumble lost";
      break;
    }

    let gain = 0;
    if (isPass) {
      const sackP = clamp(0.062 * (def.passDef / Math.max(0.75, off.passOff)) * (spot?.sack ?? 1) * (spot && spot.qb < 1 ? 1.12 : 1), 0.025, 0.14);
      if (rng() < sackP) {
        gain = -clampInt(skewed(rng, 6.2, 1.6), 1, 14);
        sacks += 1;
        sackYds += -gain;
      } else if (rng() > clamp(qb.comp * (0.94 + 0.08 * edge) * (spot?.pass ?? 1) * (spot?.qb ?? 1) * (spot?.wet ? 0.96 : 1) * (spot?.cold ? 0.985 : 1), 0.46, 0.76)) {
        gain = 0;
      } else {
        gain = chunkGain(true, rng, scale);
        if (spot) gain = Math.round(gain * spot.pass);
        if (script.wind >= 15 && gain > 16) gain = Math.round(gain * 0.84);
      }
    } else {
      gain = chunkGain(false, rng, scale);
      if (spot) gain = Math.round(gain * spot.run);
    }
    if (gain > ytg) gain = ytg;
    if (isPass) grossPass += Math.max(0, gain);
    else rushYd += gain;
    ytg -= gain;
    if (onThird && gain >= toGo) thirdMade += 1;
    if (ytg <= 0) {
      finishTd(isPass);
      break;
    }
    if (gain >= toGo) {
      firstDowns += 1;
      down = 1;
      toGo = Math.min(10, ytg);
    } else {
      down += 1;
      toGo = Math.max(1, toGo - gain);
      if (down > 4) {
        result = "DOWNS";
        detail = "Turned over on downs";
        break;
      }
    }
  }

  if (result == null) {
    result = "PUNT";
    detail = "Punt";
  }
  if (plays === 0) plays = 1;
  const netPass = grossPass - sackYds;
  const yards = Math.max(0, start - ytg);

  return {
    abbr: off.abbr,
    result,
    plays,
    yards,
    points,
    detail,
    passYd: netPass,
    rushYd,
    grossPass,
    scorer,
    scoreKind,
    fgMade,
    fgAtt,
    turnover,
    thirdMade,
    thirdAtt,
    spot: ytg,
    passPlays,
    rushPlays,
    sacks,
    sackYds,
    firstDowns,
  };
}

function kneelDrive(off: NflTeam, ytg: number): Built {
  return {
    abbr: off.abbr,
    result: "PUNT",
    plays: 3,
    yards: 0,
    points: 0,
    detail: "Kneel",
    passYd: 0,
    rushYd: 0,
    grossPass: 0,
    scorer: null,
    scoreKind: null,
    fgMade: false,
    fgAtt: false,
    turnover: null,
    thirdMade: 0,
    thirdAtt: 0,
    spot: ytg,
    passPlays: 0,
    rushPlays: 3,
    sacks: 0,
    sackYds: 0,
    firstDowns: 0,
  };
}

function nextSpot(d: Built, rng: Rng) {
  if (d.result === "TD" || d.result === "FG") return clampInt(skewed(rng, 70, 1.6), 66, 75);
  if (d.result === "PUNT" && d.detail !== "Kneel" && d.detail !== "End of half") {
    const net = clampInt(skewed(rng, 40, 3.5), 30, 50);
    if (net >= d.spot) return 80;
    return clampInt(100 - d.spot + net, 12, 92);
  }
  return clampInt(100 - Math.max(1, d.spot), 8, 95);
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

  let netPass = 0;
  let gross = 0;
  let rushYd = 0;
  let plays = 0;
  let ints = 0;
  let fumbles = 0;
  let sackN = 0;
  let passPlays = 0;
  let rushPlays = 0;
  let firsts = 0;
  const recTd = new Map<string, number>();
  const rushTd = new Map<string, number>();

  let thirdAtt = 0;
  let thirdMade = 0;
  for (const d of drives) {
    netPass += d.passYd;
    gross += d.grossPass;
    rushYd += d.rushYd;
    plays += d.plays;
    sackN += d.sacks;
    passPlays += d.passPlays;
    rushPlays += d.rushPlays;
    firsts += d.firstDowns;
    thirdAtt += d.thirdAtt;
    thirdMade += d.thirdMade;
    if (d.scoreKind === "pass" && d.scorer) {
      recTd.set(d.scorer, (recTd.get(d.scorer) ?? 0) + 1);
      const q = byName.get(qb.name);
      if (q) q.passTd += 1;
    }
    if (d.scoreKind === "rush" && d.scorer) {
      rushTd.set(d.scorer, (rushTd.get(d.scorer) ?? 0) + 1);
    }
    if (d.turnover === "int") ints += 1;
    if (d.turnover === "fumble") fumbles += 1;
  }
  netPass = Math.max(0, Math.round(netPass));
  gross = Math.max(netPass, Math.round(gross));
  rushYd = Math.max(0, Math.round(rushYd));

  const passTd = byName.get(qb.name)?.passTd ?? 0;
  let att = Math.max(0, passPlays - sackN);
  att = Math.max(att, passTd + ints);
  const sacks = sackN;
  const compP = clamp(qb.comp * (0.94 + 0.08 * (off.passOff / def.passDef)) * (0.96 + rng() * 0.08), 0.5, 0.78);
  let cmp = binomial(rng, att, compP);
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
      gross,
    ),
    gross,
    receivers.map((p) => (recTd.get(p.name) ?? 0) * 4),
  );

  const rushers = off.players.filter((p) => p.rush > 0);
  const rushMins = rushers.map((p) => rushTd.get(p.name) ?? 0);
  let carriesTotal = Math.max(rushPlays, rushMins.reduce((a, b) => a + b, 0));
  if (carriesTotal <= 0 && rushYd > 0) carriesTotal = clampInt(rushYd / 4.3, 8, 36);
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
  qLine.passYd = gross;
  qLine.int = ints;
  qLine.sack = sacks;
  qLine.rating = rating(cmp, att, gross, qLine.passTd, ints);

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

  const yards = netPass + rushYd;
  if (thirdAtt < 4) {
    thirdAtt = clampInt(plays * 0.21 + normal(rng, 0, 0.6), 7, 16);
    thirdMade = binomial(rng, thirdAtt, clamp(0.3 + (edge - 1) * 0.28, 0.2, 0.58));
  }
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
    passYd: netPass,
    rushYd,
    plays,
    firstDowns: firsts,
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
  const builtA: Built[] = [];
  const builtH: Built[] = [];
  const stamped: { side: "A" | "H"; d: Built; quarter: number }[] = [];
  let aPts = 0;
  let hPts = 0;
  let offense: "A" | "H" = rng() < 0.5 ? "A" : "H";
  const secondHalfKick = offense === "A" ? "H" : "A";
  let ytg = clampInt(skewed(rng, 70, 1.6), 66, 75);

  const runHalf = (half: 1 | 2) => {
    let clockLeft = 1800;
    if (half === 2) {
      offense = secondHalfKick;
      ytg = clampInt(skewed(rng, 70, 1.6), 66, 75);
    }
    let guard = 0;
    while (clockLeft > 18 && guard++ < 30) {
      const quarter = half === 1 ? (clockLeft > 900 ? 1 : 2) : clockLeft > 900 ? 3 : 4;
      const off = offense === "A" ? away : home;
      const def = offense === "A" ? home : away;
      const lead = offense === "A" ? aPts - hPts : hPts - aPts;
      const ending = quarter === 2 || quarter === 4;
      const sec = callsOf(off).sec;
      const hurry = ending && clockLeft < 155 && lead < 8;
      const kneel = quarter === 4 && ((lead >= 14 && clockLeft < 220) || (lead >= 7 && clockLeft < 100) || (lead > 0 && clockLeft < 45));
      const snap = hurry ? Math.max(12, sec * 0.46) : sec;
      let d: Built;
      if (kneel) {
        d = kneelDrive(off, ytg);
        clockLeft = 0;
      } else {
        const maxPlays = ending ? clampInt(Math.floor(clockLeft / snap), 1, 14) : 14;
        d = buildDrive(off, def, offense === "H", rng, { lead, quarter, wind, start: ytg, maxPlays, hurry });
        clockLeft -= d.plays * snap * (0.9 + rng() * 0.2);
      }
      if (offense === "A") {
        builtA.push(d);
        aPts += d.points;
      } else {
        builtH.push(d);
        hPts += d.points;
      }
      stamped.push({ side: offense, d, quarter });
      if (clockLeft <= 18) break;
      ytg = nextSpot(d, rng);
      offense = offense === "A" ? "H" : "A";
    }
  };
  runHalf(1);
  runHalf(2);

  const score = (side: "A" | "H") => stamped.filter((x) => x.side === side).reduce((s, x) => s + x.d.points, 0);
  let ot = false;
  let round = 0;
  let otFirst: "A" | "H" = rng() < 0.5 ? "A" : "H";
  while (score("A") === score("H") && round < 3) {
    ot = true;
    round += 1;
    const order: ("A" | "H")[] = otFirst === "A" ? ["A", "H"] : ["H", "A"];
    for (const side of order) {
      if (round === 1 && side !== order[0] && score("A") !== score("H") && stamped[stamped.length - 1]?.d.result === "TD") break;
      const d = buildDrive(side === "A" ? away : home, side === "A" ? home : away, side === "H", rng, {
        lead: 0,
        quarter: 5,
        wind,
        start: 75,
        maxPlays: 10,
      });
      if (side === "A") builtA.push(d);
      else builtH.push(d);
      stamped.push({ side, d, quarter: 5 });
      if (d.result === "TD" && round > 1) break;
    }
    otFirst = otFirst === "A" ? "H" : "A";
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
  awayBox.sacks = homeBox.players.find((p) => p.pos === "QB")?.sack ?? 0;
  homeBox.sacks = awayBox.players.find((p) => p.pos === "QB")?.sack ?? 0;

  const rawA = awayBox.plays * callsOf(away).sec;
  const rawH = homeBox.plays * callsOf(home).sec;
  const span = ot ? 3900 : 3600;
  const scale = span / Math.max(1, rawA + rawH);
  awayBox.top = clock(rawA * scale);
  homeBox.top = clock(rawH * scale);

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
