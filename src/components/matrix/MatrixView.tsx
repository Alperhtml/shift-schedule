import { AlertCircle } from 'lucide-react';
import { useStore } from '../../state/store';
import { internLabel, useLang, useT } from '../../i18n';
import { formatDay } from '../../engine/dates';
import { DAYS } from '../../engine/types';
import { dotStyle } from '../board/chipStyle';
import { buildMatrix, type MatrixCell } from './matrixModel';

export function MatrixView() {
  const { state } = useStore();
  const { lang } = useLang();
  const t = useT();
  const { rows } = buildMatrix(state.schedule);
  const days = Array.from({ length: DAYS }, (_, d) => d);

  const letter = (cell: MatrixCell): string =>
    cell === 'DAY' ? t('matrix.code.day') : cell === 'NIGHT' ? t('matrix.code.night') : cell === 'BOTH' ? `${t('matrix.code.day')}/${t('matrix.code.night')}` : '';

  return (
    <section aria-label={t('board.tab.matrix')} className="min-w-0">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-hairline bg-surface">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[.04em] text-text-2">
                {t('export.col.intern')}
              </th>
              {days.map(d => (
                <th key={d} scope="col" className="min-w-9 px-1 py-2 text-center text-[11px] font-medium text-text-2">
                  <span className="block">{formatDay(state.schedule.startDate, d, lang, 'EEE')}</span>
                  <span className="tabular block text-text-3">{formatDay(state.schedule.startDate, d, lang, 'd')}</span>
                </th>
              ))}
              <th scope="col" className="px-2 py-2 text-center text-[11px] font-medium text-text-2">{t('matrix.code.day')}</th>
              <th scope="col" className="px-2 py-2 text-center text-[11px] font-medium text-text-2">{t('matrix.code.night')}</th>
              <th scope="col" className="px-2 py-2 text-center text-[11px] font-medium text-text-2">{t('matrix.total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.intern.id} className="group border-t border-hairline transition-colors hover:bg-accent-tint">
                <th scope="row" className="sticky left-0 z-10 max-w-[168px] truncate bg-surface px-3 py-1.5 text-left font-medium text-text transition-colors group-hover:bg-accent-tint">
                  <span className="flex items-center gap-2">
                    <span aria-hidden style={dotStyle(row.intern.colorKey)} className="h-2 w-2 shrink-0 rounded-full" />
                    <span className="truncate">{internLabel(row.intern, lang)}</span>
                  </span>
                </th>
                {row.cells.map((cell, d) => (
                  <td
                    key={d}
                    className={`h-8 px-1 text-center align-middle ${cell === 'NIGHT' ? 'bg-surface-2' : ''} ${cell === 'BOTH' ? 'text-error' : 'text-text'}`}
                  >
                    <span className="inline-flex items-center justify-center gap-0.5 text-[13px] font-medium">
                      {letter(cell)}
                      {cell === 'BOTH' ? <AlertCircle aria-label={t('a11y.violation')} size={11} strokeWidth={2.5} /> : null}
                    </span>
                  </td>
                ))}
                <td className="tabular px-2 text-center text-text-2">{row.day}</td>
                <td className="tabular px-2 text-center text-text-2">{row.night}</td>
                <td className="tabular px-2 text-center font-medium text-text">{row.day + row.night}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 px-1 text-[11px] text-text-2">{t('matrix.legend')}</p>
    </section>
  );
}
