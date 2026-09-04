/** Combining one file per person into a single board. SPEC §12.

    Everyone plans their own month alone and exports it. One person then loads
    every file at once and the result shows where the choices collide: shifts
    nobody took, shifts several people took, and anyone who did not finish. */

import type { Cell, Intern, Schedule, ShiftType } from './types';
import { DAYS, MAX_INTERNS, QUOTA, SHIFT_TYPES } from './types';
import { bySlot, colorFor, defaultMinPerShift, slotKey } from './schedule';
import { validate } from './rules';

export interface MergeInput {
  /** File name, shown in the report so a problem can be traced back to a person. */
  file: string;
  schedule: Schedule;
}

/** Why a file contributes nothing. `duplicate` and `tooMany` need a decision from
    the user; the rest are simply excluded and reported. */
export type FileProblem = 'noPeople' | 'unnamed' | 'dateMismatch' | 'duplicate' | 'tooMany';

export interface MergePerson {
  name: string;
  file: string;
  day: number;
  night: number;
}

export interface MergeFile {
  file: string;
  people: string[];
  problem: FileProblem | null;
  /** The file this one collides with, for `duplicate`. */
  otherFile: string | null;
}

export interface OverStaffed {
  dayIndex: number;
  type: ShiftType;
  count: number;
}

export interface MergeResult {
  /** The period every file has to agree on: the first usable file decides it. */
  startDate: string | null;
  minPerShift: number;
  files: MergeFile[];
  people: MergePerson[];
  schedule: Schedule | null;
  /** Shifts nobody picked. */
  empty: Cell[];
  /** Shifts with more people than the target. */
  over: OverStaffed[];
  /** People who did not land on exactly 8 day and 8 night shifts. */
  incomplete: MergePerson[];
  /** Rest-rule breaks on the combined board, counted from validate(). */
  ruleErrors: number;
  /** True while the merge cannot be applied: nothing usable, or a decision is owed. */
  blocked: boolean;
}

const nameKey = (s: string): string => s.trim().toLocaleLowerCase('tr-TR');

/** Interns that actually did something. A file whose owner left a row empty is
    not evidence that the person wants no shifts, it is an unfinished file. */
function contributors(s: Schedule): Intern[] {
  return s.interns.filter(i => s.assignments.some(a => a.internId === i.id));
}

export function mergeSchedules(inputs: readonly MergeInput[]): MergeResult {
  const files: MergeFile[] = [];
  const people: MergePerson[] = [];
  // Assignments are carried by person name, since intern ids are positional and
  // every solo file reuses the same first id.
  const shifts = new Map<string, { dayIndex: number; type: ShiftType; locked: boolean }[]>();
  const takenBy = new Map<string, string>();
  let startDate: string | null = null;

  for (const input of inputs) {
    const own = contributors(input.schedule);
    if (own.length === 0) {
      files.push({ file: input.file, people: [], problem: 'noPeople', otherFile: null });
      continue;
    }
    if (own.some(i => i.realName.trim() === '')) {
      files.push({ file: input.file, people: [], problem: 'unnamed', otherFile: null });
      continue;
    }
    if (startDate === null) startDate = input.schedule.startDate;
    if (input.schedule.startDate !== startDate) {
      files.push({ file: input.file, people: own.map(i => i.realName.trim()), problem: 'dateMismatch', otherFile: null });
      continue;
    }
    const clash = own.find(i => takenBy.has(nameKey(i.realName)));
    if (clash) {
      files.push({
        file: input.file,
        people: own.map(i => i.realName.trim()),
        problem: 'duplicate',
        otherFile: takenBy.get(nameKey(clash.realName)) ?? null,
      });
      continue;
    }
    if (people.length + own.length > MAX_INTERNS) {
      files.push({ file: input.file, people: own.map(i => i.realName.trim()), problem: 'tooMany', otherFile: null });
      continue;
    }

    for (const intern of own) {
      const name = intern.realName.trim();
      const mine = input.schedule.assignments.filter(a => a.internId === intern.id);
      takenBy.set(nameKey(name), input.file);
      shifts.set(name, mine.map(a => ({ dayIndex: a.dayIndex, type: a.type, locked: a.locked })));
      people.push({
        name,
        file: input.file,
        day: mine.filter(a => a.type === 'DAY').length,
        night: mine.filter(a => a.type === 'NIGHT').length,
      });
    }
    files.push({ file: input.file, people: own.map(i => i.realName.trim()), problem: null, otherFile: null });
  }

  const blocking = files.some(f => f.problem === 'duplicate' || f.problem === 'tooMany');
  const minPerShift = defaultMinPerShift(Math.max(1, people.length));

  if (people.length === 0 || startDate === null) {
    return {
      startDate, minPerShift, files, people: [], schedule: null,
      empty: [], over: [], incomplete: [], ruleErrors: 0, blocked: true,
    };
  }

  // Alphabetical, so the same set of files always produces the same board and the
  // same colours no matter what order they were picked in.
  const ordered = [...people].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const interns: Intern[] = ordered.map((p, k) => ({
    id: `intern-${k + 1}`,
    index: k + 1,
    realName: p.name,
    colorKey: colorFor(k + 1),
    pinned: true,
  }));
  const idOf = new Map(ordered.map((p, k) => [p.name, `intern-${k + 1}`] as const));

  const schedule: Schedule = {
    version: 1,
    startDate,
    interns,
    minPerShift,
    assignments: ordered.flatMap(p => (shifts.get(p.name) ?? []).map(a => ({
      internId: idOf.get(p.name) ?? '',
      dayIndex: a.dayIndex,
      type: a.type,
      locked: a.locked,
    }))).sort((x, y) =>
      x.dayIndex - y.dayIndex
      || (x.type === y.type ? 0 : x.type === 'DAY' ? -1 : 1)
      || x.internId.localeCompare(y.internId)),
    namePool: [],
  };

  const slots = bySlot(schedule);
  const empty: Cell[] = [];
  const over: OverStaffed[] = [];
  for (let d = 0; d < DAYS; d++) {
    for (const type of SHIFT_TYPES) {
      const count = slots.get(slotKey(d, type))?.length ?? 0;
      if (count === 0) empty.push({ dayIndex: d, type });
      else if (count > minPerShift) over.push({ dayIndex: d, type, count });
    }
  }

  return {
    startDate,
    minPerShift,
    files,
    people: ordered,
    schedule,
    empty,
    over,
    incomplete: ordered.filter(p => p.day !== QUOTA || p.night !== QUOTA),
    ruleErrors: validate(schedule).filter(v => v.severity === 'error').length,
    blocked: blocking,
  };
}
