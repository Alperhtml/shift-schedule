import type * as XLSXNS from 'xlsx';
import type { Lang, Schedule } from '../../engine/types';
import { DAYS, QUOTA } from '../../engine/types';
import { bySlot, slotKey } from '../../engine/schedule';
import { formatDay } from '../../engine/dates';
import { internLabel, t } from '../../i18n';
import { buildMatrix, type MatrixCell } from '../matrix/matrixModel';
import { download, fileStem } from './download';

function namesIn(schedule: Schedule, dayIndex: number, type: 'DAY' | 'NIGHT', lang: Lang): string {
  const list = bySlot(schedule).get(slotKey(dayIndex, type)) ?? [];
  return list
    .map(a => schedule.interns.find(i => i.id === a.internId))
    .filter((i): i is NonNullable<typeof i> => i !== undefined)
    .map(i => internLabel(i, lang))
    .join(', ');
}

/** Pure: the SheetJS module is injected so it can be loaded on demand. */
export function buildWorkbook(XLSX: typeof XLSXNS, schedule: Schedule, lang: Lang): XLSXNS.WorkBook {
  const wb = XLSX.utils.book_new();
  const head = {
    date: t(lang, 'export.col.date'),
    weekday: t(lang, 'export.col.weekday'),
    day: t(lang, 'export.col.dayShift'),
    night: t(lang, 'export.col.nightShift'),
  };

  const calendar = Array.from({ length: DAYS }, (_, d) => ({
    [head.date]: formatDay(schedule.startDate, d, lang, 'd MMM yyyy'),
    [head.weekday]: formatDay(schedule.startDate, d, lang, 'EEEE'),
    [head.day]: namesIn(schedule, d, 'DAY', lang),
    [head.night]: namesIn(schedule, d, 'NIGHT', lang),
  }));
  const wsCalendar = XLSX.utils.json_to_sheet(calendar, { header: [head.date, head.weekday, head.day, head.night] });
  wsCalendar['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 44 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, wsCalendar, t(lang, 'export.sheet.calendar'));

  const code = (cell: MatrixCell): string =>
    cell === 'DAY' ? t(lang, 'matrix.code.day')
      : cell === 'NIGHT' ? t(lang, 'matrix.code.night')
        : cell === 'BOTH' ? `${t(lang, 'matrix.code.day')}/${t(lang, 'matrix.code.night')}`
          : '';
  const matrix = buildMatrix(schedule);
  const matrixRows: (string | number)[][] = [
    [
      t(lang, 'export.col.intern'),
      ...Array.from({ length: DAYS }, (_, d) => formatDay(schedule.startDate, d, lang, 'EEE d')),
      t(lang, 'export.col.dayShift'),
      t(lang, 'export.col.nightShift'),
      t(lang, 'matrix.total'),
    ],
    ...matrix.rows.map(r => [
      internLabel(r.intern, lang),
      ...r.cells.map(code),
      r.day,
      r.night,
      r.day + r.night,
    ]),
  ];
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrixRows);
  wsMatrix['!cols'] = [{ wch: 22 }, ...Array.from({ length: DAYS }, () => ({ wch: 5 })), { wch: 8 }, { wch: 8 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsMatrix, t(lang, 'export.sheet.matrix'));

  const slots = bySlot(schedule);
  let empty = 0;
  let short = 0;
  for (let d = 0; d < DAYS; d++) {
    for (const type of ['DAY', 'NIGHT'] as const) {
      const c = slots.get(slotKey(d, type))?.length ?? 0;
      if (c === 0) empty += 1;
      if (c < schedule.minPerShift) short += 1;
    }
  }
  const summaryRows: (string | number)[][] = [
    [t(lang, 'export.col.intern'), t(lang, 'export.col.dayShift'), t(lang, 'export.col.nightShift'), t(lang, 'matrix.total')],
    ...matrix.rows.map(r => [internLabel(r.intern, lang), r.day, r.night, r.day + r.night]),
    [],
    [t(lang, 'export.summary.stat'), '', '', ''],
    [t(lang, 'export.summary.emptySlots'), empty, '', ''],
    [t(lang, 'export.summary.shortSlots'), short, '', ''],
    [t(lang, 'setup.staffing.min'), schedule.minPerShift, '', ''],
    [t(lang, 'chip.complete'), matrix.rows.filter(r => r.day === QUOTA && r.night === QUOTA).length, '', ''],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, t(lang, 'export.sheet.summary'));

  return wb;
}

export async function exportXlsx(schedule: Schedule, lang: Lang): Promise<string> {
  const XLSX = await import('xlsx');
  const name = `${fileStem(schedule.startDate)}.xlsx`;
  const out = XLSX.write(buildWorkbook(XLSX, schedule, lang), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  return name;
}
