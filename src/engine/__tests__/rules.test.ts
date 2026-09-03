import { describe, it, expect } from 'vitest';
import { createSchedule } from '../schedule';
import { internPatternValid, validate, wouldViolate } from '../rules';
import type { Assignment, Schedule, ShiftType } from '../types';
import { createRng } from '../random';

function sched(items: [string, number, ShiftType][], n = 4, min = 1): Schedule {
  const s = createSchedule('2026-09-07', n);
  s.minPerShift = min;
  s.assignments = items.map(([internId, dayIndex, type]): Assignment => ({ internId, dayIndex, type, locked: false }));
  return s;
}
const hard = (s: Schedule) => validate(s).filter(v => v.severity === 'error');

describe('rules R1-R3', () => {
  it('Mon night + Tue day -> POST_NIGHT_DAY on (1, DAY)', () => {
    const v = hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 1, 'DAY']]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ code: 'POST_NIGHT_DAY', internId: 'intern-1', dayIndex: 1, type: 'DAY', related: [{ dayIndex: 0, type: 'NIGHT' }] });
  });
  it('Mon night + Wed day -> none', () => {
    expect(hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 2, 'DAY']]))).toHaveLength(0);
  });
  it('Mon night + Tue night -> NIGHT_GAP gap 1', () => {
    const v = hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 1, 'NIGHT']]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ code: 'NIGHT_GAP', dayIndex: 1, type: 'NIGHT', params: { gap: 1 }, related: [{ dayIndex: 0, type: 'NIGHT' }] });
  });
  it('Mon night + Wed night -> NIGHT_GAP gap 2', () => {
    expect(hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 2, 'NIGHT']]))[0]).toMatchObject({ code: 'NIGHT_GAP', params: { gap: 2 } });
  });
  it('Mon night + Thu night -> none', () => {
    expect(hard(sched([['intern-1', 0, 'NIGHT'], ['intern-1', 3, 'NIGHT']]))).toHaveLength(0);
  });
  it('nights on 3,4,5 -> exactly two NIGHT_GAP', () => {
    expect(hard(sched([['intern-1', 3, 'NIGHT'], ['intern-1', 4, 'NIGHT'], ['intern-1', 5, 'NIGHT']])).filter(v => v.code === 'NIGHT_GAP')).toHaveLength(2);
  });
  it('Mon day + Tue day -> none; Mon day + Tue night -> none', () => {
    expect(hard(sched([['intern-1', 0, 'DAY'], ['intern-1', 1, 'DAY']]))).toHaveLength(0);
    expect(hard(sched([['intern-1', 0, 'DAY'], ['intern-1', 1, 'NIGHT']]))).toHaveLength(0);
  });
  it('Mon day + Mon night -> DOUBLE_SHIFT on (0, NIGHT)', () => {
    expect(hard(sched([['intern-1', 0, 'DAY'], ['intern-1', 0, 'NIGHT']]))[0]).toMatchObject({ code: 'DOUBLE_SHIFT', dayIndex: 0, type: 'NIGHT', related: [{ dayIndex: 0, type: 'DAY' }] });
  });
  it('night on day 27 has no post-night check', () => {
    expect(hard(sched([['intern-1', 27, 'NIGHT']]))).toHaveLength(0);
  });
});

describe('quota and staffing', () => {
  it('9 day shifts -> one QUOTA_OVER with count 9 on the last day', () => {
    const items: [string, number, ShiftType][] = Array.from({ length: 9 }, (_, d) => ['intern-1', d, 'DAY']);
    const v = validate(sched(items)).filter(x => x.code === 'QUOTA_OVER');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ severity: 'error', dayIndex: 8, type: 'DAY', params: { count: 9 } });
    expect(v[0]?.related).toHaveLength(9);
  });
  it('QUOTA_INCOMPLETE is info with dayIndex -1, one per intern and type', () => {
    const v = validate(sched([])).filter(x => x.code === 'QUOTA_INCOMPLETE');
    expect(v).toHaveLength(8);
    expect(v[0]).toMatchObject({ severity: 'info', dayIndex: -1, params: { count: 0, missing: 8 } });
  });
  it('empty slot with min 2 -> UNDER_STAFFED count 0 min 2, on all 56 slots', () => {
    const v = validate(sched([], 4, 2)).filter(x => x.code === 'UNDER_STAFFED');
    expect(v).toHaveLength(56);
    expect(v[0]).toMatchObject({ severity: 'warning', params: { count: 0, min: 2 } });
    expect(v[0]?.internId).toBeUndefined();
  });
  it('4 interns in a slot -> HIGH_DENSITY', () => {
    const v = validate(sched([['intern-1', 0, 'DAY'], ['intern-2', 0, 'DAY'], ['intern-3', 0, 'DAY'], ['intern-4', 0, 'DAY']])).filter(x => x.code === 'HIGH_DENSITY');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ severity: 'info', dayIndex: 0, type: 'DAY', params: { count: 4 } });
  });
  it('is sorted errors, warnings, info then dayIndex', () => {
    const v = validate(sched([['intern-2', 5, 'NIGHT'], ['intern-2', 6, 'DAY'], ['intern-1', 0, 'DAY']], 4, 2));
    const sev = v.map(x => x.severity);
    expect(sev.indexOf('warning')).toBeGreaterThan(sev.lastIndexOf('error'));
    expect(sev.indexOf('info')).toBeGreaterThan(sev.lastIndexOf('warning'));
  });
});

describe('wouldViolate', () => {
  it('reports the candidate violation only', () => {
    const s = sched([['intern-1', 0, 'NIGHT'], ['intern-2', 10, 'NIGHT'], ['intern-2', 11, 'NIGHT']], 4, 2);
    const v = wouldViolate(s, { internId: 'intern-1', dayIndex: 1, type: 'DAY' });
    expect(v.map(x => x.code)).toEqual(['POST_NIGHT_DAY']);
  });
  it('never reports UNDER_STAFFED or QUOTA_INCOMPLETE and returns [] for an existing assignment', () => {
    const s = sched([['intern-1', 0, 'DAY']], 4, 2);
    expect(wouldViolate(s, { internId: 'intern-2', dayIndex: 0, type: 'DAY' })).toEqual([]);
    expect(wouldViolate(s, { internId: 'intern-1', dayIndex: 0, type: 'DAY' })).toEqual([]);
  });
  it('reports HIGH_DENSITY when the candidate makes 4', () => {
    const s = sched([['intern-1', 0, 'DAY'], ['intern-2', 0, 'DAY'], ['intern-3', 0, 'DAY']]);
    expect(wouldViolate(s, { internId: 'intern-4', dayIndex: 0, type: 'DAY' }).map(x => x.code)).toEqual(['HIGH_DENSITY']);
  });
});

describe('internPatternValid agrees with validate', () => {
  it('on 1000 random patterns', () => {
    const rng = createRng(11);
    for (let k = 0; k < 1000; k++) {
      const nights = Array.from({ length: rng.int(9) }, () => rng.int(28));
      const days = Array.from({ length: rng.int(9) }, () => rng.int(28));
      const uniq = (a: number[]) => [...new Set(a)];
      const n = uniq(nights);
      const d = uniq(days);
      const s = sched([
        ...n.map((x): [string, number, ShiftType] => ['intern-1', x, 'NIGHT']),
        ...d.map((x): [string, number, ShiftType] => ['intern-1', x, 'DAY']),
      ]);
      const errors = hard(s).filter(v => v.code !== 'QUOTA_OVER');
      expect(internPatternValid(n, d)).toBe(errors.length === 0);
    }
  });
});
