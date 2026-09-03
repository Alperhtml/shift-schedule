import { describe, it, expect } from 'vitest';
import { dateOf, isMonday, nextMonday, rangeParts, weekdayOf, weekOf, formatDay, weekdayLabels, toIso } from '../dates';

describe('dates', () => {
  it('isMonday', () => {
    expect(isMonday('2026-09-07')).toBe(true);
    expect(isMonday('2026-09-08')).toBe(false);
    expect(isMonday('nonsense')).toBe(false);
  });
  it('nextMonday includes today when today is Monday', () => {
    expect(nextMonday(new Date(2026, 8, 7, 15))).toBe('2026-09-07');
    expect(nextMonday(new Date(2026, 8, 9))).toBe('2026-09-14');
    expect(nextMonday(new Date(2026, 8, 13))).toBe('2026-09-14');
  });
  it('dateOf across the October DST change keeps calendar days', () => {
    const start = '2026-10-19';
    expect(toIso(dateOf(start, 6))).toBe('2026-10-25');
    expect(toIso(dateOf(start, 7))).toBe('2026-10-26');
    expect(toIso(dateOf(start, 27))).toBe('2026-11-15');
  });
  it('week and weekday arithmetic', () => {
    expect(weekOf(0)).toBe(0);
    expect(weekOf(6)).toBe(0);
    expect(weekOf(7)).toBe(1);
    expect(weekOf(27)).toBe(3);
    // Cross-checked against the real calendar rather than restating the formula:
    // weekdayOf is arithmetic only because startDate is always a Monday.
    for (const start of ['2026-09-07', '2026-10-19', '2027-01-04']) {
      for (let d = 0; d < 28; d++) {
        expect(weekdayOf(d)).toBe((dateOf(start, d).getDay() + 6) % 7);
      }
    }
  });
  it('formats in both locales', () => {
    expect(formatDay('2026-09-07', 0, 'tr', 'd MMM')).toBe('7 Eyl');
    expect(formatDay('2026-09-07', 0, 'en', 'd MMM')).toBe('7 Sep');
    expect(rangeParts('2026-09-07', 'tr')).toEqual({ start: '7 Eylül 2026', end: '4 Ekim 2026' });
    expect(weekdayLabels('tr')).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
    expect(formatDay('2026-09-07', 5, 'tr', 'd MMM EEE')).toBe('12 Eyl Cmt');
    expect(weekdayLabels('en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});
