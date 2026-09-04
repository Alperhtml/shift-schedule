import { decodeHash } from '../engine/codec';
import type { Schedule } from '../engine/types';
import { initialState, type AppState } from './reducer';
import { keepCorrupt, loadPersisted } from './persistence';

export type BootEvent = 'none' | 'loaded' | 'bad' | 'confirm';

export interface Boot {
  state: AppState;
  event: BootEvent;
  pending: Schedule | null;
  /** The unreadable draft, kept so it can be handed back before it is replaced. */
  corrupt: string | null;
}

/** SPEC section 8 boot order: stored draft first, then the hash.
    Pure enough to be called from both the store initialiser and the shell. */
export function readBoot(hash = typeof location === 'undefined' ? '' : location.hash): Boot {
  const base = initialState();
  const loaded = loadPersisted();
  // A draft that fails validation is moved aside before the app's first save can
  // land on top of it. Losing somebody's month silently is the worst thing this
  // application can do.
  const corrupt = loaded.status === 'corrupt' ? loaded.raw : null;
  if (corrupt !== null) keepCorrupt(corrupt);
  const saved = loaded.status === 'ok' ? loaded.value : null;
  const state: AppState = saved ? { ...base, schedule: saved.schedule, ui: { ...base.ui, ...saved.ui } } : base;

  if (hash.length <= 1) return { state, event: 'none', pending: null, corrupt };
  const decoded = decodeHash(hash);
  if (!decoded) return { state, event: 'bad', pending: null, corrupt };

  const draftHasContent = state.schedule.assignments.length > 0
    || state.schedule.interns.some(i => i.realName.trim() !== '')
    || state.schedule.namePool.some(n => n.trim() !== '');
  if (draftHasContent) return { state, event: 'confirm', pending: decoded, corrupt };

  return {
    state: { ...state, schedule: decoded, past: [], future: [], ui: { ...state.ui, step: 'board' } },
    event: 'loaded',
    pending: null,
    corrupt,
  };
}
