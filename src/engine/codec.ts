import type { Assignment, Intern, Schedule, ShiftType } from './types';
import { DAYS, MAX_INTERNS, MIN_PER_SHIFT_MAX, MIN_PER_SHIFT_MIN, NAME_MAX } from './types';
import { isMonday } from './dates';
import { cleanPool, makeInterns, withTrimmedNames } from './schedule';

const VERSION = 'v1';

export function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('not base64url');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
}

/** SPEC §7.2. `#v1.<YYYYMMDD>.<N>.<min>.<names>.<grid>` */
export function encodeHash(raw: Schedule): string {
  const s = withTrimmedNames(raw);
  const date = s.startDate.replace(/-/g, '');
  const names = s.interns.map(i => i.realName);
  const namesField = names.every(x => x === '') ? '' : toBase64Url(JSON.stringify(names));
  const grid = s.interns.map(intern => {
    const row = new Array<string>(DAYS * 2).fill('0');
    for (const a of s.assignments) {
      if (a.internId === intern.id) row[a.dayIndex * 2 + (a.type === 'NIGHT' ? 1 : 0)] = a.locked ? '2' : '1';
    }
    return row.join('');
  }).join('');
  const poolField = s.namePool.length === 0 ? '' : toBase64Url(JSON.stringify(s.namePool));
  // The pool is a seventh field and is left off when empty, so a link stays short
  // and every link written before the pool existed still decodes.
  return poolField === ''
    ? `${VERSION}.${date}.${s.interns.length}.${s.minPerShift}.${namesField}.${grid}`
    : `${VERSION}.${date}.${s.interns.length}.${s.minPerShift}.${namesField}.${grid}.${poolField}`;
}

export function decodeHash(raw: string): Schedule | null {
  const hash = raw.startsWith('#') ? raw.slice(1) : raw;
  const parts = hash.split('.');
  if (parts.length !== 6 && parts.length !== 7) return null;
  const [v, date, nStr, minStr, namesField, grid, poolField] = parts;
  if (v !== VERSION || date === undefined || nStr === undefined || minStr === undefined || namesField === undefined || grid === undefined) return null;
  if (!/^\d{8}$/.test(date)) return null;
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  if (!isMonday(iso)) return null;
  const n = Number(nStr);
  const min = Number(minStr);
  if (!/^\d+$/.test(nStr) || !Number.isInteger(n) || n < 1 || n > MAX_INTERNS) return null;
  if (!/^\d+$/.test(minStr) || !Number.isInteger(min) || min < MIN_PER_SHIFT_MIN || min > MIN_PER_SHIFT_MAX) return null;

  let names: string[] = [];
  if (namesField !== '') {
    try {
      const parsed: unknown = JSON.parse(fromBase64Url(namesField));
      if (!Array.isArray(parsed) || !parsed.every((x): x is string => typeof x === 'string')) return null;
      names = parsed;
    } catch {
      return null;
    }
  }
  if (grid.length !== DAYS * 2 * n || !/^[012]*$/.test(grid)) return null;

  let namePool: string[] = [];
  if (poolField !== undefined && poolField !== '') {
    try {
      const parsed: unknown = JSON.parse(fromBase64Url(poolField));
      if (!Array.isArray(parsed) || !parsed.every((x): x is string => typeof x === 'string')) return null;
      namePool = cleanPool(parsed);
    } catch {
      return null;
    }
  }

  // A name arriving in a link is treated as typed, so opening someone else's board
  // and pressing the draw button cannot reshuffle the names they sent.
  const interns: Intern[] = makeInterns(n).map((i, k) => {
    const realName = (names[k] ?? '').trim().slice(0, NAME_MAX);
    return { ...i, realName, pinned: realName !== '' };
  });
  const rows: { a: Assignment; k: number }[] = [];
  interns.forEach((intern, k) => {
    for (let p = 0; p < DAYS * 2; p++) {
      const ch = grid[k * DAYS * 2 + p];
      if (ch === undefined || ch === '0') continue;
      const type: ShiftType = p % 2 === 1 ? 'NIGHT' : 'DAY';
      rows.push({ a: { internId: intern.id, dayIndex: Math.floor(p / 2), type, locked: ch === '2' }, k });
    }
  });
  // Canonical order, the same one solve() emits: day, then DAY before NIGHT, then intern.
  rows.sort((x, y) =>
    x.a.dayIndex - y.a.dayIndex
    || (x.a.type === y.a.type ? 0 : x.a.type === 'DAY' ? -1 : 1)
    || x.k - y.k);
  return { version: 1, startDate: iso, interns, minPerShift: min, assignments: rows.map(r => r.a), namePool };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Validates every SPEC §2 invariant and returns a normalised copy, or null. */
export function isSchedule(x: unknown): Schedule | null {
  if (!isRecord(x) || x['version'] !== 1) return null;
  const { startDate, interns, minPerShift, assignments, namePool } = x;
  if (typeof startDate !== 'string' || !isMonday(startDate)) return null;
  // One is allowed: a solo file holds the single person who filled it.
  if (!Array.isArray(interns) || interns.length < 1 || interns.length > MAX_INTERNS) return null;

  const cleanInterns = makeInterns(interns.length);
  for (let k = 0; k < interns.length; k++) {
    const raw: unknown = interns[k];
    const expected = cleanInterns[k];
    if (!isRecord(raw) || expected === undefined || raw['id'] !== expected.id || raw['index'] !== expected.index) return null;
    const name = raw['realName'];
    if (typeof name !== 'string') return null;
    expected.realName = name.trim().slice(0, NAME_MAX);
    // Files written before names could be pinned treat every name as typed.
    expected.pinned = typeof raw['pinned'] === 'boolean' ? raw['pinned'] : expected.realName !== '';
  }

  if (typeof minPerShift !== 'number' || !Number.isInteger(minPerShift) || minPerShift < MIN_PER_SHIFT_MIN || minPerShift > MIN_PER_SHIFT_MAX) return null;
  if (!Array.isArray(assignments)) return null;

  const ids = new Set(cleanInterns.map(i => i.id));
  const seen = new Set<string>();
  const cleanAssignments: Assignment[] = [];
  for (const raw of assignments as unknown[]) {
    if (!isRecord(raw)) return null;
    const { internId, dayIndex, type, locked } = raw;
    if (typeof internId !== 'string' || !ids.has(internId)) return null;
    if (typeof dayIndex !== 'number' || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= DAYS) return null;
    if (type !== 'DAY' && type !== 'NIGHT') return null;
    if (typeof locked !== 'boolean') return null;
    const key = `${internId}|${dayIndex}|${type}`;
    if (seen.has(key)) return null;
    seen.add(key);
    cleanAssignments.push({ internId, dayIndex, type, locked });
  }
  if (namePool !== undefined && (!Array.isArray(namePool) || !namePool.every(n => typeof n === 'string'))) return null;
  return {
    version: 1,
    startDate,
    interns: cleanInterns,
    minPerShift,
    assignments: cleanAssignments,
    namePool: cleanPool((namePool as string[] | undefined) ?? []),
  };
}
