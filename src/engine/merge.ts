/** Combining one file per person into a single board. SPEC §14.2.

    Everyone plans their own month alone and exports it. One person then loads
    every file at once and the result shows where the choices collide: shifts
    nobody took, shifts several people took, and anyone who did not finish. */

import type { Cell, Intern, Schedule, ShiftType } from './types';
import { DAYS, MAX_INTERNS, QUOTA, SHIFT_TYPES } from './types';
import { bySlot, colorFor, defaultMinPerShift, slotKey, tidyName } from './schedule';
import { parseSchedule } from './codec';
import { validate } from './rules';

export interface MergeInput {
  /** File name, shown in the report so a problem can be traced back to a person. */
  file: string;
  schedule: Schedule;
}

/** Why a file contributes nothing. Everything except `noPeople` and `unnamed`
    needs a decision from the user, so it holds the merge; those two are simply
    excluded and reported, because one stray file must not stop the other six. */
export type FileProblem =
  | 'noPeople'
  | 'unnamed'
  | 'dateMismatch'
  | 'duplicate'
  | 'duplicateInFile'
  | 'tooMany';

export interface MergePerson {
  name: string;
  file: string;
  day: number;
  night: number;
}

interface Taken extends MergePerson {
  shifts: { dayIndex: number; type: ShiftType; locked: boolean }[];
}

export interface MergeFile {
  file: string;
  people: string[];
  problem: FileProblem | null;
  /** The file this one collides with, for `duplicate`. */
  otherFile: string | null;
  /** Named people in this file who had no shifts, so brought nothing with them. */
  skipped: string[];
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
  /** Named people left out of the board because they had no shifts anywhere. */
  skipped: string[];
  /** Rest-rule breaks on the combined board, counted from validate(). */
  ruleErrors: number;
  /** The combined board did not pass our own file validation. Should never
      happen; if it does, the board is not offered rather than written. */
  invalid: boolean;
  /** True while the merge cannot be applied: nothing usable, or a decision is owed. */
  blocked: boolean;
}

const nameKey = (s: string): string => tidyName(s).toLocaleLowerCase('tr-TR');

/** Interns that actually did something. A row left empty is not evidence that the
    person wants no shifts, it is an unfinished file. */
function contributors(s: Schedule): Intern[] {
  return s.interns.filter(i => s.assignments.some(a => a.internId === i.id));
}

/** A name that appears on two interns of the same file, if there is one. */
function clashWithin(own: readonly Intern[]): string | null {
  const seen = new Set<string>();
  for (const i of own) {
    const key = nameKey(i.realName);
    if (seen.has(key)) return tidyName(i.realName);
    seen.add(key);
  }
  return null;
}

export function mergeSchedules(inputs: readonly MergeInput[]): MergeResult {
  const files: MergeFile[] = [];
  // Each person carries their own shifts. Keying them by name instead would put
  // two people called the same into one bucket and lose one of them entirely.
  const taken: Taken[] = [];
  const takenBy = new Map<string, string>();
  const skipped: string[] = [];
  let startDate: string | null = null;

  for (const input of inputs) {
    const own = contributors(input.schedule);
    const idle = input.schedule.interns
      .filter(i => !own.includes(i) && tidyName(i.realName) !== '')
      .map(i => tidyName(i.realName));
    const row = (problem: FileProblem | null, otherFile: string | null = null): MergeFile => ({
      file: input.file,
      people: own.map(i => tidyName(i.realName)),
      problem,
      otherFile,
      skipped: problem === null ? idle : [],
    });

    if (own.length === 0) {
      files.push({ ...row('noPeople'), people: [] });
      continue;
    }
    if (own.some(i => tidyName(i.realName) === '')) {
      files.push({ ...row('unnamed'), people: [] });
      continue;
    }
    const inside = clashWithin(own);
    if (inside !== null) {
      files.push(row('duplicateInFile', input.file));
      continue;
    }
    if (startDate === null) startDate = input.schedule.startDate;
    if (input.schedule.startDate !== startDate) {
      files.push(row('dateMismatch'));
      continue;
    }
    const clash = own.find(i => takenBy.has(nameKey(i.realName)));
    if (clash) {
      files.push(row('duplicate', takenBy.get(nameKey(clash.realName)) ?? null));
      continue;
    }
    if (taken.length + own.length > MAX_INTERNS) {
      files.push(row('tooMany'));
      continue;
    }

    for (const intern of own) {
      const name = tidyName(intern.realName);
      const mine = input.schedule.assignments.filter(a => a.internId === intern.id);
      takenBy.set(nameKey(name), input.file);
      taken.push({
        name,
        file: input.file,
        day: mine.filter(a => a.type === 'DAY').length,
        night: mine.filter(a => a.type === 'NIGHT').length,
        shifts: mine.map(a => ({ dayIndex: a.dayIndex, type: a.type, locked: a.locked })),
      });
    }
    skipped.push(...idle);
    files.push(row(null));
  }

  const needsDecision = files.some(f =>
    f.problem === 'duplicate' || f.problem === 'duplicateInFile' || f.problem === 'tooMany' || f.problem === 'dateMismatch');
  const minPerShift = defaultMinPerShift(Math.max(1, taken.length));
  const empty: Cell[] = [];
  const over: OverStaffed[] = [];

  if (taken.length === 0 || startDate === null) {
    return {
      startDate, minPerShift, files, people: [], schedule: null,
      empty, over, incomplete: [], skipped, ruleErrors: 0, invalid: false, blocked: true,
    };
  }

  // Alphabetical, so the same set of files always produces the same board and the
  // same colours no matter what order they were picked in.
  const ordered = [...taken].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const interns: Intern[] = ordered.map((p, k) => ({
    id: `intern-${k + 1}`,
    index: k + 1,
    realName: p.name,
    colorKey: colorFor(k + 1),
    pinned: true,
  }));

  const schedule: Schedule = {
    version: 1,
    startDate,
    interns,
    minPerShift,
    assignments: ordered.flatMap((p, k) => p.shifts.map(a => ({
      internId: `intern-${k + 1}`,
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
  for (let d = 0; d < DAYS; d++) {
    for (const type of SHIFT_TYPES) {
      const count = slots.get(slotKey(d, type))?.length ?? 0;
      if (count === 0) empty.push({ dayIndex: d, type });
      else if (count > minPerShift) over.push({ dayIndex: d, type, count });
    }
  }

  // The board this produces is written straight into the app, so it goes through
  // the same gate a file does. A board that cannot be read back would be saved,
  // fail to load on the next visit, and take the draft with it.
  const invalid = !parseSchedule(JSON.parse(JSON.stringify(schedule)) as unknown).ok;

  const people: MergePerson[] = ordered.map(({ name, file, day, night }) => ({ name, file, day, night }));
  return {
    startDate,
    minPerShift,
    files,
    people,
    schedule,
    empty,
    over,
    incomplete: people.filter(p => p.day !== QUOTA || p.night !== QUOTA),
    skipped,
    ruleErrors: validate(schedule).filter(v => v.severity === 'error').length,
    invalid,
    blocked: needsDecision || invalid,
  };
}
