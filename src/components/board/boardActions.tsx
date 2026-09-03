import { useState, type ReactNode } from 'react';
import type { Assignment } from '../../engine/types';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { unlockedCount } from '../../state/helpers';
import { poolFit } from '../../engine/pool';
import { runSolver } from '../../state/solverClient';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';

export interface BoardActions {
  busy: boolean;
  randomize: () => void;
  reset: () => void;
  dialogs: ReactNode;
}

/** The three destructive or long-running board actions, with their confirmations.
    Both the desktop toolbar and the mobile overflow menu call into this. */
export function useBoardActions(onFilled: (assignments: Assignment[]) => void): BoardActions {
  const { state, dispatch } = useStore();
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [askRandomize, setAskRandomize] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [keepLocked, setKeepLocked] = useState(false);
  const [keepPlaced, setKeepPlaced] = useState(false);

  const fill = (keep: boolean): void => {
    setBusy(true);
    const started = Date.now();
    void (async () => {
      try {
        // "Keep what I placed" is the lock rule applied to everything already on the
        // board: the solver treats those cells as fixed and fills around them.
        const input = keep
          ? { ...state.schedule, assignments: state.schedule.assignments.map(a => ({ ...a, locked: true })) }
          : state.schedule;
        const result = await runSolver(input, Date.now());
        // The real lock flags are restored, so nothing silently becomes locked.
        const wasLocked = new Set(state.schedule.assignments.filter(a => a.locked).map(a => `${a.internId}|${a.dayIndex}|${a.type}`));
        const assignments = result.assignments.map(a => ({ ...a, locked: wasLocked.has(`${a.internId}|${a.dayIndex}|${a.type}`) }));

        // The spinner is legible even when the solve is faster than the eye.
        const wait = Math.max(0, 240 - (Date.now() - started));
        await new Promise<void>(r => window.setTimeout(r, wait));
        dispatch({ type: 'RANDOMIZE', assignments });
        // Second step: any intern the user has not named draws one from the pool.
        const fit = poolFit(state.schedule.interns, state.schedule.namePool);
        if (Math.min(fit.available, fit.open) > 0) {
          dispatch({ type: 'DISTRIBUTE_POOL', seed: Date.now() });
        }
        onFilled(assignments);
        toast(result.shortSlots > 0 ? t('toast.randomized.short', { n: result.shortSlots }) : t('toast.randomized'));
      } catch {
        toast(t('toast.randomizeFailed'));
      } finally {
        setBusy(false);
      }
    })();
  };

  const unlocked = unlockedCount(state.schedule);
  const pool = poolFit(state.schedule.interns, state.schedule.namePool);
  const willName = Math.min(pool.available, pool.open);

  const dialogs = (
    <>
      <Dialog
        open={askRandomize}
        title={t('dialog.randomize.title')}
        onClose={() => setAskRandomize(false)}
        actions={
          <>
            <Button onClick={() => setAskRandomize(false)}>{t('dialog.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setAskRandomize(false);
                fill(keepPlaced);
              }}
            >
              {t('dialog.randomize.confirm')}
            </Button>
          </>
        }
      >
        <p>{keepPlaced ? t('dialog.randomize.bodyKeep') : t('dialog.randomize.body', { n: unlocked })}</p>
        <div className="mt-3">
          <Switch checked={keepPlaced} onChange={setKeepPlaced} label={t('dialog.randomize.keepPlaced')} />
        </div>
        {willName > 0 ? (
          <p className="mt-3 text-[13px] text-text-2">{t('dialog.randomize.pool', { n: willName })}</p>
        ) : null}
      </Dialog>

      <Dialog
        open={askReset}
        title={t('dialog.reset.title')}
        onClose={() => setAskReset(false)}
        actions={
          <>
            <Button onClick={() => setAskReset(false)}>{t('dialog.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                dispatch({ type: 'RESET', keepLocked });
                setAskReset(false);
              }}
            >
              {t('dialog.reset.confirm')}
            </Button>
          </>
        }
      >
        <p>{t('dialog.reset.body')}</p>
        <div className="mt-3">
          <Switch checked={keepLocked} onChange={setKeepLocked} label={t('dialog.reset.keepLocked')} />
        </div>
      </Dialog>
    </>
  );

  return {
    busy,
    randomize: () => (state.schedule.assignments.length > 0 ? setAskRandomize(true) : fill(false)),
    reset: () => {
      if (state.schedule.assignments.length > 0) setAskReset(true);
    },
    dialogs,
  };
}
