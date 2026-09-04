import type { Assignment, InternId, Lang, Schedule, ShiftType } from '../engine/types';
import { MAX_INTERNS, MIN_INTERNS, MIN_PER_SHIFT_MAX, MIN_PER_SHIFT_MIN, NAME_MAX, POOL_MAX } from '../engine/types';
import { cleanPool, createSchedule, defaultMinPerShift, hasAssignment, makeInterns } from '../engine/schedule';
import { distributePool } from '../engine/pool';
import { isMonday, nextMonday } from '../engine/dates';
import { createRng } from '../engine/random';

export interface UiState {
  step: 'setup' | 'board';
  view: 'calendar' | 'matrix';
  lang: Lang;
  theme: 'system' | 'light' | 'dark';
  settingsOpen: boolean;
}

export interface AppState {
  schedule: Schedule;
  past: Schedule[];
  future: Schedule[];
  ui: UiState;
}

interface CellRef {
  dayIndex: number;
  shift: ShiftType;
}

export type Action =
  | { type: 'SET_START_DATE'; isoDate: string }
  | { type: 'SET_INTERN_COUNT'; n: number }
  | { type: 'SET_MODE'; mode: ScheduleMode }
  | { type: 'SET_INTERN_NAME'; id: InternId; name: string }
  | { type: 'SET_MIN_PER_SHIFT'; n: number }
  | { type: 'ASSIGN'; internId: InternId; dayIndex: number; shift: ShiftType }
  | { type: 'UNASSIGN'; internId: InternId; dayIndex: number; shift: ShiftType }
  | { type: 'MOVE'; internId: InternId; from: CellRef; to: CellRef }
  | { type: 'TOGGLE_LOCK'; internId: InternId; dayIndex: number; shift: ShiftType }
  | { type: 'RANDOMIZE'; assignments: Assignment[] }
  | { type: 'SET_NAME_POOL'; names: string[] }
  | { type: 'DISTRIBUTE_POOL'; seed: number }
  | { type: 'RESET'; keepLocked: boolean }
  | { type: 'LOAD_SCHEDULE'; schedule: Schedule }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_VIEW'; view: UiState['view'] }
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'SET_THEME'; theme: UiState['theme'] }
  | { type: 'SET_STEP'; step: UiState['step'] }
  | { type: 'SET_SETTINGS_OPEN'; open: boolean };

export type ScheduleMode = 'team' | 'solo';

/** A solo schedule is a roster of one, so the mode is read off the roster. */
export function modeOf(schedule: Schedule): ScheduleMode {
  return schedule.interns.length === 1 ? 'solo' : 'team';
}

export const HISTORY_CAP = 100;
/** Where leaving solo lands, and what a fresh board starts with. */
export const TEAM_DEFAULT = 6;

export function initialState(now: Date = new Date()): AppState {
  return {
    schedule: createSchedule(nextMonday(now), TEAM_DEFAULT),
    past: [],
    future: [],
    ui: { step: 'setup', view: 'calendar', lang: 'tr', theme: 'system', settingsOpen: false },
  };
}

function withHistory(state: AppState, schedule: Schedule): AppState {
  if (schedule === state.schedule) return state;
  return { ...state, schedule, past: [...state.past, state.schedule].slice(-HISTORY_CAP), future: [] };
}

/** Non-undoable edits live outside time: they are applied to the current schedule
    and to every snapshot in the history, so a later undo or redo cannot revive an
    old start date, an old name or an old staffing target. */
function outsideHistory(state: AppState, change: (s: Schedule) => Schedule): AppState {
  return {
    ...state,
    schedule: change(state.schedule),
    past: state.past.map(change),
    future: state.future.map(change),
  };
}

function withInternCount(state: AppState, n: number): AppState {
  const s = state.schedule;
  const interns = makeInterns(n, s.interns);
  if (interns.length === s.interns.length) return state;
  const ids = new Set(interns.map(i => i.id));
  // The default follows the count only while the user has not set a target of
  // their own; a chosen target survives a change of intern count.
  const untouched = s.minPerShift === defaultMinPerShift(s.interns.length);
  return withHistory(state, {
    ...s,
    interns,
    assignments: s.assignments.filter(a => ids.has(a.internId)),
    minPerShift: untouched ? defaultMinPerShift(interns.length) : s.minPerShift,
  });
}

const same = (a: Assignment, internId: InternId, dayIndex: number, type: ShiftType): boolean =>
  a.internId === internId && a.dayIndex === dayIndex && a.type === type;

