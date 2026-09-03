/** Domain model and constants. SPEC §1 and §2. */

export type ShiftType = 'DAY' | 'NIGHT';
export type InternId = string;
export type Lang = 'tr' | 'en';
export type ColorKey = 'blue' | 'teal' | 'green' | 'yellow' | 'orange' | 'indigo' | 'purple' | 'pink';

// Hand-out order, chosen by exhausting all 8! permutations: it maximises the
// smallest perceptual distance among the first n colours for every roster size.
// Worst pair by n: 4 -> 10.5, 5 -> 5.9, 6 -> 5.7, 7 -> 5.6, 8 -> 5.2 (OKLab x100).
export const COLOR_KEYS: readonly ColorKey[] = ['orange', 'green', 'blue', 'purple', 'teal', 'yellow', 'pink', 'indigo'];
export const SHIFT_TYPES: readonly ShiftType[] = ['DAY', 'NIGHT'];

export const DAYS = 28;
export const SLOTS = DAYS * 2;
export const QUOTA = 8;
export const NIGHT_GAP_MIN = 3;
export const HIGH_DENSITY_AT = 4;
export const MIN_INTERNS = 4;
export const MAX_INTERNS = 8;
export const MIN_PER_SHIFT_MIN = 1;
export const MIN_PER_SHIFT_MAX = 4;
export const NAME_MAX = 40;
export const POOL_MAX = 24;

export interface Intern {
  id: InternId;
  index: number;
  realName: string;
  colorKey: ColorKey;
  /** True when the user typed this name. A drawn name is not pinned, so drawing
      again reshuffles it; a typed name is never moved. */
  pinned: boolean;
}

export interface Assignment {
  internId: InternId;
  dayIndex: number;
  type: ShiftType;
  locked: boolean;
}

export interface Schedule {
  version: 1;
  startDate: string;
  interns: Intern[];
  minPerShift: number;
  assignments: Assignment[];
  /** Names waiting to be handed out to the interns that have none. */
  namePool: string[];
}

export type SlotKey = `${number}-${ShiftType}`;

export interface Cell {
  dayIndex: number;
  type: ShiftType;
}
