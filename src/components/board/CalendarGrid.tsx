import { useLang, useT } from '../../i18n';
import { weekdayLabels } from '../../engine/dates';
import { DAYS } from '../../engine/types';
import { DayCell } from './DayCell';

export function CalendarGrid() {
  const { lang } = useLang();
  const t = useT();
  const labels = weekdayLabels(lang);
  const weeks = [0, 1, 2, 3];

  return (
    <div className="min-w-0">
      <div aria-hidden className="mb-1.5 grid grid-cols-7 gap-2 px-0.5">
        {labels.map(l => (
          <span key={l} className="text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{l}</span>
        ))}
      </div>
      {weeks.map(w => (
        <section key={w} aria-label={t('week.label', { n: w + 1 })}>
          <h3 className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-[.04em] text-text-2 first:mt-0">
            {t('week.label', { n: w + 1 })}
          </h3>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, k) => w * 7 + k)
              .filter(d => d < DAYS)
              .map(d => <DayCell key={d} dayIndex={d} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
