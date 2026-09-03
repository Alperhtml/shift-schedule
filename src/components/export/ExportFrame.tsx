import type { Lang, Schedule, ShiftType } from '../../engine/types';
import { DAYS } from '../../engine/types';
import { bySlot, slotKey } from '../../engine/schedule';
import { formatDay, rangeParts, weekdayLabels } from '../../engine/dates';
import { internLabel, t } from '../../i18n';
import { chipStyle, dotStyle } from '../board/chipStyle';
import { buildMatrix, type MatrixCell } from '../matrix/matrixModel';

export interface ExportFrameProps {
  schedule: Schedule;
  view: 'calendar' | 'matrix';
  lang: Lang;
  generatedOn: string;
}

/** Light palette regardless of the app theme, fixed 1600 px, no chrome, no badges. */
export function ExportFrame({ schedule, view, lang, generatedOn }: ExportFrameProps) {
  const range = rangeParts(schedule.startDate, lang);
  return (
    <div
      data-theme="light"
      style={{ width: 1600, padding: 48, background: '#FFFFFF' }}
      className="font-sans text-text"
    >
      <header className="flex items-baseline justify-between gap-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t(lang, 'export.header')}</h1>
        <p className="text-[15px] text-text-2">{`${range.start} – ${range.end}`}</p>
      </header>
      <p className="mt-1 text-[13px] text-text-2">{t(lang, view === 'matrix' ? 'matrix.legend' : 'shift.legend')}</p>

      <div className="mt-5">
        {view === 'calendar' ? <FrameCalendar schedule={schedule} lang={lang} /> : <FrameMatrix schedule={schedule} lang={lang} />}
      </div>

      <p className="mt-5 text-[11px] text-text-2">{t(lang, 'export.generated', { date: generatedOn })}</p>
    </div>
  );
}

function FrameZone({ schedule, lang, dayIndex, type }: { schedule: Schedule; lang: Lang; dayIndex: number; type: ShiftType }) {
  const list = bySlot(schedule).get(slotKey(dayIndex, type)) ?? [];
  return (
    <div
      style={{ background: type === 'NIGHT' ? 'var(--surface-2)' : '#FFFFFF' }}
      className="flex min-h-[62px] flex-wrap content-start gap-1.5 rounded-lg p-2 pt-6 relative"
    >
      <span className="absolute left-2 top-1.5 text-[11px] font-medium tracking-[.04em] text-text-2">
        {t(lang, type === 'NIGHT' ? 'shift.night.hours' : 'shift.day.hours')}
      </span>
      {list.map(a => {
        const intern = schedule.interns.find(i => i.id === a.internId);
        if (!intern) return null;
        return (
          <span key={a.internId} style={chipStyle(intern.colorKey)} className="inline-flex items-center rounded-[var(--radius-control)] px-2 py-0.5 text-[15px] font-medium">
            {internLabel(intern, lang)}
          </span>
        );
      })}
    </div>
  );
}

function FrameCalendar({ schedule, lang }: { schedule: Schedule; lang: Lang }) {
  const labels = weekdayLabels(lang);
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-2 px-1">
        {labels.map(l => (
          <span key={l} className="text-[13px] font-medium uppercase tracking-[.04em] text-text-2">{l}</span>
        ))}
      </div>
      {[0, 1, 2, 3].map(w => (
        <div key={w} className="mb-2">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{t(lang, 'week.label', { n: w + 1 })}</p>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, k) => w * 7 + k).filter(d => d < DAYS).map(d => (
              <div key={d} className="flex min-h-[168px] flex-col gap-1.5 rounded-[var(--radius-card)] border border-hairline p-2">
                <span className="px-1 text-[15px] font-medium">{formatDay(schedule.startDate, d, lang, 'd MMM')}</span>
                <FrameZone schedule={schedule} lang={lang} dayIndex={d} type="DAY" />
                <FrameZone schedule={schedule} lang={lang} dayIndex={d} type="NIGHT" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FrameMatrix({ schedule, lang }: { schedule: Schedule; lang: Lang }) {
  const { rows } = buildMatrix(schedule);
  const days = Array.from({ length: DAYS }, (_, d) => d);
  const code = (cell: MatrixCell): string =>
    cell === 'DAY' ? t(lang, 'matrix.code.day')
      : cell === 'NIGHT' ? t(lang, 'matrix.code.night')
        : cell === 'BOTH' ? `${t(lang, 'matrix.code.day')}/${t(lang, 'matrix.code.night')}`
          : '';
  return (
    <table className="w-full border-collapse text-[15px]">
      <thead>
        <tr>
          <th className="px-3 py-2 text-left text-[13px] font-semibold text-text-2">{t(lang, 'export.col.intern')}</th>
          {days.map(d => (
            <th key={d} className="w-10 px-1 py-2 text-center text-[13px] font-semibold text-text-2">
              <span className="block">{formatDay(schedule.startDate, d, lang, 'EEE')}</span>
              <span className="block font-normal">{formatDay(schedule.startDate, d, lang, 'd')}</span>
            </th>
          ))}
          <th className="px-2 py-2 text-center text-[13px] font-semibold text-text-2">{t(lang, 'matrix.code.day')}</th>
          <th className="px-2 py-2 text-center text-[13px] font-semibold text-text-2">{t(lang, 'matrix.code.night')}</th>
          <th className="px-2 py-2 text-center text-[13px] font-semibold text-text-2">{t(lang, 'matrix.total')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.intern.id} className="border-t border-hairline">
            <td className="px-3 py-1 font-medium">
              <span className="flex items-center gap-2">
                <span style={dotStyle(r.intern.colorKey)} className="h-2 w-2 shrink-0 rounded-full" />
                {internLabel(r.intern, lang)}
              </span>
            </td>
            {r.cells.map((cell, d) => (
              <td key={d} style={{ background: cell === 'NIGHT' ? 'var(--surface-2)' : undefined }} className="h-10 px-1 text-center align-middle">
                {code(cell)}
              </td>
            ))}
            <td className="px-2 text-center text-text-2">{r.day}</td>
            <td className="px-2 text-center text-text-2">{r.night}</td>
            <td className="px-2 text-center font-medium">{r.day + r.night}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
