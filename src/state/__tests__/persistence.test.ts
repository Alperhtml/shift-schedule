import { describe, it, expect, beforeEach } from 'vitest';
import { loadPersisted, savePersisted, STORAGE_KEY } from '../persistence';
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
    expect(back?.schedule).toEqual(state.schedule);
    expect(back?.ui).toEqual({ lang: 'en', theme: 'dark', step: 'board', view: 'calendar' });
  });
  it('returns null for junk and never throws', () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    expect(loadPersisted()).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule: { version: 2 } }));
    expect(loadPersisted()).toBeNull();
    localStorage.clear();
    expect(loadPersisted()).toBeNull();
  });
});
