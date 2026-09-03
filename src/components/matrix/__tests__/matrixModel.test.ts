import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../../engine/schedule';
import { buildMatrix } from '../matrixModel';

describe('buildMatrix', () => {
  it('marks cells and totals', () => {
    const s = createSchedule('2026-09-07', 4);
    s.assignments = [
      { internId: 'intern-1', dayIndex: 0, type: 'DAY', locked: false },
      { internId: 'intern-1', dayIndex: 0, type: 'NIGHT', locked: false },
      { internId: 'intern-2', dayIndex: 5, type: 'NIGHT', locked: false },
    ];
    const m = buildMatrix(s);
    expect(m.rows[0]?.cells[0]).toBe('BOTH');
    expect(m.rows[1]?.cells[5]).toBe('NIGHT');
    expect(m.rows[1]?.cells[4]).toBe('');
    expect(m.rows[0]).toMatchObject({ day: 1, night: 1 });
    expect(m.rows[0]?.cells).toHaveLength(28);
  });
});
