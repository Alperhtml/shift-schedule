import type { Assignment, ColorKey, Intern, InternId, Schedule, ShiftType, SlotKey } from './types';
import { COLOR_KEYS, MAX_INTERNS, NAME_MAX, POOL_MAX } from './types';
import { at } from './util';

export function slotKey(dayIndex: number, type: ShiftType): SlotKey {
  return `${dayIndex}-${type}`;
}

export function parseSlotKey(key: SlotKey): { dayIndex: number; type: ShiftType } {
  const [d, t] = key.split('-');
  const dayIndex = Number(d);
  if (d === undefined || d === '' || !Number.isInteger(dayIndex) || (t !== 'DAY' && t !== 'NIGHT')) {
    throw new Error(`bad slot key ${key}`);
  }
  return { dayIndex, type: t };
}

/** Insertion order is assignment order. */
export function bySlot(s: Schedule): Map<SlotKey, Assignment[]> {
  const m = new Map<SlotKey, Assignment[]>();
  for (const a of s.assignments) {
    const k = slotKey(a.dayIndex, a.type);
    const list = m.get(k);
    if (list) list.push(a);
    else m.set(k, [a]);
  }
  return m;
}

export function byIntern(s: Schedule): Map<InternId, Assignment[]> {
  const m = new Map<InternId, Assignment[]>();
  for (const a of s.assignments) {
    const list = m.get(a.internId);
    if (list) list.push(a);
    else m.set(a.internId, [a]);
  }
  return m;
}

export function counts(s: Schedule, internId: InternId): { day: number; night: number } {
  let day = 0;
  let night = 0;
  for (const a of s.assignments) {
    if (a.internId !== internId) continue;
    if (a.type === 'DAY') day += 1;
    else night += 1;
  }
  return { day, night };
}

export function hasAssignment(s: Schedule, internId: InternId, dayIndex: number, type: ShiftType): boolean {
  return s.assignments.some(a => a.internId === internId && a.dayIndex === dayIndex && a.type === type);
}

export function averagePerSlot(n: number): number {
  return (16 * n) / 56;
}

export function defaultMinPerShift(n: number): number {
  return Math.max(1, Math.floor((16 * n) / 56));
}

export function colorFor(index: number): ColorKey {
  return at(COLOR_KEYS, index - 1);
}

export function makeInterns(n: number, existing: readonly Intern[] = []): Intern[] {
  // Floor of one, not MIN_INTERNS: a solo schedule holds a single person. The
  // team floor is enforced where it belongs, on the setup stepper and its action.
  const count = Math.min(MAX_INTERNS, Math.max(1, n));
  return Array.from({ length: count }, (_, k) => {
    const index = k + 1;
    const prev = existing.find(i => i.index === index);
    return {
      id: `intern-${index}`,
      index,
      realName: prev?.realName ?? '',
      colorKey: colorFor(index),
      pinned: prev?.pinned ?? false,
    };
  });
}

/** Trimmed, inner runs of whitespace collapsed, capped. "Ayşe  Yılmaz" and
    "Ayşe Yılmaz" are one person, and a merge must not split them in two. */
export function tidyName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX);
}

/** Every way out of the app goes through this: stored draft, JSON file, share link.
    Names are trimmed here rather than on each keystroke, which would make a space
    untypable in a controlled input. */
export function withTrimmedNames(s: Schedule): Schedule {
  const pool = cleanPool(s.namePool);
  const internsClean = s.interns.every(i => i.realName === tidyName(i.realName));
  const poolClean = pool.length === s.namePool.length && pool.every((n, k) => n === s.namePool[k]);
  if (internsClean && poolClean) return s;
  return {
    ...s,
    interns: internsClean ? s.interns : s.interns.map(i => ({ ...i, realName: tidyName(i.realName) })),
    namePool: pool,
  };
}

/** Trimmed, non-empty, deduplicated, capped. The pool is free text the user types. */
export function cleanPool(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = tidyName(raw);
    if (name === '') continue;
    const key = name.toLocaleLowerCase('tr-TR');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= POOL_MAX) break;
  }
  return out;
}

export function createSchedule(startDate: string, n: number): Schedule {
  return { version: 1, startDate, interns: makeInterns(n), minPerShift: defaultMinPerShift(n), assignments: [], namePool: [] };
}
