import type { Intern, Schedule } from '../../engine/types';
import { DAYS } from '../../engine/types';
import { at } from '../../engine/util';

export type MatrixCell = '' | 'DAY' | 'NIGHT' | 'BOTH';

export interface MatrixRow {
  intern: Intern;
  cells: MatrixCell[];
  day: number;
  night: number;
}

export interface Matrix {
  rows: MatrixRow[];
}

/** Pure; the Excel export reuses it. */
export function buildMatrix(schedule: Schedule): Matrix {
  const rows = schedule.interns.map((intern): MatrixRow => ({
    intern,
    cells: new Array<MatrixCell>(DAYS).fill(''),
    day: 0,
    night: 0,
  }));
  const byId = new Map(rows.map(r => [r.intern.id, r]));
  for (const a of schedule.assignments) {
    const row = byId.get(a.internId);
    if (!row || a.dayIndex < 0 || a.dayIndex >= DAYS) continue;
    const current = at(row.cells, a.dayIndex);
    row.cells[a.dayIndex] = current === '' ? a.type : current === a.type ? current : 'BOTH';
    if (a.type === 'DAY') row.day += 1;
    else row.night += 1;
  }
  return { rows };
}
