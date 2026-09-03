import { describe, it, expect } from 'vitest';
import { makeInterns } from '../schedule';
import { distributePool, poolFit } from '../pool';
import { createRng } from '../random';
import type { Intern } from '../types';

/** A name in this list is a name the user typed, so it is pinned. */
const named = (names: (string | undefined)[]): Intern[] =>
  makeInterns(names.length).map((i, k) => ({ ...i, realName: names[k] ?? '', pinned: (names[k] ?? '') !== '' }));

describe('distributePool', () => {
  it('fills only the blanks and never touches a typed name', () => {
    const interns = named(['Ayşe Yılmaz', '', '', 'Can Öz']);
    const out = distributePool(interns, ['Mehmet', 'Zeynep', 'Elif'], createRng(3));
    expect(out[0]?.realName).toBe('Ayşe Yılmaz');
    expect(out[3]?.realName).toBe('Can Öz');
    expect(out[1]?.realName).not.toBe('');
    expect(out[2]?.realName).not.toBe('');
    expect(new Set(out.map(i => i.realName)).size).toBe(4);
    expect(out.map(i => i.id)).toEqual(interns.map(i => i.id));
    expect(out.map(i => i.colorKey)).toEqual(interns.map(i => i.colorKey));
  });

  it('does not hand out a name an intern already carries, Turkish casing included', () => {
    const interns = named(['İclal', '', '']);
    const out = distributePool(interns, ['iclal', 'Deniz'], createRng(1));
    expect(out[0]?.realName).toBe('İclal');
    expect(out.filter(i => i.realName.toLocaleLowerCase('tr-TR') === 'iclal')).toHaveLength(1);
    expect(out[1]?.realName).toBe('Deniz');
    expect(out[2]?.realName).toBe('');
  });

  it('leaves blanks when the pool is short, and is a no-op for an empty pool', () => {
    const interns = named(['', '', '', '']);
    const out = distributePool(interns, ['Tek'], createRng(9));
    expect(out.filter(i => i.realName !== '')).toHaveLength(1);
    expect(distributePool(interns, [], createRng(9)).map(i => i.realName)).toEqual(['', '', '', '']);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const interns = named(['', '', '', '']);
    const pool = ['A', 'B', 'C', 'D'];
    expect(distributePool(interns, pool, createRng(5)).map(i => i.realName))
      .toEqual(distributePool(interns, pool, createRng(5)).map(i => i.realName));
    const many = new Set([1, 2, 3, 4, 5, 6].map(s => distributePool(interns, pool, createRng(s)).map(i => i.realName).join('|')));
    expect(many.size).toBeGreaterThan(1);
  });

  it('poolFit counts open slots and the names still available', () => {
    // makeInterns never returns fewer than four, so this roster is Ayşe plus three blanks.
    const interns = named(['Ayşe', '', '', '']);
    expect(poolFit(interns, ['Ayşe', 'Can', 'Ece'])).toEqual({ open: 3, available: 2 });
    expect(poolFit(interns, [])).toEqual({ open: 3, available: 0 });
  });

  it('drawing again reshuffles the drawn names and still leaves typed ones alone', () => {
    const interns = named(['Ayşe Yılmaz', '', '', '']);
    const pool = ['Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı'];
    const first = distributePool(interns, pool, createRng(1));
    expect(first[0]).toMatchObject({ realName: 'Ayşe Yılmaz', pinned: true });
    expect(poolFit(first, pool)).toEqual({ open: 3, available: 6 });

    const draws = new Set([2, 3, 4, 5, 6, 7].map(seed => distributePool(first, pool, createRng(seed)).map(i => i.realName).join('|')));
    expect(draws.size).toBeGreaterThan(1);
    for (const seed of [2, 3, 4, 5]) {
      const again = distributePool(first, pool, createRng(seed));
      expect(again[0]?.realName).toBe('Ayşe Yılmaz');
      expect(new Set(again.map(i => i.realName)).size).toBe(4);
    }
  });

  it('a shrinking pool clears the names it can no longer supply', () => {
    const interns = named(['', '', '', '']);
    const full = distributePool(interns, ['A', 'B', 'C', 'D'], createRng(1));
    expect(full.filter(i => i.realName !== '')).toHaveLength(4);
    const shrunk = distributePool(full, ['A'], createRng(1));
    expect(shrunk.filter(i => i.realName !== '')).toHaveLength(1);
  });
});
