export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshRng(): Rng {
  const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
  return mulberry32(seed || 1);
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

export function clampInt(n: number, lo: number, hi: number) {
  return Math.round(clamp(n, lo, hi));
}

export function normal(rng: Rng, mean: number, sd: number) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
  return mean + sd * z;
}

export function binomial(rng: Rng, n: number, p: number) {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n > 48) {
    return clampInt(normal(rng, n * p, Math.sqrt(n * p * (1 - p))), 0, n);
  }
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

export function weightedIndex(rng: Rng, weights: number[]) {
  let sum = 0;
  for (const w of weights) sum += Math.max(0, w);
  if (sum <= 0) return 0;
  let r = rng() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

export function splitInt(total: number, weights: number[]) {
  const n = weights.length;
  if (n === 0) return [];
  if (total <= 0) return weights.map(() => 0);
  const safe = weights.map((w) => Math.max(0, w));
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const out = safe.map(() => 0);
    out[0] = total;
    return out;
  }
  const raw = safe.map((w) => (w / sum) * total);
  const floors = raw.map((v) => Math.floor(v));
  let left = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < left; k++) floors[order[k % order.length].i] += 1;
  return floors;
}

/** Integers that sum to `total`, each between min and cap when possible. */
export function allocate(total: number, weights: number[], mins: number[], caps: number[]) {
  const n = weights.length;
  const out = mins.map((m) => Math.max(0, m));
  const used = out.reduce((a, b) => a + b, 0);
  if (used > total) {
    let over = used - total;
    const order = out.map((v, i) => ({ i, spare: v })).sort((a, b) => b.spare - a.spare);
    for (const o of order) {
      if (over <= 0) break;
      const take = Math.min(over, out[o.i]);
      out[o.i] -= take;
      over -= take;
    }
    return out;
  }
  let left = total - used;
  const room = caps.map((c, i) => Math.max(0, c - out[i]));
  const roomSum = room.reduce((a, b) => a + b, 0);
  if (left <= 0 || roomSum <= 0) return out;
  if (left > roomSum) left = roomSum;
  const add = splitInt(
    left,
    room.map((r, i) => r * Math.max(0.01, weights[i])),
  );
  for (let i = 0; i < n; i++) out[i] += Math.min(room[i], add[i]);
  let drift = out.reduce((a, b) => a + b, 0) - (used + left);
  let guard = 0;
  while (drift !== 0 && guard++ < n * 4) {
    if (drift > 0) {
      const i = out.findIndex((v, idx) => v > mins[idx]);
      if (i < 0) break;
      out[i] -= 1;
      drift -= 1;
    } else {
      const i = out.findIndex((v, idx) => v < caps[idx]);
      if (i < 0) break;
      out[i] += 1;
      drift += 1;
    }
  }
  return out;
}

export function scaleToSum(values: number[], target: number) {
  const n = values.length;
  if (n === 0) return [];
  if (target <= 0) return values.map(() => 0);
  const sum = values.reduce((a, b) => a + Math.max(0, b), 0);
  const base = sum <= 0 ? values.map((_, i) => (i === 0 ? target : 0)) : values.map((v) => (Math.max(0, v) / sum) * target);
  const rounded = base.map((v) => Math.max(0, Math.round(v)));
  let drift = target - rounded.reduce((a, b) => a + b, 0);
  const order = rounded.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
  let guard = 0;
  while (drift !== 0 && guard++ < 30) {
    let moved = false;
    for (const o of order) {
      if (drift === 0) break;
      if (drift > 0) {
        rounded[o.i] += 1;
        drift -= 1;
        moved = true;
      } else if (rounded[o.i] > 0) {
        rounded[o.i] -= 1;
        drift += 1;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return rounded;
}

/** Shift values so they sum to target without dropping below floors. */
export function fitToTarget(values: number[], target: number, floors: number[]) {
  const out = values.map((v, i) => Math.max(floors[i] ?? 0, Math.round(v)));
  let drift = target - out.reduce((a, b) => a + b, 0);
  if (drift > 0 && out.length) {
    let host = 0;
    for (let i = 1; i < out.length; i++) if (out[i] > out[host]) host = i;
    out[host] += drift;
    return out;
  }
  let guard = 0;
  while (drift < 0 && guard++ < 300) {
    let moved = false;
    for (let i = 0; i < out.length && drift < 0; i++) {
      const spare = out[i] - (floors[i] ?? 0);
      if (spare <= 0) continue;
      const take = Math.min(spare, -drift);
      out[i] -= take;
      drift += take;
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}
