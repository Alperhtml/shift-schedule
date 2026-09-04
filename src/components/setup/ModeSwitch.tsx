import { useState } from 'react';
import { useStore } from '../../state/store';
import { modeOf, type ScheduleMode } from '../../state/reducer';
import { affectedByShrink } from '../../state/helpers';
import { useT } from '../../i18n';
import { Segmented } from '../ui/Segmented';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

/** Team or solo, on the setup screen and inside settings. Going solo drops
    everyone but the first person, so it asks first when there is anything
    to lose. SPEC §14.1. */
export function ModeSwitch({ showHint = false }: { showHint?: boolean | undefined }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const [pending, setPending] = useState<ScheduleMode | null>(null);
  const mode = modeOf(state.schedule);
  const loss = affectedByShrink(state.schedule, 1);

  const request = (next: ScheduleMode): void => {
    if (next === mode) return;
    if (next === 'solo' && (loss.assignments > 0 || state.schedule.interns.some((i, k) => k > 0 && i.realName.trim() !== ''))) {
      setPending(next);
      return;
    }
    dispatch({ type: 'SET_MODE', mode: next });
  };

  return (
    <>
      <Segmented<ScheduleMode>
        value={mode}
        options={[
          { value: 'team', label: t('setup.mode.team') },
          { value: 'solo', label: t('setup.mode.solo') },
        ]}
        onChange={request}
        ariaLabel={t('setup.mode.aria')}
      />
      {showHint ? (
        <p className="text-[13px] leading-[1.45] text-text-2">
          {t(mode === 'solo' ? 'setup.mode.hint.solo' : 'setup.mode.hint.team')}
        </p>
      ) : null}

      <Dialog
        open={pending !== null}
        title={t('dialog.mode.title')}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button onClick={() => setPending(null)}>{t('dialog.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pending) dispatch({ type: 'SET_MODE', mode: pending });
                setPending(null);
              }}
            >
              {t('dialog.mode.confirm')}
            </Button>
          </>
        }
      >
        {t('dialog.mode.body', { n: loss.interns, a: loss.assignments })}
      </Dialog>
    </>
  );
}
