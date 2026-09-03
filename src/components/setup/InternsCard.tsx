import { useState } from 'react';
import { useStore } from '../../state/store';
import { useLang, useT, internLabel } from '../../i18n';
import { MAX_INTERNS, MIN_INTERNS, NAME_MAX } from '../../engine/types';
import { affectedByShrink } from '../../state/helpers';
import { Card } from '../ui/Card';
import { Stepper } from '../ui/Stepper';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export function InternsCard({ onTouch }: { onTouch?: (() => void) | undefined }) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const [pending, setPending] = useState<number | null>(null);

  const request = (n: number): void => {
    onTouch?.();
    const affected = affectedByShrink(state.schedule, n);
    if (n < state.schedule.interns.length && affected.assignments > 0) setPending(n);
    else dispatch({ type: 'SET_INTERN_COUNT', n });
  };
  const confirm = pending === null ? { interns: 0, assignments: 0 } : affectedByShrink(state.schedule, pending);

  return (
    <Card title={t('setup.interns.title')}>
      <Stepper
        value={state.schedule.interns.length}
        min={MIN_INTERNS}
        max={MAX_INTERNS}
        label={t('setup.interns.count')}
        onChange={request}
      />
      <p className="mt-5 mb-1.5 text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{t('setup.interns.name')}</p>
      <ul className="flex flex-col gap-2">
        {state.schedule.interns.map(intern => (
          <li key={intern.id} className="flex items-center gap-3">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--dot-${intern.colorKey})` }} />
            <input
              type="text"
              value={intern.realName}
              maxLength={NAME_MAX}
              aria-label={`${t('setup.interns.name')}, ${internLabel(intern, lang)}`}
              placeholder={t('intern.placeholder', { n: intern.index })}
              onFocus={() => onTouch?.()}
              onChange={e => dispatch({ type: 'SET_INTERN_NAME', id: intern.id, name: e.target.value })}
              onBlur={e => {
                const trimmed = e.target.value.trim();
                if (trimmed !== e.target.value) dispatch({ type: 'SET_INTERN_NAME', id: intern.id, name: trimmed });
              }}
              className="h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-[16px] md:text-[15px] text-text
                placeholder:text-text-3 transition-[border-color] duration-[var(--dur-fast)] focus:border-transparent"
            />
          </li>
        ))}
      </ul>

      <Dialog
        open={pending !== null}
        title={t('dialog.internCount.title')}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button onClick={() => setPending(null)}>{t('dialog.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending !== null) dispatch({ type: 'SET_INTERN_COUNT', n: pending });
                setPending(null);
              }}
            >
              {t('dialog.internCount.confirm')}
            </Button>
          </>
        }
      >
        {t('dialog.internCount.body', { n: confirm.interns, a: confirm.assignments })}
      </Dialog>
    </Card>
  );
}
