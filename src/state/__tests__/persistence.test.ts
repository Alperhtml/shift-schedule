import { describe, it, expect, beforeEach } from 'vitest';
import { BACKUP_KEY, loadPersisted, savePersisted, STORAGE_KEY } from '../persistence';
import { readBoot } from '../boot';
import { initialState } from '../reducer';
import { createSchedule } from '../../engine/schedule';

describe('persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the schedule and the ui slice', () => {
    const state = { ...initialState(), schedule: createSchedule('2026-09-07', 5) };
    state.ui.lang = 'en';
    state.ui.theme = 'dark';
    state.ui.step = 'board';
    savePersisted(state);
    const back = loadPersisted();
    expect(back.status).toBe('ok');
    if (back.status !== 'ok') throw new Error('not ok');
    expect(back.value.schedule).toEqual(state.schedule);
    expect(back.value.ui).toEqual({ lang: 'en', theme: 'dark', step: 'board', view: 'calendar' });
  });
  it('tells junk apart from nothing, and never throws', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    expect(loadPersisted()).toEqual({ status: 'corrupt', raw: 'not json' });
    const halfBaked = JSON.stringify({ schedule: { version: 2 } });
    localStorage.setItem(STORAGE_KEY, halfBaked);
    expect(loadPersisted()).toEqual({ status: 'corrupt', raw: halfBaked });
    localStorage.clear();
    expect(loadPersisted()).toEqual({ status: 'empty' });
  });
  it('boot moves an unreadable draft aside instead of writing over it', () => {
    const doomed = JSON.stringify({ schedule: { version: 1, startDate: '2026-09-08' } });
    localStorage.setItem(STORAGE_KEY, doomed);
    const boot = readBoot('');
    expect(boot.corrupt).toBe(doomed);
    expect(localStorage.getItem(BACKUP_KEY)).toBe(doomed);
    // The app carries on from a clean state rather than refusing to start.
    expect(boot.state.schedule.assignments).toEqual([]);
  });
});
