import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../../engine/schedule';
import { decodeHash } from '../../../engine/codec';
import { linkFor } from '../shareLink';

describe('linkFor', () => {
  it('builds a same-page URL whose hash decodes', () => {
    const s = createSchedule('2026-09-07', 4);
    const url = new URL(linkFor(s));
    expect(url.pathname).toBe(location.pathname);
    expect(decodeHash(url.hash)).toEqual(s);
  });
});
