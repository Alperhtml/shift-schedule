import { useLang, useT } from '../../i18n';
import { useStore } from '../../state/store';
import { dateOf, formatDay } from '../../engine/dates';
import { SlotZone } from './SlotZone';

export function DayCell({ dayIndex }: { dayIndex: number }) {
  const { state } = useStore();
  const { lang } = useLang();
  const t = useT();
  const date = dateOf(state.schedule.startDate, dayIndex);
  const isFirstOfMonth = date.getDate() === 1;

  return (
    <div className="flex min-h-[148px] flex-col gap-1.5 rounded-[var(--radius-card)] border border-hairline bg-surface p-2">
      <div className="flex items-baseline justify-between gap-1 px-0.5">
        <span className={`text-[13px] ${isFirstOfMonth || dayIndex === 0 ? 'font-semibold text-text' : 'font-medium text-text'}`}>
          {formatDay(state.schedule.startDate, dayIndex, lang, 'd MMM')}
        </span>
        {dayIndex === 0 ? <span className="sr-only">{t('week.label', { n: 1 })}</span> : null}
      </div>
      <SlotZone dayIndex={dayIndex} type="DAY" />
      <SlotZone dayIndex={dayIndex} type="NIGHT" />
    </div>
  );
}
