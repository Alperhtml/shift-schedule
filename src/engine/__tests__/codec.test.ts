import { describe, it, expect } from 'vitest';
import { createSchedule } from '../schedule';
import { decodeHash, encodeHash, isSchedule } from '../codec';
import { solve } from '../solver';
import { createRng } from '../random';
import type { Schedule } from '../types';

function randomSchedule(seed: number): Schedule {
  const rng = createRng(seed);
  const n = 4 + rng.int(5);
  const s = createSchedule('2026-09-07', n);
  s.minPerShift = 1 + rng.int(4);
  s.interns = s.interns.map((i, k) => {
    const realName = k % 2 === 0 ? `Dr. Şükrü ${k} İğne` : '';
    return { ...i, realName, pinned: realName !== '' };
  });
  if (rng.next() < 0.5) s.namePool = ['Ayşe Yılmaz', 'Mehmet Demir', `Zeynep ${n}`];
  s.assignments = solve(s, { seed, moves: 2000, restarts: 1 }).assignments.map(a => ({ ...a, locked: rng.next() < 0.3 }));
  return s;
}

describe('hash codec', () => {
  it('round-trips 200 random schedules', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = randomSchedule(seed);
      expect(decodeHash(encodeHash(s))).toEqual(s);
    }
  });
  it('carries the name pool, and a link written before it existed still opens', () => {
    const s = createSchedule('2026-09-07', 4);
    s.namePool = ['Ayşe Yılmaz', 'Mehmet Demir'];
    const back = decodeHash(encodeHash(s));
    expect(back?.namePool).toEqual(['Ayşe Yılmaz', 'Mehmet Demir']);
    // Six fields, the shape used before the pool existed.
    const old = decodeHash(`v1.20260907.4.1..${'0'.repeat(224)}`);
    expect(old?.namePool).toEqual([]);
    expect(old?.interns).toHaveLength(4);
  });

  it('encodes blank names as an empty field and is short', () => {
    const s = createSchedule('2026-09-07', 4);
    const h = encodeHash(s);
    expect(h).toBe(`v1.20260907.4.1..${'0'.repeat(224)}`);
    expect(h.length).toBeLessThan(600);
  });
  it('rejects malformed input', () => {
    const good = encodeHash(randomSchedule(3));
    expect(decodeHash('#' + good)).not.toBeNull();
    expect(decodeHash(good.replace('v1.', 'v2.'))).toBeNull();
    expect(decodeHash(good.replace('20260907', '20260908'))).toBeNull();
    expect(decodeHash(good.slice(0, -1))).toBeNull();
    expect(decodeHash(good.slice(0, -1) + '3')).toBeNull();
    expect(decodeHash(good.replace(/\.(\d)\.(\d)\./, '.9.$2.'))).toBeNull();
    expect(decodeHash(good.replace(/\.(\d)\.(\d)\./, '.$1.7.'))).toBeNull();
    expect(decodeHash('')).toBeNull();
    expect(decodeHash('v1.20260907.4.1.!!!.' + '0'.repeat(224))).toBeNull();
  });
});

describe('names leaving the app', () => {
  it('the hash carries trimmed names', () => {
    const s = createSchedule('2026-09-07', 4);
    s.interns = s.interns.map((i, k) => ({ ...i, realName: k === 0 ? '  Ayşe Yılmaz  ' : k === 1 ? '  ' : '' }));
    const back = decodeHash(encodeHash(s));
    expect(back?.interns.map(i => i.realName)).toEqual(['Ayşe Yılmaz', '', '', '']);
  });
});

describe('isSchedule', () => {
  it('accepts a valid schedule and rejects each broken invariant', () => {
    const s = randomSchedule(9);
    expect(isSchedule(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(isSchedule({ ...s, version: 2 })).toBeNull();
    expect(isSchedule({ ...s, startDate: '2026-09-08' })).toBeNull();
    expect(isSchedule({ ...s, interns: s.interns.slice(0, 3) })).toBeNull();
    expect(isSchedule({ ...s, minPerShift: 0 })).toBeNull();
    expect(isSchedule({ ...s, assignments: [...s.assignments, { internId: 'intern-9', dayIndex: 0, type: 'DAY', locked: false }] })).toBeNull();
    expect(isSchedule({ ...s, assignments: [...s.assignments, { ...s.assignments[0] }] })).toBeNull();
    expect(isSchedule({ ...s, assignments: [{ internId: 'intern-1', dayIndex: 28, type: 'DAY', locked: false }] })).toBeNull();
    expect(isSchedule('nope')).toBeNull();
  });
});
