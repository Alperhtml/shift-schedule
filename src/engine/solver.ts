import type { Assignment, Schedule } from './types';
import { DAYS, NIGHT_GAP_MIN, QUOTA, SLOTS } from './types';
import { createRng, type Rng } from './random';
import { at, get, inc } from './util';

export interface SolveOptions {
  seed: number;
  restarts?: number;
  moves?: number;
  t0?: number;
  t1?: number;
  guided?: number;
}

export interface SolveResult {
  assignments: Assignment[];
  cost: number;
  restartsUsed: number;
  shortSlots: number;
}

interface InternState {
  nights: number[];
  days: number[];
  nightMask: boolean[];
  dayMask: boolean[];
  lockedNights: ReadonlySet<number>;
  lockedDays: ReadonlySet<number>;
}

interface Params {
  n: number;
  min: number;
  avg: number;
  moves: number;
  t0: number;
  t1: number;
  guided: number;
}

const W_UNDER = 10;
const W_HIGH = 3;
const W_WEEK = 0.5;
const DENSITY_CAP = 3;
// 5 000 nodes exhausts when locked day shifts constrain the night search, which
// returned a 7-night set and broke the "no incomplete quota" guarantee. Measured:
// 0 failures in 20 000 seeds of the worst lock shape at 20 000 nodes (peak 9 941).
const DFS_BUDGET = 20_000;

function slotCost(count: number, min: number, avg: number): number {
  const under = Math.max(0, min - count);
  const high = Math.max(0, count - DENSITY_CAP);
  return W_UNDER * under * under + (count - avg) * (count - avg) + W_HIGH * high * high;
}

function weekCost(w: number): number {
  return W_WEEK * (w - 4) * (w - 4);
}

function mask(list: readonly number[]): boolean[] {
  const m = new Array<boolean>(DAYS).fill(false);
  for (const d of list) m[d] = true;
  return m;
}

function has(m: readonly boolean[], d: number): boolean {
  return m[d] ?? false;
}

function nightOkList(d: number, nights: readonly number[], lockedDays: ReadonlySet<number>): boolean {
  if (lockedDays.has(d) || lockedDays.has(d + 1)) return false;
  for (const x of nights) if (Math.abs(d - x) < NIGHT_GAP_MIN) return false;
  return true;
}

/** Step 1: eight nights, locked ones included, gap >= 3, avoiding locked days.
    Randomised depth-first search with a node budget. */
function buildNights(rng: Rng, locked: readonly number[], lockedDays: ReadonlySet<number>): number[] {
  if (locked.length >= QUOTA) return [...locked];
  const order = rng.shuffle(Array.from({ length: DAYS }, (_, i) => i));
  const cur = [...locked];
  let best = [...cur];
  let budget = DFS_BUDGET;
  const rec = (start: number): boolean => {
    if (cur.length > best.length) best = [...cur];
    if (cur.length === QUOTA) return true;
    for (let i = start; i < DAYS; i++) {
      budget -= 1;
      if (budget <= 0) return false;
      const d = at(order, i);
      if (cur.includes(d) || !nightOkList(d, cur, lockedDays)) continue;
      cur.push(d);
      if (rec(i + 1)) return true;
      cur.pop();
    }
    return false;
  };
  rec(0);
  return best;
}

/** Step 2: eight days from the dates the nights leave legal, locked ones kept. */
function buildDays(rng: Rng, nights: readonly number[], locked: readonly number[]): number[] {
  const nm = mask(nights);
  const avail: number[] = [];
  for (let d = 0; d < DAYS; d++) {
    if (!has(nm, d) && !has(nm, d - 1) && !locked.includes(d)) avail.push(d);
  }
  rng.shuffle(avail);
  return [...locked, ...avail.slice(0, Math.max(0, QUOTA - locked.length))];
}

