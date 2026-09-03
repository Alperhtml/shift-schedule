import { describe, it, expect } from 'vitest';
import { createSchedule, counts } from '../../../engine/schedule';
import { solve } from '../../../engine/solver';
import { validate } from '../../../engine/rules';
import { ghostSeverity, scheduleAfterPickUp } from '../DndProvider';
import type { Schedule, ShiftType } from '../../../engine/types';

const filled = (): Schedule => {
  const s = createSchedule('2026-09-07', 6);
  s.assignments = solve(s, { seed: 4 }).assignments;
  return s;
};

describe('ghostSeverity', () => {
  it('does not count the shift being moved against its own destination', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = [{ internId: 'intern-1', dayIndex: 3, type: 'NIGHT', locked: false }];
    // Nudging the night one day later is legal: the night on day 3 goes away.
    expect(ghostSeverity(s, { source: 'slot', internId: 'intern-1', dayIndex: 3, type: 'NIGHT' }, { dayIndex: 4, type: 'NIGHT' })).toBe('ok');
    // Adding a second night one day later is not.
    expect(ghostSeverity(s, { source: 'palette', internId: 'intern-1' }, { dayIndex: 4, type: 'NIGHT' })).toBe('error');
  });

  it('calls every legal move on a solved board clean, and every illegal one a break', () => {
    const s = filled();
    let legal = 0;
    let flaggedLegal = 0;
    let illegal = 0;
    let missedIllegal = 0;
    for (const a of s.assignments) {
      for (let d = 0; d < 28; d++) {
        for (const type of ['DAY', 'NIGHT'] as ShiftType[]) {
          if (d === a.dayIndex && type === a.type) continue;
          const moved: Schedule = {
            ...s,
            assignments: s.assignments.map(x => (x === a ? { ...x, dayIndex: d, type } : x)),
          };
          if (moved.assignments.filter(x => x.internId === a.internId && x.dayIndex === d && x.type === type).length > 1) continue;
          const errors = validate(moved).filter(v => v.severity === 'error').length;
          const ghost = ghostSeverity(s, { source: 'slot', internId: a.internId, dayIndex: a.dayIndex, type: a.type }, { dayIndex: d, type });
          if (ghost === null) continue;
          if (errors === 0) {
            legal += 1;
            if (ghost !== 'ok') flaggedLegal += 1;
          } else {
            illegal += 1;
            if (ghost !== 'error') missedIllegal += 1;
          }
        }
      }
    }
    expect(legal).toBeGreaterThan(100);
    expect(illegal).toBeGreaterThan(100);
    expect(flaggedLegal).toBe(0);
    expect(missedIllegal).toBe(0);
  }, 60_000);

  it('scheduleAfterPickUp removes only the dragged shift, and nothing for a palette drag', () => {
    const s = filled();
    const a = s.assignments[10];
    if (!a) throw new Error('no assignment');
    const after = scheduleAfterPickUp(s, { source: 'slot', internId: a.internId, dayIndex: a.dayIndex, type: a.type });
    expect(after.assignments).toHaveLength(s.assignments.length - 1);
    expect(counts(after, a.internId)[a.type === 'DAY' ? 'day' : 'night']).toBe(7);
    expect(scheduleAfterPickUp(s, { source: 'palette', internId: 'intern-1' })).toBe(s);
  });
});
