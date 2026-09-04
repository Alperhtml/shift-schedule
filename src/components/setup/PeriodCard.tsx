import { DayPicker } from 'react-day-picker';
import { useStore } from '../../state/store';
import { useLang, useT } from '../../i18n';
import { LOCALES, dateOf, rangeParts, toIso, weekdayLabels } from '../../engine/dates';
import { DAYS } from '../../engine/types';
import { Card } from '../ui/Card';

export function PeriodCard() {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const start = dateOf(state.schedule.startDate, 0);
  const end = dateOf(state.schedule.startDate, DAYS - 1);
  const range = rangeParts(state.schedule.startDate, lang);
  // The picker's own two-letter abbreviations bypass the tr locale correction,
  // so the board's labels are reused here: Pzt Sal Çar Per Cum Cmt Paz.
  const labels = weekdayLabels(lang);

  return (
    <Card title={t('setup.period.title')}>
      <p className="text-[13px] leading-[1.5] text-text-2">{t('setup.period.hint')}</p>
      <div className="mt-3 flex justify-center">
        <DayPicker
          mode="single"
          required
          selected={start}
          defaultMonth={start}
          weekStartsOn={1}
          locale={LOCALES[lang]}
          disabled={{ dayOfWeek: [0, 2, 3, 4, 5, 6] }}
          modifiers={{ range: { from: start, to: end } }}
          modifiersClassNames={{ range: 'rdp-range' }}
          formatters={{ formatWeekdayName: date => labels[(date.getDay() + 6) % 7] ?? '' }}
          onSelect={d => dispatch({ type: 'SET_START_DATE', isoDate: toIso(d) })}
        />
      </div>
      <p className="mt-3 text-[13px] text-text-2">{t('setup.period.range', range)}</p>
      {state.schedule.assignments.length > 0 ? (
        <p className="mt-2 text-[12px] leading-[1.45] text-text-2">{t('setup.period.shift')}</p>
      ) : null}
    </Card>
  );
}
