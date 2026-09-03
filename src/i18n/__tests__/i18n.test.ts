import { describe, it, expect } from 'vitest';
import { tr } from '../tr';
import { en } from '../en';
import { internLabel, shortLabel, t, violationMessage } from '../index';
import { createSchedule } from '../../engine/schedule';
import { validate } from '../../engine/rules';

describe('dictionaries', () => {
  it('have identical key sets', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
  });
  it('have identical placeholders per key', () => {
    for (const key of Object.keys(tr) as (keyof typeof tr)[]) {
      const p = (s: string) => (s.match(/\{[a-z0-9]+\}/gi) ?? []).sort();
      expect(p(en[key])).toEqual(p(tr[key]));
    }
  });
  it('t replaces params', () => {
    expect(t('tr', 'intern.placeholder', { n: 3 })).toBe('İntörn 3');
    expect(t('en', 'chip.counts', { day: 1, night: 2 })).toBe('D 1/8 · N 2/8');
  });
  it('leaves no placeholder unfilled in any violation message', () => {
    const s = createSchedule('2026-09-07', 4);
    s.minPerShift = 2;
    s.assignments = [
      { internId: 'intern-1', dayIndex: 0, type: 'NIGHT', locked: false },
      { internId: 'intern-1', dayIndex: 1, type: 'DAY', locked: false },
      { internId: 'intern-1', dayIndex: 2, type: 'NIGHT', locked: false },
      { internId: 'intern-2', dayIndex: 3, type: 'DAY', locked: false },
      { internId: 'intern-2', dayIndex: 3, type: 'NIGHT', locked: false },
      ...Array.from({ length: 9 }, (_, k) => ({ internId: 'intern-3', dayIndex: k, type: 'DAY' as const, locked: false })),
      ...Array.from({ length: 4 }, (_, k) => ({ internId: `intern-${k + 1}`, dayIndex: 20, type: 'DAY' as const, locked: false })),
    ];
    const list = validate(s);
    const codes = new Set(list.map(v => v.code));
    expect(codes.size).toBeGreaterThanOrEqual(6);
    for (const lang of ['tr', 'en'] as const) {
      for (const v of list) {
        const msg = violationMessage(v, s, lang);
        expect(msg).not.toMatch(/\{[a-z0-9]+\}/i);
        expect(msg.length).toBeGreaterThan(3);
      }
    }
  });

  it('a blank-looking name falls back to the placeholder', () => {
    const s = createSchedule('2026-09-07', 4);
    const blank = { ...s.interns[0]!, realName: '   ' };
    const named = { ...s.interns[1]!, realName: '  Ayşe Yılmaz  ' };
    expect(internLabel(blank, 'tr')).toBe('İntörn 1');
    expect(internLabel(named, 'tr')).toBe('Ayşe Yılmaz');
    expect(shortLabel(named, 'tr')).toBe('Ayşe');
    expect(shortLabel(blank, 'en')).toBe('Intern 1');
  });
});
