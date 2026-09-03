import type { Schedule } from '../../engine/types';
import { isSchedule } from '../../engine/codec';
import { withTrimmedNames } from '../../engine/schedule';
import { download, fileStem } from './download';

export function exportJson(schedule: Schedule): string {
  const name = `${fileStem(schedule.startDate)}.json`;
  download(new Blob([JSON.stringify(withTrimmedNames(schedule), null, 2)], { type: 'application/json' }), name);
  return name;
}

export async function importJson(file: File): Promise<Schedule | null> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    return isSchedule(parsed);
  } catch {
    return null;
  }
}
