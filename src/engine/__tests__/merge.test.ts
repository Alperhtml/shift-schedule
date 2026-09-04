import { describe, it, expect } from 'vitest';
import { createSchedule } from '../schedule';
import { mergeSchedules, type MergeInput } from '../merge';
import type { Schedule, ShiftType } from '../types';
import { QUOTA } from '../types';

/** One person's own file: a single named intern with the shifts they picked. */
function solo(name: string, shifts: [number, ShiftType][], startDate = '2026-09-07'): Schedule {
  const s = createSchedule(startDate, 1);
  const intern = s.interns[0];
  if (!intern) throw new Error('no intern');
  intern.realName = name;
  intern.pinned = true;
  s.assignments = shifts.map(([dayIndex, type]) => ({ internId: intern.id, dayIndex, type, locked: false }));
  return s;
}

/** A legal 8 + 8 for one person: nights three days apart, days well clear of them. */
function fullPattern(offset: number): [number, ShiftType][] {
  const nights: [number, ShiftType][] = Array.from({ length: QUOTA }, (_, k) => [k * 3 + offset, 'NIGHT']);
  const nightSet = new Set(nights.map(([d]) => d));
  const days: [number, ShiftType][] = [];
  for (let d = 0; d < 28 && days.length < QUOTA; d++) {
    if (!nightSet.has(d) && !nightSet.has(d - 1)) days.push([d, 'DAY']);
  }
  return [...nights, ...days];
}

const file = (name: string, s: Schedule): MergeInput => ({ file: `${name}.json`, schedule: s });

describe('mergeSchedules', () => {
  it('combines two solo files into one board, alphabetically ordered', () => {
    const r = mergeSchedules([
      file('zeynep', solo('Zeynep Kaya', [[0, 'DAY']])),
      file('ayse', solo('Ayşe Yılmaz', [[0, 'NIGHT']])),
    ]);
    expect(r.schedule?.interns.map(i => i.realName)).toEqual(['Ayşe Yılmaz', 'Zeynep Kaya']);
    expect(r.schedule?.assignments).toHaveLength(2);
    expect(r.files.every(f => f.problem === null)).toBe(true);
    expect(r.blocked).toBe(false);
  });

  it('keeps every person shift, mapped onto the new intern ids', () => {
    const r = mergeSchedules([
      file('a', solo('Ali', [[3, 'DAY'], [7, 'NIGHT']])),
      file('b', solo('Berk', [[3, 'DAY']])),
    ]);
    const ali = r.schedule?.interns.find(i => i.realName === 'Ali');
    const mine = r.schedule?.assignments.filter(a => a.internId === ali?.id);
    expect(mine).toHaveLength(2);
    expect(r.schedule?.assignments.filter(a => a.dayIndex === 3 && a.type === 'DAY')).toHaveLength(2);
  });

  it('reports a shift nobody took and a shift too many people took', () => {
    // Two people, so the target is one per shift; day 0 has two, everything else none.
    const r = mergeSchedules([
      file('a', solo('Ali', [[0, 'DAY']])),
      file('b', solo('Berk', [[0, 'DAY']])),
    ]);
    expect(r.minPerShift).toBe(1);
    expect(r.over).toEqual([{ dayIndex: 0, type: 'DAY', count: 2 }]);
    expect(r.empty).toHaveLength(28 * 2 - 1);
    expect(r.empty).not.toContainEqual({ dayIndex: 0, type: 'DAY' });
  });

  it('reports who has not finished 8 + 8, and nobody when everyone has', () => {
    const short = mergeSchedules([file('a', solo('Ali', [[0, 'DAY']]))]);
    expect(short.incomplete).toEqual([{ name: 'Ali', file: 'a.json', day: 1, night: 0 }]);

    const done = mergeSchedules([
      file('a', solo('Ali', fullPattern(0))),
      file('b', solo('Berk', fullPattern(1))),
    ]);
    expect(done.incomplete).toEqual([]);
    expect(done.people.every(p => p.day === QUOTA && p.night === QUOTA)).toBe(true);
  });

  it('counts rest-rule breaks on the combined board', () => {
    // Each file is legal alone; nothing about combining them creates a break,
    // because the rules are per person.
    const r = mergeSchedules([
      file('a', solo('Ali', [[0, 'NIGHT'], [1, 'DAY']])),
      file('b', solo('Berk', [[5, 'DAY']])),
    ]);
    expect(r.ruleErrors).toBe(1);
  });

  it('blocks when the same person arrives in two files', () => {
    const r = mergeSchedules([
      file('first', solo('Ali', [[0, 'DAY']])),
      file('second', solo('ali', [[1, 'DAY']])),
    ]);
    expect(r.files[1]).toMatchObject({ problem: 'duplicate', otherFile: 'first.json' });
    expect(r.blocked).toBe(true);
    expect(r.people).toHaveLength(1);
  });

  it('excludes a file from another period without blocking the rest', () => {
    const r = mergeSchedules([
      file('a', solo('Ali', [[0, 'DAY']])),
      file('b', solo('Berk', [[0, 'DAY']], '2026-10-05')),
    ]);
    expect(r.files[1]?.problem).toBe('dateMismatch');
    expect(r.startDate).toBe('2026-09-07');
    expect(r.people.map(p => p.name)).toEqual(['Ali']);
    expect(r.blocked).toBe(false);
  });

  it('excludes an unfinished file and a file with no name', () => {
    const nameless = solo('', [[0, 'DAY']]);
    const untouched = solo('Ali', []);
    const r = mergeSchedules([file('nameless', nameless), file('untouched', untouched)]);
    expect(r.files.map(f => f.problem)).toEqual(['unnamed', 'noPeople']);
    expect(r.schedule).toBeNull();
    expect(r.blocked).toBe(true);
  });

  it('blocks past the roster cap instead of silently dropping someone', () => {
    const inputs = Array.from({ length: 9 }, (_, k) => file(`p${k}`, solo(`Kisi ${k}`, [[k, 'DAY']])));
    const r = mergeSchedules(inputs);
    expect(r.people).toHaveLength(8);
    expect(r.files[8]?.problem).toBe('tooMany');
    expect(r.blocked).toBe(true);
  });

  it('carries a locked shift through the merge', () => {
    const s = solo('Ali', [[0, 'NIGHT']]);
    const first = s.assignments[0];
    if (!first) throw new Error('no assignment');
    first.locked = true;
    const r = mergeSchedules([file('a', s)]);
    expect(r.schedule?.assignments[0]?.locked).toBe(true);
  });

  it('returns an empty result for no files at all', () => {
    const r = mergeSchedules([]);
    expect(r.schedule).toBeNull();
    expect(r.startDate).toBeNull();
    expect(r.blocked).toBe(true);
  });

  it('is stable: the order files are picked in does not change the board', () => {
    const a = solo('Ali', [[0, 'DAY']]);
    const b = solo('Berk', [[1, 'NIGHT']]);
    const forward = mergeSchedules([file('a', a), file('b', b)]).schedule;
    const back = mergeSchedules([file('b', b), file('a', a)]).schedule;
    expect(forward?.interns).toEqual(back?.interns);
    expect(forward?.assignments).toEqual(back?.assignments);
  });
});
