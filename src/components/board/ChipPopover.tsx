import type { RefObject } from 'react';
import { Lock, Trash2, Unlock } from 'lucide-react';
import type { Assignment, Intern } from '../../engine/types';
import { useStore } from '../../state/store';
import { internLabel, useLang, useT } from '../../i18n';
import { Popover } from '../ui/Popover';

export interface ChipPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  assignment: Assignment;
  intern: Intern;
}

export function ChipPopover({ open, onClose, anchorRef, assignment, intern }: ChipPopoverProps) {
  const { dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const row = 'flex h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-[13px] transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint';

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} ariaLabel={internLabel(intern, lang)} width={200}>
      <div className="flex flex-col">
        <p className="truncate px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[.04em] text-text-2">
          {internLabel(intern, lang)}
        </p>
        <button
          type="button"
          className={`${row} text-text`}
          onClick={() => {
            dispatch({ type: 'TOGGLE_LOCK', internId: intern.id, dayIndex: assignment.dayIndex, shift: assignment.type });
            onClose();
          }}
        >
          {assignment.locked
            ? <Unlock aria-hidden size={16} strokeWidth={1.75} className="text-text-2" />
            : <Lock aria-hidden size={16} strokeWidth={1.75} className="text-text-2" />}
          {t(assignment.locked ? 'chip.unlock' : 'chip.lock')}
        </button>
        <button
          type="button"
          className={`${row} text-error`}
          onClick={() => {
            dispatch({ type: 'UNASSIGN', internId: intern.id, dayIndex: assignment.dayIndex, shift: assignment.type });
            onClose();
          }}
        >
          <Trash2 aria-hidden size={16} strokeWidth={1.75} />
          {t('chip.remove')}
        </button>
      </div>
    </Popover>
  );
}
