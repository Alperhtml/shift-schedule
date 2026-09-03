import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { tr, type Key } from './tr';
import { en } from './en';
import type { Intern, Lang, Schedule } from '../engine/types';
import type { Violation } from '../engine/rules';
import { formatDay } from '../engine/dates';

const DICT: Record<Lang, Record<Key, string>> = { tr, en };

export type { Key };
export type Params = Record<string, string | number>;

/** One pass, so a value that itself looks like a placeholder is never substituted. */
export function t(lang: Lang, key: Key, params?: Params): string {
  const s: string = DICT[lang][key];
  if (!params) return s;
  return s.replace(/\{([A-Za-z0-9]+)\}/g, (match, name: string) => {
    const v = params[name];
    return v === undefined ? match : String(v);
  });
}

export function localeTag(lang: Lang): string {
  return lang === 'tr' ? 'tr-TR' : 'en-US';
}

export function formatNumber(x: number, lang: Lang, digits = 1): string {
  return new Intl.NumberFormat(localeTag(lang), { maximumFractionDigits: digits }).format(x);
}

export function internLabel(intern: Intern, lang: Lang): string {
  const name = intern.realName.trim();
  return name !== '' ? name : t(lang, 'intern.placeholder', { n: intern.index });
}

/** The first word of the label, for the narrow mobile chips. */
export function shortLabel(intern: Intern, lang: Lang): string {
  const full = internLabel(intern, lang);
  return intern.realName.trim() !== '' ? (full.split(' ')[0] ?? full) : full;
}

export function violationMessage(v: Violation, schedule: Schedule, lang: Lang): string {
  const intern = schedule.interns.find(i => i.id === v.internId);
  const shiftWord = (type: 'DAY' | 'NIGHT' | undefined): string =>
    (type === 'NIGHT' ? t(lang, 'shift.night') : t(lang, 'shift.day')).toLocaleLowerCase(localeTag(lang));
  const date = (d: number): string => formatDay(schedule.startDate, d, lang, 'd MMM EEE');
  const base: Params = {
    ...v.params,
    intern: intern ? internLabel(intern, lang) : '',
    shift: shiftWord(v.type),
    date: v.dayIndex >= 0 ? date(v.dayIndex) : '',
  };
  switch (v.code) {
    case 'POST_NIGHT_DAY':
      return t(lang, 'v.POST_NIGHT_DAY', { ...base, date: date(v.related[0]?.dayIndex ?? v.dayIndex - 1) });
    case 'NIGHT_GAP':
      return t(lang, 'v.NIGHT_GAP', { ...base, date1: date(v.related[0]?.dayIndex ?? v.dayIndex), date2: date(v.dayIndex) });
    case 'UNDER_STAFFED':
      return t(lang, v.params['count'] === 0 ? 'v.UNDER_STAFFED.empty' : 'v.UNDER_STAFFED', base);
    default:
      return t(lang, `v.${v.code}` as Key, base);
  }
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangCtx>({ lang: 'tr', setLang: () => undefined });

export function LangProvider({ lang, setLang, children }: LangCtx & { children: ReactNode }) {
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  // Keeps CSS text-transform locale-correct: Turkish uppercases i as İ, English must not.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t(lang, 'app.title');
  }, [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangCtx {
  return useContext(LangContext);
}

export function useT(): (key: Key, params?: Params) => string {
  const { lang } = useLang();
  return useMemo(() => (key: Key, params?: Params) => t(lang, key, params), [lang]);
}
