import { addDays, format, getDay, isValid, parseISO, startOfDay } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import type { Lang } from './types';
import { DAYS } from './types';

export const LOCALES: Record<Lang, Locale> = { tr, en: enUS };
const KNOWN_MONDAY = '2026-09-07';

export function toIso(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function isMonday(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISO(iso);
  return isValid(d) && getDay(d) === 1;
}

/** The coming Monday; today when today is a Monday. */
export function nextMonday(from: Date): string {
  const d = startOfDay(from);
  const offset = (8 - getDay(d)) % 7;
  return toIso(addDays(d, offset));
}

export function dateOf(startDate: string, dayIndex: number): Date {
  return addDays(parseISO(startDate), dayIndex);
}

export function weekOf(dayIndex: number): number {
  return Math.floor(dayIndex / 7);
}

/** Arithmetic, not a Date call, because startDate is always a Monday. */
export function weekdayOf(dayIndex: number): number {
  return dayIndex % 7;
}

/** date-fns abbreviates Cumartesi as "Cts"; TDK writes "Cmt". The only hand-made
    correction to locale output. Extend this table rather than hand-typing names. */
const TR_FIXES: [RegExp, string][] = [[/\bCts\b/g, 'Cmt']];

export function formatDay(startDate: string, dayIndex: number, lang: Lang, pattern: string): string {
  const out = format(dateOf(startDate, dayIndex), pattern, { locale: LOCALES[lang] });
  return lang === 'tr' ? TR_FIXES.reduce((acc, [re, to]) => acc.replace(re, to), out) : out;
}

export function rangeParts(startDate: string, lang: Lang): { start: string; end: string } {
  return {
    start: formatDay(startDate, 0, lang, 'd MMMM yyyy'),
    end: formatDay(startDate, DAYS - 1, lang, 'd MMMM yyyy'),
  };
}

export function weekdayLabels(lang: Lang): string[] {
  return Array.from({ length: 7 }, (_, k) => formatDay(KNOWN_MONDAY, k, lang, 'EEE'));
}
