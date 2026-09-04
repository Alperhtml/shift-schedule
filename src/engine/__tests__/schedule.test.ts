import { describe, it, expect } from 'vitest';
import { averagePerSlot, bySlot, byIntern, counts, createSchedule, defaultMinPerShift, hasAssignment, makeInterns, parseSlotKey, slotKey, withTrimmedNames } from '../schedule';

describe('schedule helpers', () => {
  it('slot keys round-trip', () => {
    expect(slotKey(3, 'NIGHT')).toBe('3-NIGHT');
    expect(parseSlotKey('3-NIGHT')).toEqual({ dayIndex: 3, type: 'NIGHT' });
    expect(() => parseSlotKey('x-NIGHT' as never)).toThrow();
  });
  it('averages and defaults', () => {
    expect(averagePerSlot(7)).toBe(2);
    expect(defaultMinPerShift(4)).toBe(1);
    expect(defaultMinPerShift(6)).toBe(1);
    expect(defaultMinPerShift(7)).toBe(2);
    expect(defaultMinPerShift(8)).toBe(2);
  });
  it('makeInterns keeps names on grow and shrink, clamps 1..8', () => {
    const a = makeInterns(5).map((i, k) => ({ ...i, realName: `n${k}` }));
    expect(makeInterns(6, a).map(i => i.realName)).toEqual(['n0', 'n1', 'n2', 'n3', 'n4', '']);
    expect(makeInterns(4, a).map(i => i.realName)).toEqual(['n0', 'n1', 'n2', 'n3']);
    // The floor is one, for a solo schedule. The team floor of 4 belongs to the
    // setup stepper and to SET_INTERN_COUNT, which is where it is tested.
    expect(makeInterns(1)).toHaveLength(1);
    expect(makeInterns(0)).toHaveLength(1);
    expect(makeInterns(9)).toHaveLength(8);
    expect(makeInterns(8).map(i => i.colorKey)).toEqual(['orange', 'green', 'blue', 'purple', 'teal', 'yellow', 'pink', 'indigo']);
    expect(makeInterns(4).map(i => i.id)).toEqual(['intern-1', 'intern-2', 'intern-3', 'intern-4']);
  });
  it('indexes and counts', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments.push(
      { internId: 'intern-1', dayIndex: 0, type: 'DAY', locked: false },
      { internId: 'intern-2', dayIndex: 0, type: 'DAY', locked: true },
      { internId: 'intern-1', dayIndex: 3, type: 'NIGHT', locked: false },
    );
    expect(bySlot(s).get('0-DAY')?.map(a => a.internId)).toEqual(['intern-1', 'intern-2']);
    expect(byIntern(s).get('intern-1')).toHaveLength(2);
    expect(counts(s, 'intern-1')).toEqual({ day: 1, night: 1 });
    expect(hasAssignment(s, 'intern-2', 0, 'DAY')).toBe(true);
    expect(hasAssignment(s, 'intern-2', 0, 'NIGHT')).toBe(false);
    expect(s.minPerShift).toBe(1);
  });

  it('withTrimmedNames cleans names and keeps the object when nothing changes', () => {
    const s = createSchedule('2026-09-07', 4);
    expect(withTrimmedNames(s)).toBe(s);
    const dirty = { ...s, interns: s.interns.map((i, k) => ({ ...i, realName: k === 0 ? '  Ayşe Yılmaz  ' : k === 1 ? '   ' : '' })) };
    const clean = withTrimmedNames(dirty);
    expect(clean.interns.map(i => i.realName)).toEqual(['Ayşe Yılmaz', '', '', '']);
    expect(dirty.interns[0]?.realName).toBe('  Ayşe Yılmaz  ');
  });
});
