import { describe, it, expect } from 'vitest';
import { actionForDrop } from '../DndProvider';

describe('actionForDrop', () => {
  it('maps palette -> slot to ASSIGN, slot -> slot to MOVE, slot -> palette to UNASSIGN, nothing otherwise', () => {
    expect(actionForDrop({ source: 'palette', internId: 'intern-1' }, '3-DAY')).toEqual({ type: 'ASSIGN', internId: 'intern-1', dayIndex: 3, shift: 'DAY' });
    expect(actionForDrop({ source: 'slot', internId: 'intern-1', dayIndex: 0, type: 'NIGHT' }, '3-DAY')).toEqual({ type: 'MOVE', internId: 'intern-1', from: { dayIndex: 0, shift: 'NIGHT' }, to: { dayIndex: 3, shift: 'DAY' } });
    expect(actionForDrop({ source: 'slot', internId: 'intern-1', dayIndex: 0, type: 'NIGHT' }, 'palette')).toEqual({ type: 'UNASSIGN', internId: 'intern-1', dayIndex: 0, shift: 'NIGHT' });
    expect(actionForDrop({ source: 'palette', internId: 'intern-1' }, 'palette')).toBeNull();
    expect(actionForDrop({ source: 'palette', internId: 'intern-1' }, null)).toBeNull();
    expect(actionForDrop({ source: 'slot', internId: 'intern-1', dayIndex: 3, type: 'DAY' }, '3-DAY')).toBeNull();
  });
});
