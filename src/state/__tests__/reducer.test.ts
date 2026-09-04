import { describe, it, expect } from 'vitest';
import { TEAM_DEFAULT, initialState, modeOf, reducer, type AppState } from '../reducer';
import { createSchedule } from '../../engine/schedule';

const base = (): AppState => ({ ...initialState(), schedule: createSchedule('2026-09-07', 4) });
const assign = (s: AppState, internId: string, dayIndex: number, shift: 'DAY' | 'NIGHT') =>
  reducer(s, { type: 'ASSIGN', internId, dayIndex, shift });

describe('reducer', () => {
  it('ASSIGN adds once and is undoable', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = assign(s, 'intern-1', 0, 'DAY');
    expect(s.schedule.assignments).toHaveLength(1);
    expect(s.past).toHaveLength(1);
    s = reducer(s, { type: 'UNDO' });
    expect(s.schedule.assignments).toHaveLength(0);
    expect(s.future).toHaveLength(1);
    s = reducer(s, { type: 'REDO' });
    expect(s.schedule.assignments).toHaveLength(1);
  });
  it('MOVE carries locked and refuses a duplicate target', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'TOGGLE_LOCK', internId: 'intern-1', dayIndex: 0, shift: 'DAY' });
    s = reducer(s, { type: 'MOVE', internId: 'intern-1', from: { dayIndex: 0, shift: 'DAY' }, to: { dayIndex: 2, shift: 'NIGHT' } });
    expect(s.schedule.assignments).toEqual([{ internId: 'intern-1', dayIndex: 2, type: 'NIGHT', locked: true }]);
    s = assign(s, 'intern-1', 5, 'DAY');
    const before = s;
    s = reducer(s, { type: 'MOVE', internId: 'intern-1', from: { dayIndex: 5, shift: 'DAY' }, to: { dayIndex: 2, shift: 'NIGHT' } });
    expect(s).toBe(before);
  });
  it('RESET_NAMES clears names and unpins them, leaving the shifts alone', () => {
    let s = reducer(base(), { type: 'SET_INTERN_NAME', id: 'intern-1', name: 'Ayşe Yılmaz' });
    s = reducer(s, { type: 'SET_NAME_POOL', names: ['Burak Öztürk'] });
    s = assign(s, 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'RESET_NAMES', clearPool: false });
    expect(s.schedule.interns.every(i => i.realName === '' && !i.pinned)).toBe(true);
    expect(s.schedule.assignments).toHaveLength(1);
    expect(s.schedule.namePool).toEqual(['Burak Öztürk']);

    s = reducer(s, { type: 'RESET_NAMES', clearPool: true });
    expect(s.schedule.namePool).toEqual([]);
  });
  it('RESET_NAMES reaches the history, so undo cannot revive a cleared name', () => {
    let s = reducer(base(), { type: 'SET_INTERN_NAME', id: 'intern-1', name: 'Ayşe Yılmaz' });
    s = assign(s, 'intern-1', 0, 'DAY');
    s = assign(s, 'intern-1', 3, 'NIGHT');
    s = reducer(s, { type: 'RESET_NAMES', clearPool: false });
    s = reducer(s, { type: 'UNDO' });
    expect(s.schedule.interns[0]?.realName).toBe('');
    expect(s.schedule.assignments).toHaveLength(1);
  });
  it('RESET_ALL goes back to a first visit but keeps language and appearance', () => {
    let s = reducer(base(), { type: 'SET_INTERN_NAME', id: 'intern-1', name: 'Ayşe Yılmaz' });
    s = assign(s, 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'SET_LANG', lang: 'en' });
    s = reducer(s, { type: 'SET_THEME', theme: 'dark' });
    s = reducer(s, { type: 'SET_STEP', step: 'board' });
    s = reducer(s, { type: 'RESET_ALL', isoDate: '2026-10-05' });
    expect(s.schedule.startDate).toBe('2026-10-05');
    expect(s.schedule.interns).toHaveLength(TEAM_DEFAULT);
    expect(s.schedule.interns.every(i => i.realName === '')).toBe(true);
    expect(s.schedule.assignments).toEqual([]);
    expect(s.schedule.namePool).toEqual([]);
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.ui).toEqual({ step: 'setup', view: 'calendar', lang: 'en', theme: 'dark', settingsOpen: false });
  });
  it('SET_INTERN_COUNT still holds the team floor of 4 and ceiling of 8', () => {
    expect(reducer(base(), { type: 'SET_INTERN_COUNT', n: 1 }).schedule.interns).toHaveLength(4);
    expect(reducer(base(), { type: 'SET_INTERN_COUNT', n: 99 }).schedule.interns).toHaveLength(8);
  });
  it('SET_MODE goes down to one person and back to the team default', () => {
    let s = reducer(base(), { type: 'SET_MODE', mode: 'solo' });
    expect(s.schedule.interns).toHaveLength(1);
    expect(modeOf(s.schedule)).toBe('solo');
    s = reducer(s, { type: 'SET_MODE', mode: 'team' });
    expect(s.schedule.interns).toHaveLength(TEAM_DEFAULT);
    expect(modeOf(s.schedule)).toBe('team');
  });
  it('SET_MODE to solo keeps the first name and drops the others shifts', () => {
    let s = reducer(base(), { type: 'SET_INTERN_NAME', id: 'intern-1', name: 'Ayşe Yılmaz' });
    s = assign(s, 'intern-1', 0, 'DAY');
    s = assign(s, 'intern-2', 1, 'NIGHT');
    s = reducer(s, { type: 'SET_MODE', mode: 'solo' });
    expect(s.schedule.interns[0]?.realName).toBe('Ayşe Yılmaz');
    expect(s.schedule.assignments).toEqual([{ internId: 'intern-1', dayIndex: 0, type: 'DAY', locked: false }]);
  });
  it('SET_INTERN_COUNT shrink drops assignments of removed interns, grow keeps names', () => {
    let s = reducer(base(), { type: 'SET_INTERN_COUNT', n: 6 });
    s = reducer(s, { type: 'SET_INTERN_NAME', id: 'intern-6', name: 'Ayşe ' });
    s = reducer(s, { type: 'SET_INTERN_NAME', id: 'intern-6', name: 'Ayşe Yılmaz' });
    s = assign(s, 'intern-6', 3, 'NIGHT');
    expect(s.schedule.interns[5]?.realName).toBe('Ayşe Yılmaz');
    expect(reducer(s, { type: 'SET_INTERN_NAME', id: 'intern-6', name: 'x'.repeat(60) }).schedule.interns[5]?.realName).toHaveLength(40);
    s = reducer(s, { type: 'SET_INTERN_COUNT', n: 5 });
    expect(s.schedule.interns).toHaveLength(5);
    expect(s.schedule.assignments).toHaveLength(0);
    expect(s.schedule.minPerShift).toBe(1);
  });
  it('SET_START_DATE ignores non-Mondays; SET_MIN_PER_SHIFT clamps; neither is undoable', () => {
    let s = reducer(base(), { type: 'SET_START_DATE', isoDate: '2026-09-08' });
    expect(s.schedule.startDate).toBe('2026-09-07');
    s = reducer(s, { type: 'SET_START_DATE', isoDate: '2026-09-14' });
    expect(s.schedule.startDate).toBe('2026-09-14');
    s = reducer(s, { type: 'SET_MIN_PER_SHIFT', n: 9 });
    expect(s.schedule.minPerShift).toBe(4);
    expect(s.past).toHaveLength(0);
  });
  it('RESET honours keepLocked; RANDOMIZE replaces; LOAD clears history; cap 100', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'TOGGLE_LOCK', internId: 'intern-1', dayIndex: 0, shift: 'DAY' });
    s = assign(s, 'intern-2', 1, 'DAY');
    s = reducer(s, { type: 'RESET', keepLocked: true });
    expect(s.schedule.assignments).toHaveLength(1);
    s = reducer(s, { type: 'RANDOMIZE', assignments: [{ internId: 'intern-3', dayIndex: 4, type: 'NIGHT', locked: false }] });
    expect(s.schedule.assignments).toHaveLength(1);
    s = reducer(s, { type: 'LOAD_SCHEDULE', schedule: createSchedule('2026-09-21', 5) });
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
    for (let k = 0; k < 120; k++) s = assign(s, `intern-${1 + (k % 5)}`, k % 28, k % 2 === 0 ? 'DAY' : 'NIGHT');
    expect(s.past.length).toBeLessThanOrEqual(100);
  });
  it('non-undoable edits survive undo and redo', () => {
    let s = assign(base(), 'intern-1', 0, 'DAY');
    s = reducer(s, { type: 'UNDO' });
    s = reducer(s, { type: 'SET_INTERN_NAME', id: 'intern-1', name: 'Ayşe Yılmaz' });
    s = reducer(s, { type: 'SET_START_DATE', isoDate: '2026-09-14' });
    s = reducer(s, { type: 'SET_MIN_PER_SHIFT', n: 3 });
    s = reducer(s, { type: 'REDO' });
    expect(s.schedule.assignments).toHaveLength(1);
    expect(s.schedule.interns[0]?.realName).toBe('Ayşe Yılmaz');
    expect(s.schedule.startDate).toBe('2026-09-14');
    expect(s.schedule.minPerShift).toBe(3);
    s = reducer(s, { type: 'UNDO' });
    expect(s.schedule.assignments).toHaveLength(0);
    expect(s.schedule.interns[0]?.realName).toBe('Ayşe Yılmaz');
    expect(s.schedule.startDate).toBe('2026-09-14');
    expect(s.schedule.minPerShift).toBe(3);
  });

  it('keeps a chosen staffing target when the intern count changes, and drops orphans on randomize', () => {
    let s = reducer(base(), { type: 'SET_MIN_PER_SHIFT', n: 3 });
    s = reducer(s, { type: 'SET_INTERN_COUNT', n: 7 });
    expect(s.schedule.minPerShift).toBe(3);
    let auto = reducer(base(), { type: 'SET_INTERN_COUNT', n: 7 });
    expect(auto.schedule.minPerShift).toBe(2);
    auto = reducer(auto, {
      type: 'RANDOMIZE',
      assignments: [
        { internId: 'intern-1', dayIndex: 0, type: 'DAY', locked: false },
        { internId: 'intern-8', dayIndex: 0, type: 'DAY', locked: false },
      ],
    });
    expect(auto.schedule.assignments.map(a => a.internId)).toEqual(['intern-1']);
  });

  it('the name pool fills only the blanks and leaves assignments alone', () => {
    let s = reducer(base(), { type: 'SET_INTERN_NAME', id: 'intern-1', name: 'Ali' });
    s = assign(s, 'intern-1', 0, 'DAY');
    // The pool keeps what was typed, blank lines included, so the text area can be
    // edited freely; trimming and de-duplication happen when it is used or saved.
    s = reducer(s, { type: 'SET_NAME_POOL', names: ['  Ayşe Yılmaz ', 'Can', '', 'Can', 'Deniz'] });
    expect(s.schedule.namePool).toEqual(['  Ayşe Yılmaz ', 'Can', '', 'Can', 'Deniz']);
    const before = s.schedule.assignments;
    s = reducer(s, { type: 'DISTRIBUTE_POOL', seed: 7 });
    expect(s.schedule.assignments).toEqual(before);
    expect(s.schedule.interns[0]?.realName).toBe('Ali');
    expect([...s.schedule.interns.map(i => i.realName)].sort()).toEqual(['Ali', 'Ayşe Yılmaz', 'Can', 'Deniz']);
    // Drawing again only reshuffles the blanks, and Ali is not one of them.
    s = reducer(s, { type: 'DISTRIBUTE_POOL', seed: 9 });
    expect(s.schedule.interns[0]?.realName).toBe('Ali');
    const scheduleRef = s.schedule;
    s = reducer(s, { type: 'SET_LANG', lang: 'en' });
    s = reducer(s, { type: 'SET_THEME', theme: 'dark' });
    s = reducer(s, { type: 'SET_VIEW', view: 'matrix' });
    expect(s.schedule).toBe(scheduleRef);
    expect(s.ui).toMatchObject({ lang: 'en', theme: 'dark', view: 'matrix' });
  });
});
