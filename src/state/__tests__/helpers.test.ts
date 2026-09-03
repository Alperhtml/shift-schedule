import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../engine/schedule';
import { affectedByShrink, unlockedCount } from '../helpers';

describe('helpers', () => {
  it('counts', () => {
    const s = createSchedule('2026-09-07', 6);
    s.assignments = [
      { internId: 'intern-6', dayIndex: 1, type: 'DAY', locked: true },
      { internId: 'intern-5', dayIndex: 1, type: 'DAY', locked: false },
    ];
    expect(unlockedCount(s)).toBe(1);
    expect(affectedByShrink(s, 4)).toEqual({ interns: 2, assignments: 2 });
    expect(affectedByShrink(s, 6)).toEqual({ interns: 0, assignments: 0 });
  });
});
