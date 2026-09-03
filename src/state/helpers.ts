import type { Schedule } from '../engine/types';
import { makeInterns } from '../engine/schedule';

export function unlockedCount(s: Schedule): number {
  return s.assignments.filter(a => !a.locked).length;
}

/** What a shrink to `n` interns would remove. */
export function affectedByShrink(s: Schedule, n: number): { interns: number; assignments: number } {
  const kept = new Set(makeInterns(n, s.interns).map(i => i.id));
  const removed = s.interns.filter(i => !kept.has(i.id));
  return {
    interns: removed.length,
    assignments: s.assignments.filter(a => !kept.has(a.internId)).length,
  };
}
