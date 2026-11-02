import type { NbaTeam } from "@/data/nba";
import { binomial, blendScore, clamp, clampInt, skewed, splitInt, type Rng } from "@/lib/sim/random";
import type { NbaGame, NbaPlayerLine, NbaProj, NbaProjPlayer, NbaSide, QuarterNote } from "@/lib/sim/types";

type Shot = {
  fga: number[];
  fgm: number[];
  tpa: number[];
  tpm: number[];
  fta: number[];
  ftm: number[];
  tov: number[];
  pts: number[];
  missed2: number;
  misses: number;
  teamTov: number;
  teamPts: number;
};

function factor(off: NbaTeam, def: NbaTeam, home: boolean) {
  const raw = off.off / Math.max(0.8, def.def);
  const softened = 1 + (raw - 1) * 0.45;
  return clamp(softened * (home ? 1.016 : 0.992), 0.94, 1.035);
}

function shoot(team: NbaTeam, opp: NbaTeam, poss: number, home: boolean, rng: Rng): Shot {
  const fac = clamp(factor(team, opp, home) * (0.94 + rng() * 0.12), 0.82, 1.26);
  const n = team.players.length;
  const weights = team.players.map((p) => Math.max(0.4, p.usg * p.min * (0.86 + rng() * 0.28)));
  const tovRate = clamp(team.tov * (0.88 + rng() * 0.24) * (0.92 + opp.def * 0.08), 0.09, 0.18);
  const teamTov = binomial(rng, Math.max(0, poss), tovRate);
  const fgaTeam = clampInt((poss - teamTov) * (0.98 + team.orb * 0.28) * (0.97 + rng() * 0.06), 4, poss + 14);
  const fga = splitInt(fgaTeam, weights);
  const tov = splitInt(
    teamTov,
    team.players.map((p) => p.tov * p.min),
  );
  const fgm: number[] = [];
  const tpa: number[] = [];
  const tpm: number[] = [];
  const fta: number[] = [];
  const ftm: number[] = [];
  const pts: number[] = [];
  let missed2 = 0;
  let misses = 0;
  let teamPts = 0;
  for (let i = 0; i < n; i++) {
    const p = team.players[i];
    const threes = binomial(rng, fga[i], clamp(p.three, 0.02, 0.72));
    const twos = fga[i] - threes;
    const m3 = binomial(rng, threes, clamp(p.fg3 * fac, 0.26, 0.48));
    const m2 = binomial(rng, twos, clamp(p.fg2 * fac, 0.4, 0.74));
    const attFt = binomial(rng, Math.max(fga[i], 1), clamp(p.ftr, 0, 0.7));
    const ftAtt = fga[i] === 0 ? 0 : attFt;
    const madeFt = binomial(rng, ftAtt, clamp(p.ft, 0.5, 0.95));
    const made = m2 + m3;
    const points = m2 * 2 + m3 * 3 + madeFt;
    tpa.push(threes);
    tpm.push(m3);
    fgm.push(made);
    fta.push(ftAtt);
    ftm.push(madeFt);
    pts.push(points);
    missed2 += twos - m2;
    misses += fga[i] - made;
    teamPts += points;
  }
  return { fga, fgm, tpa, tpm, fta, ftm, tov, pts, missed2, misses, teamTov, teamPts };
}

