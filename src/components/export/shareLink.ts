import type { Schedule } from '../../engine/types';
import { encodeHash } from '../../engine/codec';

export function linkFor(schedule: Schedule): string {
  return `${location.origin}${location.pathname}#${encodeHash(schedule)}`;
}

/** Writes the hash and copies the URL. Returns 'manual' when the clipboard is unavailable. */
export async function copyLink(schedule: Schedule): Promise<'copied' | 'manual'> {
  try {
    history.replaceState(null, '', `#${encodeHash(schedule)}`);
  } catch {
    /* null origin or a sandboxed frame: the link still works, the address bar just does not update */
  }
  try {
    await navigator.clipboard.writeText(linkFor(schedule));
    return 'copied';
  } catch {
    return 'manual';
  }
}