function nightLegal(d2: number, s: InternState, ignore: number): boolean {
  if (has(s.dayMask, d2) || has(s.dayMask, d2 + 1)) return false;
  for (let x = d2 - NIGHT_GAP_MIN + 1; x <= d2 + NIGHT_GAP_MIN - 1; x++) {
    if (x !== ignore && has(s.nightMask, x)) return false;
  }
  return true;
}

function dayLegal(d2: number, s: InternState): boolean {
  return !has(s.nightMask, d2) && !has(s.nightMask, d2 - 1);
}

function cloneState(state: readonly InternState[]): InternState[] {
  return state.map(s => ({
    nights: [...s.nights],
    days: [...s.days],
    nightMask: [...s.nightMask],
    dayMask: [...s.dayMask],
    lockedNights: s.lockedNights,
    lockedDays: s.lockedDays,
  }));
}

function slotCounts(state: readonly InternState[]): number[] {
  const cnt = new Array<number>(SLOTS).fill(0);
  for (const s of state) {
    for (const d of s.days) inc(cnt, d * 2, 1);
    for (const d of s.nights) inc(cnt, d * 2 + 1, 1);
  }
  return cnt;
}

function totalCost(state: readonly InternState[], p: Params): number {
  const cnt = slotCounts(state);
  let c = 0;
  for (let k = 0; k < SLOTS; k++) c += slotCost(get(cnt, k), p.min, p.avg);
  for (const s of state) {
    const w = [0, 0, 0, 0];
    for (const d of s.days) inc(w, Math.floor(d / 7), 1);
    for (const d of s.nights) inc(w, Math.floor(d / 7), 1);
    for (const x of w) c += weekCost(x);
  }
  return c;
}

/** Step 3: simulated annealing with plateau acceptance and guided moves.
    Mutates `state` and returns the best copy seen. */
function anneal(state: InternState[], rng: Rng, p: Params): { cost: number; state: InternState[] } {
  const cnt = slotCounts(state);
  const wk = new Array<number>(p.n * 4).fill(0);
  state.forEach((s, i) => {
    for (const d of s.days) inc(wk, i * 4 + Math.floor(d / 7), 1);
    for (const d of s.nights) inc(wk, i * 4 + Math.floor(d / 7), 1);
  });
  let cost = totalCost(state, p);
  let bestCost = cost;
  let bestState = cloneState(state);
  const short: number[] = [];
  const movable: number[] = [];

  for (let m = 0; m < p.moves; m++) {
    const temp = p.t0 * Math.pow(p.t1 / p.t0, m / p.moves);
    let i = rng.int(p.n);
    let t: 0 | 1 = rng.next() < 0.5 ? 0 : 1;
    let d2 = rng.int(DAYS);

    if (rng.next() < p.guided) {
      short.length = 0;
      for (let k = 0; k < SLOTS; k++) if (get(cnt, k) < p.min) short.push(k);
      if (short.length > 0) {
        const k = rng.pick(short);
        d2 = Math.floor(k / 2);
        t = k % 2 === 1 ? 1 : 0;
        i = rng.int(p.n);
      }
    }

    const s = at(state, i);
    const list = t === 1 ? s.nights : s.days;
    const own = t === 1 ? s.nightMask : s.dayMask;
    if (has(own, d2)) continue;

    const lockedSet = t === 1 ? s.lockedNights : s.lockedDays;
    movable.length = 0;
    for (const d of list) if (!lockedSet.has(d)) movable.push(d);
    if (movable.length === 0) continue;
    const d1 = at(movable, rng.int(movable.length));
    if (!(t === 1 ? nightLegal(d2, s, d1) : dayLegal(d2, s))) continue;

    const c1 = get(cnt, d1 * 2 + t);
    const c2 = get(cnt, d2 * 2 + t);
    let delta = slotCost(c1 - 1, p.min, p.avg) - slotCost(c1, p.min, p.avg)
      + slotCost(c2 + 1, p.min, p.avg) - slotCost(c2, p.min, p.avg);
    const w1 = Math.floor(d1 / 7);
    const w2 = Math.floor(d2 / 7);
    if (w1 !== w2) {
      const a = get(wk, i * 4 + w1);
      const b = get(wk, i * 4 + w2);
      delta += weekCost(a - 1) - weekCost(a) + weekCost(b + 1) - weekCost(b);
    }

    if (delta <= 0 || rng.next() < Math.exp(-delta / temp)) {
      list[list.indexOf(d1)] = d2;
      own[d1] = false;
      own[d2] = true;
      inc(cnt, d1 * 2 + t, -1);
      inc(cnt, d2 * 2 + t, 1);
      if (w1 !== w2) {
        inc(wk, i * 4 + w1, -1);
        inc(wk, i * 4 + w2, 1);
      }
      cost += delta;
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        bestState = cloneState(state);
      }
    }
  }
  return { cost: totalCost(bestState, p), state: bestState };
}