type Acc = {
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

function blank(n: number): Acc[] {
  return Array.from({ length: n }, () => ({
    min: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
  }));
}

function addShot(acc: Acc[], shot: Shot) {
  for (let i = 0; i < acc.length; i++) {
    acc[i].pts += shot.pts[i];
    acc[i].tov += shot.tov[i];
    acc[i].fgm += shot.fgm[i];
    acc[i].fga += shot.fga[i];
    acc[i].tpm += shot.tpm[i];
    acc[i].tpa += shot.tpa[i];
    acc[i].ftm += shot.ftm[i];
    acc[i].fta += shot.fta[i];
  }
}

function addSplit(acc: Acc[], key: keyof Acc, values: number[]) {
  for (let i = 0; i < acc.length; i++) acc[i][key] += values[i] ?? 0;
}

function possForGame(away: NbaTeam, home: NbaTeam, rng: Rng) {
  return clampInt(skewed(rng, (away.pace + home.pace) / 2, 3.1), 90, 116);
}

function sideFrom(team: NbaTeam, acc: Acc[], quarters: number[]): NbaSide {
  const players: NbaPlayerLine[] = team.players
    .map((p, i) => ({
      name: p.name,
      pos: p.pos,
      min: acc[i].min,
      pts: acc[i].pts,
      reb: acc[i].reb,
      ast: acc[i].ast,
      stl: acc[i].stl,
      blk: acc[i].blk,
      tov: acc[i].tov,
      fgm: acc[i].fgm,
      fga: acc[i].fga,
      tpm: acc[i].tpm,
      tpa: acc[i].tpa,
      ftm: acc[i].ftm,
      fta: acc[i].fta,
    }))
    .sort((a, b) => b.pts - a.pts || b.min - a.min);
  return {
    id: team.id,
    abbr: team.abbr,
    score: quarters.reduce((s, n) => s + n, 0),
    quarters,
    players,
  };
}

export function simulateNbaGame(away: NbaTeam, home: NbaTeam, rng: Rng, detail: boolean): NbaGame {
  const poss = possForGame(away, home, rng);
  const base = Math.floor(poss / 4);
  const extra = poss - base * 4;
  const chunks = [base, base, base, base + extra];
  const accA = blank(away.players.length);
  const accH = blank(home.players.length);
  const qA: number[] = [];
  const qH: number[] = [];
  const log: QuarterNote[] = [];

  const playBlock = (label: string, possN: number) => {
    const shotA = shoot(away, home, possN, false, rng);
    const shotH = shoot(home, away, possN, true, rng);
    addShot(accA, shotA);
    addShot(accH, shotH);

    const availA = Math.round(shotA.misses * 0.9);
    const availH = Math.round(shotH.misses * 0.9);
    const orbA = binomial(rng, availA, clamp(away.orb * (0.9 + rng() * 0.2), 0.16, 0.38));
    const orbH = binomial(rng, availH, clamp(home.orb * (0.9 + rng() * 0.2), 0.16, 0.38));
    const drbH = Math.max(0, availA - orbA);
    const drbA = Math.max(0, availH - orbH);
    addSplit(accA, "reb", splitInt(orbA + drbA, away.players.map((p) => p.reb * p.min)));
    addSplit(accH, "reb", splitInt(orbH + drbH, home.players.map((p) => p.reb * p.min)));

    const fgmA = shotA.fgm.reduce((s, n) => s + n, 0);
    const fgmH = shotH.fgm.reduce((s, n) => s + n, 0);
    const astA = clampInt(fgmA * (0.54 + rng() * 0.14), 0, fgmA);
    const astH = clampInt(fgmH * (0.54 + rng() * 0.14), 0, fgmH);
    addSplit(accA, "ast", splitInt(astA, away.players.map((p) => p.ast * p.min)));
    addSplit(accH, "ast", splitInt(astH, home.players.map((p) => p.ast * p.min)));

    const stlA = clampInt(shotH.teamTov * (0.42 + rng() * 0.16), 0, shotH.teamTov);
    const stlH = clampInt(shotA.teamTov * (0.42 + rng() * 0.16), 0, shotA.teamTov);
    addSplit(accA, "stl", splitInt(stlA, away.players.map((p) => p.stl * p.min)));
    addSplit(accH, "stl", splitInt(stlH, home.players.map((p) => p.stl * p.min)));

    const blkA = clampInt(shotH.missed2 * 0.075 * away.def * (0.8 + rng() * 0.4), 0, shotH.missed2);
    const blkH = clampInt(shotA.missed2 * 0.075 * home.def * (0.8 + rng() * 0.4), 0, shotA.missed2);
    addSplit(accA, "blk", splitInt(blkA, away.players.map((p) => p.blk * p.min + 0.05)));
    addSplit(accH, "blk", splitInt(blkH, home.players.map((p) => p.blk * p.min + 0.05)));

    qA.push(shotA.teamPts);
    qH.push(shotH.teamPts);
    if (detail) {
      let ai = 0;
      let hi = 0;
      for (let i = 1; i < shotA.pts.length; i++) if (shotA.pts[i] > shotA.pts[ai]) ai = i;
      for (let i = 1; i < shotH.pts.length; i++) if (shotH.pts[i] > shotH.pts[hi]) hi = i;
      const aName = away.players[ai].name;
      const hName = home.players[hi].name;
      const leader = shotA.pts[ai] === shotH.pts[hi] ? `${aName} and ${hName} each scored ${shotA.pts[ai]}` : shotA.pts[ai] > shotH.pts[hi] ? `${aName} scored ${shotA.pts[ai]}` : `${hName} scored ${shotH.pts[hi]}`;
      log.push({
        quarter: label,
        text: `${leader}. Quarter score ${away.abbr} ${shotA.teamPts}, ${home.abbr} ${shotH.teamPts}.`,
      });
    }
  };

  let runningA = 0;
  let runningH = 0;
  for (let i = 0; i < chunks.length; i++) {
    let possN = chunks[i];
    if (i >= 2 && Math.abs(runningH - runningA) >= 18) possN = Math.max(16, Math.round(possN * (i === 3 ? 0.86 : 0.93)));
    const beforeA = qA.reduce((s, n) => s + n, 0);
    const beforeH = qH.reduce((s, n) => s + n, 0);
    playBlock(`Q${i + 1}`, possN);
    runningA += qA.reduce((s, n) => s + n, 0) - beforeA;
    runningH += qH.reduce((s, n) => s + n, 0) - beforeH;
  }
  let otRounds = 0;
  while (qA.reduce((s, n) => s + n, 0) === qH.reduce((s, n) => s + n, 0) && otRounds < 3) {
    otRounds += 1;
    const otPoss = clampInt(poss / 8, 8, 14);
    playBlock(otRounds === 1 ? "OT" : `OT${otRounds}`, otPoss);
  }

  const minTarget = 240 + otRounds * 25;
  const minA = splitInt(
    minTarget,
    away.players.map((p) => Math.max(6, p.min * (0.88 + rng() * 0.24))),
  );
  const minH = splitInt(
    minTarget,
    home.players.map((p) => Math.max(6, p.min * (0.88 + rng() * 0.24))),
  );
  minA.forEach((m, i) => (accA[i].min = m));
  minH.forEach((m, i) => (accH[i].min = m));

  const awaySide = sideFrom(away, accA, qA);
  const homeSide = sideFrom(home, accH, qH);
  return {
    away: awaySide,
    home: homeSide,
    log: detail ? log : [],
    narrative: narrate(away, home, awaySide, homeSide),
    notes: nbaNotes(awaySide, homeSide),
    ot: otRounds > 0,
  };
}

function narrate(away: NbaTeam, home: NbaTeam, a: NbaSide, h: NbaSide) {
  const tie = a.score === h.score;
  const homeWon = h.score > a.score;
  const winner = homeWon ? home : away;
  const loser = homeWon ? away : home;
  const margin = Math.abs(a.score - h.score);
  const verb = margin >= 15 ? "pulled away from" : margin <= 4 ? "edged" : "beat";
  const lead = tie
    ? `${away.city} and ${home.city} finished tied at ${a.score}.`
    : `${winner.city} ${verb} ${loser.city} ${Math.max(a.score, h.score)}–${Math.min(a.score, h.score)}.`;
  const star = [...a.players, ...h.players].sort((x, y) => y.pts - x.pts)[0];
  const team = a.players.some((p) => p.name === star.name) ? a.abbr : h.abbr;
  const starLine = star
    ? `${star.name} (${team}) led the game with ${star.pts} points, ${star.reb} rebounds and ${star.ast} assists on ${star.fgm}-${star.fga} shooting.`
    : "";
  return [lead, starLine].filter(Boolean).join(" ");
}

function pct(m: number, a: number) {
  if (a <= 0) return "—";
  return `${Math.round((m / a) * 100)}%`;
}

function sumSide(side: NbaSide) {
  return side.players.reduce(
    (s, p) => ({
      fgm: s.fgm + p.fgm,
      fga: s.fga + p.fga,
      tpm: s.tpm + p.tpm,
      tpa: s.tpa + p.tpa,
      ftm: s.ftm + p.ftm,
      fta: s.fta + p.fta,
      reb: s.reb + p.reb,
      ast: s.ast + p.ast,
      tov: s.tov + p.tov,
    }),
    { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, ast: 0, tov: 0 },
  );
}

function nbaNotes(a: NbaSide, h: NbaSide) {
  const as = sumSide(a);
  const hs = sumSide(h);
  return [
    `Shooting: ${a.abbr} ${pct(as.fgm, as.fga)} FG, ${h.abbr} ${pct(hs.fgm, hs.fga)}.`,
    `Threes: ${a.abbr} ${as.tpm}-${as.tpa}, ${h.abbr} ${hs.tpm}-${hs.tpa}.`,
    `Rebounds ${a.abbr} ${as.reb} / ${h.abbr} ${hs.reb}. Assists ${as.ast} / ${hs.ast}. Turnovers ${as.tov} / ${hs.tov}.`,
  ];
}

const CENTERS = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25];

