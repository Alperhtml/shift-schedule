import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { createSchedule } from '../../../engine/schedule';
import { solve } from '../../../engine/solver';
import { buildWorkbook } from '../exportXlsx';

describe('buildWorkbook', () => {
  it('has three sheets with the expected shape', () => {
    const s = createSchedule('2026-09-07', 5);
    s.assignments = solve(s, { seed: 1, moves: 2000, restarts: 1 }).assignments;
    const wb = buildWorkbook(XLSX, s, 'tr');
    expect(wb.SheetNames).toEqual(['Takvim', 'Matris', 'Özet']);
    const takvim = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Takvim'] as XLSX.WorkSheet);
    expect(takvim).toHaveLength(28);
    expect(Object.keys(takvim[0] ?? {})).toEqual(['Tarih', 'Gün', 'Gündüz 08-20', 'Gece 20-08']);
    const matris = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Matris'] as XLSX.WorkSheet, { header: 1 });
    expect(matris).toHaveLength(6);
    const head = matris[0] ?? [];
    expect(head[0]).toBe('İntörn');
    expect(head[1]).toBe('Pzt 7');
    expect(head[28]).toBe('Paz 4');
    expect(head.slice(29)).toEqual(['Gündüz 08-20', 'Gece 20-08', 'Toplam']);
    expect(matris[1]?.slice(29)).toEqual([8, 8, 16]);

    const ozet = XLSX.utils.sheet_to_json<string[]>(wb.Sheets['Özet'] as XLSX.WorkSheet, { header: 1 });
    const labels = ozet.map(r => r[0]);
    expect(labels).toContain('Nöbet istatistiği');
    expect(labels).toContain('Boş nöbet');
    expect(labels).toContain('Hedefin altında nöbet');
    const empty = Number(ozet.find(r => r[0] === 'Boş nöbet')?.[1]);
    const short = Number(ozet.find(r => r[0] === 'Hedefin altında nöbet')?.[1]);
    // Every empty slot is also below any target of one or more.
    expect(Number.isInteger(empty)).toBe(true);
    expect(empty).toBeLessThanOrEqual(short);
    expect(short).toBeLessThanOrEqual(56);
  });
  it('uses English sheet names and headers in English', () => {
    const s = createSchedule('2026-09-07', 4);
    const wb = buildWorkbook(XLSX, s, 'en');
    expect(wb.SheetNames).toEqual(['Calendar', 'Matrix', 'Summary']);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Calendar'] as XLSX.WorkSheet);
    expect(Object.keys(rows[0] ?? {})).toEqual(['Date', 'Weekday', 'Day 08-20', 'Night 20-08']);
  });
});
