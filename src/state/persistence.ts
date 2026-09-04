import type { AppState, UiState } from './reducer';
import { isSchedule } from '../engine/codec';
import { withTrimmedNames } from '../engine/schedule';
import type { Schedule } from '../engine/types';

export const STORAGE_KEY = 'emed-nobet.v1';
/** Where a draft that cannot be read is kept. Never overwritten by the app's own
    saves, so the work is still there to be downloaded. */
export const BACKUP_KEY = 'emed-nobet.v1.bozuk';

export interface Persisted {
  schedule: Schedule;
  ui: Pick<UiState, 'lang' | 'theme' | 'step' | 'view'>;
}

/** A draft that will not load is not the same as no draft at all: the first is
    somebody's work, and it used to be discarded without a word. */
export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; value: Persisted }
  | { status: 'corrupt'; raw: string };

export function loadPersisted(): LoadResult {
  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: nothing saved, nothing lost.
    return { status: 'empty' };
  }
  if (stored === null || stored === '') return { status: 'empty' };
  const raw = stored;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { status: 'corrupt', raw };
    const rec = parsed as Record<string, unknown>;
    const schedule = isSchedule(rec['schedule']);
    if (!schedule) return { status: 'corrupt', raw };
    const ui = rec['ui'] as Partial<Persisted['ui']> | undefined;
    return {
      status: 'ok',
      value: {
        schedule,
        ui: {
          lang: ui?.lang === 'en' ? 'en' : 'tr',
          theme: ui?.theme === 'light' || ui?.theme === 'dark' ? ui.theme : 'system',
          step: ui?.step === 'board' ? 'board' : 'setup',
          view: ui?.view === 'matrix' ? 'matrix' : 'calendar',
        },
      },
    };
  } catch {
    return { status: 'corrupt', raw };
  }
}

/** Puts an unreadable draft somewhere the app will not write over it. */
export function keepCorrupt(raw: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    /* nothing else to try: the draft stays only in the message on screen */
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
