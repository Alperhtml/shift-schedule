import { RotateCcw, Wand2 } from 'lucide-react';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { Button } from '../ui/Button';
import { ExportMenu } from '../export/ExportMenu';
import { ImportMenu } from '../import/ImportMenu';

export interface ToolbarProps {
  onRandomize: () => void;
  onReset: () => void;
  busy: boolean;
  compact?: boolean | undefined;
}

/** Presentational: the dialogs and the solver call live in BoardScreen so the
    mobile overflow menu can trigger exactly the same actions. */
export function Toolbar({ onRandomize, onReset, busy, compact = false }: ToolbarProps) {
  const { state } = useStore();
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {compact ? null : (
        <>
          <Button onClick={onReset} disabled={state.schedule.assignments.length === 0}>
            <RotateCcw aria-hidden size={15} strokeWidth={1.75} />
            {t('toolbar.resetBoard')}
          </Button>
          <ImportMenu />
          <ExportMenu />
        </>
      )}
      <Button variant="primary" busy={busy} onClick={onRandomize}>
        {busy ? null : <Wand2 aria-hidden size={15} strokeWidth={1.75} />}
        {t('toolbar.randomize')}
      </Button>
    </div>
  );
}
