import type { Intern } from './types';
import type { Rng } from './random';
import { cleanPool } from './schedule';

const key = (name: string): string => name.trim().toLocaleLowerCase('tr-TR');

/** Names the user typed. These are never moved, and never drawn again. */
function pinnedNames(interns: readonly Intern[]): Set<string> {
  const s = new Set<string>();
  for (const i of interns) {
    if (i.pinned && i.realName.trim() !== '') s.add(key(i.realName));
  }
  return s;
}

/** An intern is open to a draw when the user has not typed its name: either it is
    blank, or it carries a name a previous draw gave it. */
function isOpen(intern: Intern): boolean {
  return !intern.pinned;
}

/**
 * Hands pool names to every intern the user has not named. A typed name is fixed:
 * it is never moved, overwritten, or handed to somebody else. Drawing again
 * reshuffles only the drawn names. Fewer usable names than open slots leaves the
 * remainder blank.
 */
export function distributePool(interns: readonly Intern[], pool: readonly string[], rng: Rng): Intern[] {
  const taken = pinnedNames(interns);
  const available = rng.shuffle(cleanPool(pool).filter(n => !taken.has(key(n))));
  let next = 0;
  return interns.map(intern => {
    if (!isOpen(intern)) return { ...intern };
    const name = available[next];
    if (name === undefined) return { ...intern, realName: '' };
    next += 1;
    return { ...intern, realName: name };
  });
}

/** What a draw would do, without doing it. */
export function poolFit(interns: readonly Intern[], pool: readonly string[]): { open: number; available: number } {
  const taken = pinnedNames(interns);
  return {
    open: interns.filter(isOpen).length,
    available: cleanPool(pool).filter(n => !taken.has(key(n))).length,
  };
}
