import type { Schedule } from '../../engine/types';
import { parseSchedule, type ScheduleParse } from '../../engine/codec';
import { tidyName, withTrimmedNames } from '../../engine/schedule';
import { download, fileStem, nameSlug } from './download';

/** The file name carries the one named person when there is exactly one, so seven
    colleagues do not all send `nobet-2026-09-07.json`. */
export function jsonName(schedule: Schedule): string {
  const named = schedule.interns.filter(i => tidyName(i.realName) !== '');
  const only = named.length === 1 ? named[0] : undefined;
  const slug = only ? nameSlug(tidyName(only.realName)) : '';
  return slug === '' ? `${fileStem(schedule.startDate)}.json` : `${fileStem(schedule.startDate)}-${slug}.json`;
}

export function exportJson(schedule: Schedule): string {
  const name = jsonName(schedule);
  download(new Blob([JSON.stringify(withTrimmedNames(schedule), null, 2)], { type: 'application/json' }), name);
  return name;
}

/** The parse result rather than a bare null, so the reason can be shown. */
export async function importJson(file: File): Promise<ScheduleParse> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: { code: 'shape' } };
  }
  try {
    return parseSchedule(JSON.parse(text) as unknown);
  } catch {
    return { ok: false, error: { code: 'shape' } };
  }
}
