import { AlertTriangle } from 'lucide-react';
import { useStore } from '../../state/store';
import { formatNumber, useLang, useT } from '../../i18n';
import { averagePerSlot } from '../../engine/schedule';
import { MIN_PER_SHIFT_MAX, MIN_PER_SHIFT_MIN } from '../../engine/types';
import { Card } from '../ui/Card';
import { Stepper } from '../ui/Stepper';

export function StaffingCard() {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const n = state.schedule.interns.length;
  const avg = averagePerSlot(n);

  return (
    <Card title={t('setup.staffing.title')}>
      <Stepper
        value={state.schedule.minPerShift}
        min={MIN_PER_SHIFT_MIN}
        max={MIN_PER_SHIFT_MAX}
        label={t('setup.staffing.min')}
        format={v => t('setup.staffing.people', { n: v })}
        onChange={v => dispatch({ type: 'SET_MIN_PER_SHIFT', n: v })}
      />
      <p className="tabular mt-4 text-[13px] leading-[1.5] text-text-2">
        {t('setup.staffing.math', { n, total: 16 * n, avg: formatNumber(avg, lang, 2) })}
      </p>
      {state.schedule.minPerShift > avg ? (
        <p className="anim-fade mt-2 flex items-start gap-2 text-[13px] leading-[1.5] text-warn">
          <AlertTriangle aria-hidden size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {t('setup.staffing.warn')}
        </p>
      ) : null}
    </Card>
  );
}
