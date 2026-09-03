import { describe, it, expect } from 'vitest';
import { createRng } from '../random';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
  it('next is in [0,1) and int(n) in [0,n)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const k = r.int(5);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(5);
    }
  });
  it('shuffle keeps the multiset and pick returns a member', () => {
    const r = createRng(3);
    const arr = r.shuffle([1, 2, 3, 4, 5]);
    expect([...arr].sort()).toEqual([1, 2, 3, 4, 5]);
    expect([1, 2, 3]).toContain(r.pick([1, 2, 3]));
  });
  it('accepts non-integer and huge seeds', () => {
    expect(() => createRng(Date.now() + 0.5)).not.toThrow();
  });
});
