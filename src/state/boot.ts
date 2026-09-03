import { decodeHash } from '../engine/codec';
import type { Schedule } from '../engine/types';
import { initialState, type AppState } from './reducer';
import { loadPersisted } from './persistence';

export type BootEvent = 'none' | 'loaded' | 'bad' | 'confirm';

export interface Boot {
  state: AppState;
  event: BootEvent;
  pending: Schedule | null;
}

/** SPEC section 8 boot order: stored draft first, then the hash.
    Pure enough to be called from both the store initialiser and the shell. */
export function readBoot(hash = typeof location === 'undefined' ? '' : location.hash): Boot {
  const base = initialState();
  const saved = loadPersisted();
  const state: AppState = saved ? { ...base, schedule: saved.schedule, ui: { ...base.ui, ...saved.ui } } : base;

  if (hash.length <= 1) return { state, event: 'none', pending: null };
  const decoded = decodeHash(hash);
  if (!decoded) return { state, event: 'bad', pending: null };

  const draftHasContent = state.schedule.assignments.length > 0
    || state.schedule.interns.some(i => i.realName.trim() !== '')
    || state.schedule.namePool.some(n => n.trim() !== '');
  if (draftHasContent) return { state, event: 'confirm', pending: decoded };

  return {
    state: { ...state, schedule: decoded, past: [], future: [], ui: { ...state.ui, step: 'board' } },
    event: 'loaded',
    pending: null,
  };
}
