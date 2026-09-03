import { describe, it, expect } from 'vitest';
import { createSchedule, counts } from '../schedule';
import { validate } from '../rules';
import { solve } from '../solver';
import { createRng } from '../random';
import type { Schedule } from '../types';

const FAST = { moves: 20_000, restarts: 2 };
const errorsOf = (s: Schedule) => validate(s).filter(v => v.severity === 'error');
const withAssignments = (s: Schedule, assignments: Schedule['assignments']): Schedule => ({ ...s, assignments });

describe('solve: hard rules', () => {
  for (let n = 4; n <= 8; n++) {
    it(`N=${n}: 50 seeds, zero errors, full quota, nothing locked`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        const s = createSchedule('2026-09-07', n);
        const r = solve(s, { seed, ...FAST });
        const out = withAssignments(s, r.assignments);
        expect(errorsOf(out)).toEqual([]);
        for (const i of s.interns) expect(counts(out, i.id)).toEqual({ day: 8, night: 8 });
        expect(r.assignments.some(a => a.locked)).toBe(false);
        expect(r.assignments).toHaveLength(16 * n);
      }
    });
  }
  it('is deterministic per seed and varies across seeds', () => {
    const s = createSchedule('2026-09-07', 6);
    expect(solve(s, { seed: 5, ...FAST })).toEqual(solve(s, { seed: 5, ...FAST }));
    expect(solve(s, { seed: 5, ...FAST }).assignments).not.toEqual(solve(s, { seed: 6, ...FAST }).assignments);
  });
  it('preserves 20% locked cells of a valid solution and stays valid, 20 seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const base = createSchedule('2026-09-07', 5 + (seed % 4));
      const first = solve(base, { seed, ...FAST });
      const rng = createRng(seed * 31);
      const locked = first.assignments.map(a => ({ ...a, locked: rng.next() < 0.2 }));
      const pinned = locked.filter(a => a.locked);
      const second = solve(withAssignments(base, locked), { seed: seed + 100, ...FAST });
      const out = withAssignments(base, second.assignments);
      for (const p of pinned) expect(second.assignments).toContainEqual(p);
      expect(errorsOf(out)).toEqual([]);
      for (const i of base.interns) expect(counts(out, i.id)).toEqual({ day: 8, night: 8 });
    }
  });
  it('keeps contradictory locks and lets validate report them', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = [
      { internId: 'intern-1', dayIndex: 5, type: 'NIGHT', locked: true },
      { internId: 'intern-1', dayIndex: 6, type: 'NIGHT', locked: true },
    ];
    const r = solve(s, { seed: 3, ...FAST });
    const out = withAssignments(s, r.assignments);
    expect(r.assignments.filter(a => a.locked)).toHaveLength(2);
    expect(counts(out, 'intern-1')).toEqual({ day: 8, night: 8 });
    expect(validate(out).some(v => v.code === 'NIGHT_GAP' && v.internId === 'intern-1')).toBe(true);
  });
  it('completes every quota when locked day shifts constrain the night search', () => {
    // This lock shape exhausted the old 5 000-node search budget and returned a
    // seven-night set, which validate() then reported as an incomplete quota.
    const s = createSchedule('2026-09-07', 6);
    s.assignments = [
      { internId: 'intern-2', dayIndex: 25, type: 'NIGHT', locked: true },
      { internId: 'intern-2', dayIndex: 8, type: 'DAY', locked: true },
      { internId: 'intern-2', dayIndex: 10, type: 'DAY', locked: true },
    ];
    for (const seed of [19, 3, 77, 512]) {
      const r = solve(s, { seed });
      const out = withAssignments(s, r.assignments);
      expect(errorsOf(out)).toEqual([]);
      expect(validate(out).filter(v => v.code === 'QUOTA_INCOMPLETE')).toEqual([]);
      for (const i of s.interns) expect(counts(out, i.id)).toEqual({ day: 8, night: 8 });
    }
  });

  it('adds nothing for a type that is already over quota by locks', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = Array.from({ length: 9 }, (_, k) => ({ internId: 'intern-1', dayIndex: k * 3, type: 'NIGHT' as const, locked: true }));
    const r = solve(s, { seed: 3, ...FAST });
    expect(r.assignments.filter(a => a.internId === 'intern-1' && a.type === 'NIGHT')).toHaveLength(9);
    expect(r.assignments.filter(a => a.internId === 'intern-1' && a.type === 'DAY')).toHaveLength(8);
  });
});

describe('solve: staffing quality at defaults', () => {
  it('N=4 target 1 -> no short slot', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = createSchedule('2026-09-07', 4);
      expect(solve(s, { seed }).shortSlots).toBe(0);
    }
  });
  it('N=8 target 2 -> no short slot', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const s = createSchedule('2026-09-07', 8);
      expect(solve(s, { seed }).shortSlots).toBe(0);
    }
  });
  it('N=7 target 2 -> every seed <= 2 short, at least 7 of 10 perfect', () => {
    let perfect = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const s = createSchedule('2026-09-07', 7);
      const r = solve(s, { seed });
      expect(r.shortSlots).toBeLessThanOrEqual(2);
      if (r.shortSlots === 0) perfect += 1;
    }
    expect(perfect).toBeGreaterThanOrEqual(7);
  });
  it('N=8 at defaults finishes under 2 s', () => {
    const s = createSchedule('2026-09-07', 8);
    const t = performance.now();
    solve(s, { seed: 1 });
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
