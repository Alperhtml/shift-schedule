import { useLang, useT } from '../../i18n';
import { useStore } from '../../state/store';
import { formatDay } from '../../engine/dates';
import { DAYS } from '../../engine/types';
import { SlotZone } from './SlotZone';

export function MobileList() {
  const { state } = useStore();
  const { lang } = useLang();
  const t = useT();

  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map(w => (
        <section key={w} aria-label={t('week.label', { n: w + 1 })}>
          <h3 className="mb-1 px-1 text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{t('week.label', { n: w + 1 })}</h3>
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 7 }, (_, k) => w * 7 + k).filter(d => d < DAYS).map(d => (
              <div key={d} className="flex items-stretch gap-1.5 rounded-[var(--radius-card)] border border-hairline bg-surface p-1.5">
                <div className="flex w-14 shrink-0 flex-col justify-center px-1">
                  <span className="text-[13px] font-medium text-text">{formatDay(state.schedule.startDate, d, lang, 'd MMM')}</span>
                  <span className="text-[11px] text-text-2">{formatDay(state.schedule.startDate, d, lang, 'EEE')}</span>
                </div>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
                  <SlotZone dayIndex={d} type="DAY" minHeight={56} compactChips />
                  <SlotZone dayIndex={d} type="NIGHT" minHeight={56} compactChips />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
