import type { AppState, UiState } from './reducer';
import { isSchedule } from '../engine/codec';
import { withTrimmedNames } from '../engine/schedule';
import type { Schedule } from '../engine/types';

export const STORAGE_KEY = 'emed-nobet.v1';

export interface Persisted {
  schedule: Schedule;
  ui: Pick<UiState, 'lang' | 'theme' | 'step' | 'view'>;
}

export function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    const schedule = isSchedule(rec['schedule']);
    if (!schedule) return null;
    const ui = rec['ui'] as Partial<Persisted['ui']> | undefined;
    return {
      schedule,
      ui: {
        lang: ui?.lang === 'en' ? 'en' : 'tr',
        theme: ui?.theme === 'light' || ui?.theme === 'dark' ? ui.theme : 'system',
        step: ui?.step === 'board' ? 'board' : 'setup',
        view: ui?.view === 'matrix' ? 'matrix' : 'calendar',
      },
    };
  } catch {
    return null;
  }
}

export function savePersisted(state: AppState): void {
  try {
    const { lang, theme, step, view } = state.ui;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule: withTrimmedNames(state.schedule), ui: { lang, theme, step, view } }));
  } catch {
    /* quota exceeded or private mode: the app keeps working without a draft */
  }
}
