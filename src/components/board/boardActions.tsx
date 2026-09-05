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
import { InfoDot } from '../ui/InfoDot';
import { useToast } from '../ui/Toast';

/** One row, one job, done on click. Nothing is preselected, so nobody presses
    Enter and gets an action they did not pick. */
function ActionRow({ label, info, note, onSelect }: {
  label: string;
  info: string;
  note?: string | undefined;
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start rounded-[var(--radius-control)] px-2.5 py-2 text-left
          transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint"
      >
        <span className="text-[15px] font-medium text-text">{label}</span>
        {note === undefined ? null : <span className="text-[12px] text-text-2">{note}</span>}
      </button>
      <InfoDot label={label} text={info} />
    </div>
  );
}

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
  // Set from the board every time the dialog opens, not remembered: whoever does
  // not read the switch must not lose what they put there.
  const [keepPlaced, setKeepPlaced] = useState(true);

  const fill = (keep: boolean, withNames: boolean): void => {
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
        // Names are a separate job now. Doing both used to be the only choice, and
        // anyone who wanted fresh shifts had their drawn names reshuffled with them.
        if (withNames) {
          const fit = poolFit(state.schedule.interns, state.schedule.namePool);
          if (Math.min(fit.available, fit.open) > 0) {
            dispatch({ type: 'DISTRIBUTE_POOL', seed: Date.now() });
          }
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
  const hasShifts = state.schedule.assignments.length > 0;
  // Ask whenever something could change without being asked for: shifts on the
  // board, or names waiting in the pool.
  const needsAsk = hasShifts || willName > 0;

  const namesOnly = (): void => {
    dispatch({ type: 'DISTRIBUTE_POOL', seed: Date.now() });
    setAskRandomize(false);
    toast(t('toast.poolDistributed'));
  };


  const dialogs = (
    <>
      <Dialog
        open={askRandomize}
        title={t('dialog.randomize.title')}
        onClose={() => setAskRandomize(false)}
        actions={<Button onClick={() => setAskRandomize(false)}>{t('dialog.cancel')}</Button>}
      >
        {hasShifts ? (
          <div className="mb-2 rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-2">
            <div className="flex items-center justify-between gap-1">
              <Switch checked={keepPlaced} onChange={setKeepPlaced} label={t('dialog.randomize.keepPlaced')} />
              <InfoDot label={t('dialog.randomize.keepPlaced')} text={t('dialog.randomize.keepPlaced.info')} />
            </div>
            <p className="mt-1 text-[12px] leading-[1.45] text-text-2">
              {keepPlaced ? t('dialog.randomize.bodyKeep') : t('dialog.randomize.body', { n: unlocked })}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col">
          {willName > 0 ? (
            <ActionRow
              label={t('dialog.randomize.both')}
              info={t('dialog.randomize.both.info')}
              note={t('dialog.randomize.pool', { n: willName })}
              onSelect={() => {
                setAskRandomize(false);
                fill(keepPlaced, true);
              }}
            />
          ) : null}
          <ActionRow
            label={t('dialog.randomize.shifts')}
            info={t('dialog.randomize.shifts.info')}
            onSelect={() => {
              setAskRandomize(false);
              fill(keepPlaced, false);
            }}
          />
          {willName > 0 ? (
            <ActionRow
              label={t('dialog.randomize.names')}
              info={t('dialog.randomize.names.info')}
              note={t('dialog.randomize.pool', { n: willName })}
              onSelect={namesOnly}
            />
          ) : null}
        </div>
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
    randomize: () => {
      if (!needsAsk) {
        fill(false, true);
        return;
      }
      setKeepPlaced(hasShifts);
      setAskRandomize(true);
    },
    reset: () => {
      if (state.schedule.assignments.length > 0) setAskReset(true);
    },
    dialogs,
  };
}
