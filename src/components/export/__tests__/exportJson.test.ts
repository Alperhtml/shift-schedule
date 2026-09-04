import { describe, it, expect } from 'vitest';
import { createSchedule } from '../../../engine/schedule';
import { jsonName } from '../exportJson';
import { nameSlug } from '../download';

/** Seven people exporting on the same Monday used to send seven files with the
    same name, and the merge list keyed on that name. SPEC §16. */
describe('json file name', () => {
  const solo = (name: string) => {
    const s = createSchedule('2026-09-07', 1);
    const intern = s.interns[0];
    if (!intern) throw new Error('no intern');
    intern.realName = name;
    return s;
  };

  it('carries the one named person', () => {
    expect(jsonName(solo('Ayşe Yılmaz'))).toBe('nobet-2026-09-07-ayse-yilmaz.json');
    expect(jsonName(solo('Çağrı Öztürk'))).toBe('nobet-2026-09-07-cagri-ozturk.json');
  });

  it('two people never produce the same name', () => {
    expect(jsonName(solo('Ali Veli'))).not.toBe(jsonName(solo('Veli Ali')));
  });

  it('falls back to the plain name when there is nobody to name it after', () => {
    expect(jsonName(createSchedule('2026-09-07', 6))).toBe('nobet-2026-09-07.json');
    expect(jsonName(solo('   '))).toBe('nobet-2026-09-07.json');
  });

  it('a team board with several names stays on the plain name', () => {
    const s = createSchedule('2026-09-07', 4);
    const [a, b] = s.interns;
    if (!a || !b) throw new Error('no interns');
    a.realName = 'Ali';
    b.realName = 'Berk';
    expect(jsonName(s)).toBe('nobet-2026-09-07.json');
  });

  it('slugs are safe for a file system and never empty-handed', () => {
    expect(nameSlug('Şule Ağaoğlu')).toBe('sule-agaoglu');
    expect(nameSlug('İlker')).toBe('ilker');
    expect(nameSlug('a/b\\c:d')).toBe('a-b-c-d');
    expect(nameSlug('...')).toBe('');
  });
});