function emptyBin() {
  return CENTERS.map((c, i) => ({
    label: `${c > 0 ? "+" : ""}${c}`,
    count: 0,
    hint:
      i === 0
        ? "Home margin −28 or worse"
        : i === CENTERS.length - 1
          ? "Home margin +28 or better"
          : `Home margin near ${c > 0 ? "+" : ""}${c}`,
  }));
}

function binIndex(margin: number) {
  if (margin <= -28) return 0;
  if (margin >= 28) return CENTERS.length - 1;
  const idx = Math.round((margin - CENTERS[0]) / 5);
  return Math.min(CENTERS.length - 1, Math.max(0, idx));
}

function addProj(map: Map<string, NbaProjPlayer>, line: NbaPlayerLine, n: number) {
  const cur = map.get(line.name) ?? {
    name: line.name,
    pos: line.pos,
    min: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
  };
  cur.min += line.min / n;
  cur.pts += line.pts / n;
  cur.reb += line.reb / n;
  cur.ast += line.ast / n;
  cur.stl += line.stl / n;
  cur.blk += line.blk / n;
  cur.tov += line.tov / n;
  cur.fgm += line.fgm / n;
  cur.fga += line.fga / n;
  cur.tpm += line.tpm / n;
  cur.tpa += line.tpa / n;
  cur.ftm += line.ftm / n;
  cur.fta += line.fta / n;
  map.set(line.name, cur);
}