function isIdeal(state: readonly InternState[], min: number, ceilAvg: number): boolean {
  // A restart that could not place all sixteen shifts is never ideal, however
  // well its slot counts happen to read.
  for (const s of state) if (s.nights.length !== QUOTA || s.days.length !== QUOTA) return false;
  const cnt = slotCounts(state);
  for (let k = 0; k < SLOTS; k++) {
    const c = get(cnt, k);
    if (c < min || c > ceilAvg) return false;
  }
  return true;
}

function countShort(state: readonly InternState[], min: number): number {
  const cnt = slotCounts(state);
  let n = 0;
  for (let k = 0; k < SLOTS; k++) if (get(cnt, k) < min) n += 1;
  return n;
}

/** Never throws. Locked assignments come back unchanged; unlocked ones are replaced. */
export function solve(schedule: Schedule, options: SolveOptions): SolveResult {
  const n = schedule.interns.length;
  const p: Params = {
    n,
    min: schedule.minPerShift,
    avg: (16 * n) / 56,
    moves: options.moves ?? 400_000,
    t0: options.t0 ?? 3,
    t1: options.t1 ?? 0.05,
    guided: options.guided ?? 0.3,
  };
  const restarts = Math.max(1, options.restarts ?? 4);
  const ceilAvg = Math.ceil(p.avg);
  const locked = schedule.assignments.filter(a => a.locked);

  const run = (r: number): { cost: number; state: InternState[] } => {
    const rng = createRng(options.seed + r * 7919);
    const state: InternState[] = schedule.interns.map(intern => {
      const ln = locked.filter(a => a.internId === intern.id && a.type === 'NIGHT').map(a => a.dayIndex);
      const ld = locked.filter(a => a.internId === intern.id && a.type === 'DAY').map(a => a.dayIndex);
      const nights = buildNights(rng, ln, new Set(ld));
      const days = buildDays(rng, nights, ld);
      return { nights, days, nightMask: mask(nights), dayMask: mask(days), lockedNights: new Set(ln), lockedDays: new Set(ld) };
    });
    return anneal(state, rng, p);
  };

  let best = run(0);
  let restartsUsed = 1;
  for (let r = 1; r < restarts && !isIdeal(best.state, p.min, ceilAvg); r++) {
    restartsUsed = r + 1;
    const cand = run(r);
    if (cand.cost < best.cost) best = cand;
  }

  const assignments: Assignment[] = [];
  schedule.interns.forEach((intern, k) => {
    const s = at(best.state, k);
    for (const d of s.days) assignments.push({ internId: intern.id, dayIndex: d, type: 'DAY', locked: s.lockedDays.has(d) });
    for (const d of s.nights) assignments.push({ internId: intern.id, dayIndex: d, type: 'NIGHT', locked: s.lockedNights.has(d) });
  });
  const order = new Map(schedule.interns.map(i => [i.id, i.index] as const));
  assignments.sort((a, b) =>
    a.dayIndex - b.dayIndex
    || (a.type === b.type ? 0 : a.type === 'DAY' ? -1 : 1)
    || (order.get(a.internId) ?? 0) - (order.get(b.internId) ?? 0));

  return { assignments, cost: best.cost, restartsUsed, shortSlots: countShort(best.state, p.min) };
}