/** The only writer of the schedule. Keeps every SPEC section 2 invariant. */
export function reducer(state: AppState, action: Action): AppState {
  const s = state.schedule;
  switch (action.type) {
    case 'SET_START_DATE':
      if (!isMonday(action.isoDate)) return state;
      return outsideHistory(state, x => ({ ...x, startDate: action.isoDate }));

    case 'SET_INTERN_COUNT':
      return withInternCount(state, Math.min(MAX_INTERNS, Math.max(MIN_INTERNS, action.n)));

    // Solo is one person planning their own month, so it is simply a roster of one.
    // Nothing stores which mode is on; the roster size is the mode.
    case 'SET_MODE':
      return withInternCount(state, action.mode === 'solo' ? 1 : TEAM_DEFAULT);

    case 'SET_INTERN_NAME': {
      // Only the length is capped here. Trimming on every keystroke of a controlled
      // input would swallow the space in "Ayşe Yılmaz"; the trim happens on blur and
      // at every serialisation boundary (withTrimmedNames). Typing pins the name, so
      // a later pool draw leaves it alone; clearing it opens the intern up again.
      const name = action.name.slice(0, NAME_MAX);
      return outsideHistory(state, x => ({
        ...x,
        interns: x.interns.map(i => (i.id === action.id ? { ...i, realName: name, pinned: name.trim() !== '' } : i)),
      }));
    }

    case 'SET_MIN_PER_SHIFT': {
      const n = Math.min(MIN_PER_SHIFT_MAX, Math.max(MIN_PER_SHIFT_MIN, Math.round(action.n)));
      // No early return on an equal current value: a snapshot can still hold an old
      // target, which undo would otherwise revive.
      return outsideHistory(state, x => ({ ...x, minPerShift: n }));
    }

    case 'ASSIGN':
      if (hasAssignment(s, action.internId, action.dayIndex, action.shift)) return state;
      if (!s.interns.some(i => i.id === action.internId)) return state;
      if (action.dayIndex < 0 || action.dayIndex >= 28) return state;
      return withHistory(state, {
        ...s,
        assignments: [...s.assignments, { internId: action.internId, dayIndex: action.dayIndex, type: action.shift, locked: false }],
      });

    case 'UNASSIGN': {
      const next = s.assignments.filter(a => !same(a, action.internId, action.dayIndex, action.shift));
      if (next.length === s.assignments.length) return state;
      return withHistory(state, { ...s, assignments: next });
    }

    case 'MOVE': {
      const src = s.assignments.find(a => same(a, action.internId, action.from.dayIndex, action.from.shift));
      if (!src || hasAssignment(s, action.internId, action.to.dayIndex, action.to.shift)) return state;
      return withHistory(state, {
        ...s,
        assignments: s.assignments.map(a => (a === src ? { ...a, dayIndex: action.to.dayIndex, type: action.to.shift } : a)),
      });
    }

    case 'TOGGLE_LOCK': {
      if (!hasAssignment(s, action.internId, action.dayIndex, action.shift)) return state;
      return withHistory(state, {
        ...s,
        assignments: s.assignments.map(a => (same(a, action.internId, action.dayIndex, action.shift) ? { ...a, locked: !a.locked } : a)),
      });
    }

    case 'RANDOMIZE': {
      // The solver ran against a snapshot; the roster may have shrunk meanwhile.
      const ids = new Set(s.interns.map(i => i.id));
      return withHistory(state, { ...s, assignments: action.assignments.filter(a => ids.has(a.internId)) });
    }

    case 'SET_NAME_POOL': {
      // The cap counts real names, not lines: blank lines are part of typing and
      // must not eat the allowance or make the text area delete what was pasted.
      let kept = 0;
      const names: string[] = [];
      for (const raw of action.names) {
        if (raw.trim() !== '') {
          if (kept >= POOL_MAX) continue;
          kept += 1;
        }
        names.push(raw);
      }
      return outsideHistory(state, x => ({ ...x, namePool: names }));
    }

    case 'DISTRIBUTE_POOL': {
      // Names live outside the history, so a draw is undone by drawing again.
      const drawn = distributePool(s.interns, cleanPool(s.namePool), createRng(action.seed));
      const byId = new Map(drawn.map(i => [i.id, i.realName] as const));
      return outsideHistory(state, x => ({
        ...x,
        interns: x.interns.map(i => (i.pinned ? i : { ...i, realName: byId.get(i.id) ?? '' })),
      }));
    }

    case 'RESET': {
      const next = action.keepLocked ? s.assignments.filter(a => a.locked) : [];
      if (next.length === s.assignments.length) return state;
      return withHistory(state, { ...s, assignments: next });
    }

    case 'LOAD_SCHEDULE':
      return { ...state, schedule: action.schedule, past: [], future: [] };

    case 'UNDO': {
      const prev = state.past[state.past.length - 1];
      return prev ? { ...state, schedule: prev, past: state.past.slice(0, -1), future: [s, ...state.future] } : state;
    }

    case 'REDO': {
      const next = state.future[0];
      return next ? { ...state, schedule: next, past: [...state.past, s], future: state.future.slice(1) } : state;
    }

    case 'SET_VIEW': return { ...state, ui: { ...state.ui, view: action.view } };
    case 'SET_LANG': return { ...state, ui: { ...state.ui, lang: action.lang } };
    case 'SET_THEME': return { ...state, ui: { ...state.ui, theme: action.theme } };
    case 'SET_STEP': return { ...state, ui: { ...state.ui, step: action.step } };
    case 'SET_SETTINGS_OPEN': return { ...state, ui: { ...state.ui, settingsOpen: action.open } };
  }
}
