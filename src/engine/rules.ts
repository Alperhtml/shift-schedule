import type { Assignment, Cell, InternId, Schedule, ShiftType } from './types';
import { DAYS, HIGH_DENSITY_AT, NIGHT_GAP_MIN, QUOTA, SHIFT_TYPES } from './types';
import { byIntern, bySlot, hasAssignment, slotKey } from './schedule';
import { at } from './util';

export type ViolationCode =
  | 'POST_NIGHT_DAY'
  | 'NIGHT_GAP'
  | 'DOUBLE_SHIFT'
  | 'QUOTA_OVER'
  | 'QUOTA_INCOMPLETE'
  | 'UNDER_STAFFED'
  | 'HIGH_DENSITY';

export type Severity = 'error' | 'warning' | 'info';

export interface Violation {
  code: ViolationCode;
  severity: Severity;
  internId?: InternId;
  /** -1 when the violation has no cell (QUOTA_INCOMPLETE). */
  dayIndex: number;
  type?: ShiftType;
  related: Cell[];
  params: Record<string, string | number>;
}

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** SPEC §4.1. Sorted by severity, then dayIndex, then intern index. */
export function validate(schedule: Schedule): Violation[] {
  const out: Violation[] = [];
  const perIntern = byIntern(schedule);

  for (const intern of schedule.interns) {
    const list = perIntern.get(intern.id) ?? [];
    const nights = list.filter(a => a.type === 'NIGHT').map(a => a.dayIndex).sort((a, b) => a - b);
    const days = list.filter(a => a.type === 'DAY').map(a => a.dayIndex).sort((a, b) => a - b);
    const daySet = new Set(days);

    for (const n of nights) {
      if (daySet.has(n)) {
        out.push({ code: 'DOUBLE_SHIFT', severity: 'error', internId: intern.id, dayIndex: n, type: 'NIGHT', related: [{ dayIndex: n, type: 'DAY' }], params: {} });
      }
      if (daySet.has(n + 1)) {
        out.push({ code: 'POST_NIGHT_DAY', severity: 'error', internId: intern.id, dayIndex: n + 1, type: 'DAY', related: [{ dayIndex: n, type: 'NIGHT' }], params: {} });
      }
    }

    for (let k = 1; k < nights.length; k++) {
      const d1 = at(nights, k - 1);
      const d2 = at(nights, k);
      if (d2 - d1 < NIGHT_GAP_MIN) {
        out.push({ code: 'NIGHT_GAP', severity: 'error', internId: intern.id, dayIndex: d2, type: 'NIGHT', related: [{ dayIndex: d1, type: 'NIGHT' }], params: { gap: d2 - d1 } });
      }
    }

    const quota: [ShiftType, number[]][] = [['DAY', days], ['NIGHT', nights]];
    for (const [type, arr] of quota) {
      if (arr.length > QUOTA) {
        out.push({ code: 'QUOTA_OVER', severity: 'error', internId: intern.id, dayIndex: at(arr, arr.length - 1), type, related: arr.map(d => ({ dayIndex: d, type })), params: { count: arr.length } });
      } else if (arr.length < QUOTA) {
        out.push({ code: 'QUOTA_INCOMPLETE', severity: 'info', internId: intern.id, dayIndex: -1, type, related: [], params: { count: arr.length, missing: QUOTA - arr.length } });
      }
    }
  }

  const slots = bySlot(schedule);
  for (let d = 0; d < DAYS; d++) {
    for (const type of SHIFT_TYPES) {
      const c = slots.get(slotKey(d, type))?.length ?? 0;
      // Two cases where the staffing warning is noise rather than news: a solo
      // schedule, where one person cannot staff 56 shifts, and a board nobody has
      // started, which would open on 56 warnings before any work is done.
      if (schedule.interns.length > 1 && schedule.assignments.length > 0 && c < schedule.minPerShift) {
        out.push({ code: 'UNDER_STAFFED', severity: 'warning', dayIndex: d, type, related: [], params: { count: c, min: schedule.minPerShift } });
      }
      if (c >= HIGH_DENSITY_AT) {
        out.push({ code: 'HIGH_DENSITY', severity: 'info', dayIndex: d, type, related: [], params: { count: c } });
      }
    }
  }

  const indexOf = new Map(schedule.interns.map(i => [i.id, i.index] as const));
  const idx = (v: Violation): number => (v.internId === undefined ? 0 : (indexOf.get(v.internId) ?? 0));
  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.dayIndex - b.dayIndex || idx(a) - idx(b));
}

export function touchesCell(v: Violation, cell: Cell): boolean {
  return (v.dayIndex === cell.dayIndex && v.type === cell.type)
    || v.related.some(r => r.dayIndex === cell.dayIndex && r.type === cell.type);
}

const keyOf = (v: Violation): string => JSON.stringify([v.code, v.internId ?? '', v.dayIndex, v.type ?? '', v.params]);

/** SPEC §4.3. New violations the candidate itself would cause. Never blocks anything. */
export function wouldViolate(schedule: Schedule, candidate: Omit<Assignment, 'locked'>): Violation[] {
  if (hasAssignment(schedule, candidate.internId, candidate.dayIndex, candidate.type)) return [];
  const before = new Set(validate(schedule).map(keyOf));
  const after = validate({ ...schedule, assignments: [...schedule.assignments, { ...candidate, locked: false }] });
  const cell: Cell = { dayIndex: candidate.dayIndex, type: candidate.type };
  return after.filter(v =>
    !before.has(keyOf(v))
    && v.code !== 'UNDER_STAFFED'
    && v.code !== 'QUOTA_INCOMPLETE'
    && (v.internId === candidate.internId || v.internId === undefined)
    && touchesCell(v, cell),
  );
}

/** True iff the pattern breaks none of the three hard per-intern rules. SPEC §4.4. */
export function internPatternValid(nights: readonly number[], days: readonly number[]): boolean {
  const sorted = [...nights].sort((a, b) => a - b);
  for (let k = 1; k < sorted.length; k++) {
    if (at(sorted, k) - at(sorted, k - 1) < NIGHT_GAP_MIN) return false;
  }
  const nightSet = new Set(sorted);
  for (const d of days) if (nightSet.has(d) || nightSet.has(d - 1)) return false;
  return true;
}
