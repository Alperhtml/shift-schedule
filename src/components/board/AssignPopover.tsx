import type { RefObject } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ShiftType } from '../../engine/types';
import { counts, hasAssignment } from '../../engine/schedule';
import { wouldViolate } from '../../engine/rules';
import { useStore } from '../../state/store';
import { internLabel, useLang, useT } from '../../i18n';
import { Popover } from '../ui/Popover';
import { dotStyle } from './chipStyle';

export interface AssignPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  dayIndex: number;
  type: ShiftType;
}

export function AssignPopover({ open, onClose, anchorRef, dayIndex, type }: AssignPopoverProps) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();

  return (
    <Popover open={open} onClose={onClose} anchorRef={anchorRef} ariaLabel={t('popover.assign.title')} width={272}>
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{t('popover.assign.title')}</p>
      <ul role="listbox" aria-label={t('popover.assign.title')} className="flex flex-col">
        {state.schedule.interns.map(intern => {
          const already = hasAssignment(state.schedule, intern.id, dayIndex, type);
          const found = already ? [] : wouldViolate(state.schedule, { internId: intern.id, dayIndex, type });
          // Only error-severity codes can come back: wouldViolate drops UNDER_STAFFED.
          const worst = found.some(v => v.severity === 'error') ? 'error' : null;
          const c = counts(state.schedule, intern.id);
          const note = already ? t('popover.assign.already') : worst ? t('popover.assign.conflict') : '';
          return (
            <li key={intern.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={already}
                aria-disabled={already}
                onClick={() => {
                  if (already) return;
                  dispatch({ type: 'ASSIGN', internId: intern.id, dayIndex, shift: type });
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2 text-left
                  transition-colors duration-[var(--dur-fast)] ${already ? 'opacity-45' : 'hover:bg-accent-tint'}`}
              >
                <span aria-hidden style={dotStyle(intern.colorKey)} className="h-2 w-2 shrink-0 rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-text">{internLabel(intern, lang)}</span>
                  {note ? (
                    <span className={`block text-[11px] ${worst === 'error' ? 'text-error' : 'text-text-2'}`}>{note}</span>
                  ) : null}
                </span>
                {worst === 'error' ? <AlertCircle aria-hidden size={14} className="shrink-0 text-error" /> : null}
                <span className="tabular shrink-0 text-[11px] text-text-2">{t('chip.counts', { day: c.day, night: c.night })}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Popover>
  );
}