export function projectNba(away: NbaTeam, home: NbaTeam, rng: Rng, n: number): NbaProj {
  let homeWin = 0;
  let awayWin = 0;
  let tie = 0;
  let sumHome = 0;
  let sumAway = 0;
  const bins = emptyBin();
  const awayMap = new Map<string, NbaProjPlayer>();
  const homeMap = new Map<string, NbaProjPlayer>();
  for (let i = 0; i < n; i++) {
    const g = simulateNbaGame(away, home, rng, false);
    const blended = blendScore(g.away.score, g.home.score, home.line ?? away.line);
    if (g.away.score > 0) {
      const f = blended.away / g.away.score;
      for (const p of g.away.players) p.pts *= f;
    }
    if (g.home.score > 0) {
      const f = blended.home / g.home.score;
      for (const p of g.home.players) p.pts *= f;
    }
    g.away.score = blended.away;
    g.home.score = blended.home;
    sumHome += g.home.score;
    sumAway += g.away.score;
    if (g.home.score > g.away.score) homeWin += 1;
    else if (g.home.score < g.away.score) awayWin += 1;
    else tie += 1;
    bins[binIndex(g.home.score - g.away.score)].count += 1;
    for (const p of g.away.players) addProj(awayMap, p, n);
    for (const p of g.home.players) addProj(homeMap, p, n);
  }
  const sort = (list: NbaProjPlayer[]) => [...list].sort((a, b) => b.pts - a.pts);
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
  };
}
