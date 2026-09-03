import { useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Lock } from 'lucide-react';
import type { Assignment, Intern } from '../../engine/types';
import { slotKey } from '../../engine/schedule';
import { useViolations } from '../../state/useViolations';
import { useStore } from '../../state/store';
import { internLabel, shortLabel, useLang, useT, violationMessage } from '../../i18n';
import { formatDay } from '../../engine/dates';
import { useTooltip } from '../ui/Tooltip';
import { ViolationBadge } from './ViolationBadge';
import { ChipPopover } from './ChipPopover';
import { chipStyle } from './chipStyle';

export interface InternChipProps {
  assignment: Assignment;
  intern: Intern;
  compact?: boolean | undefined;
  animateIndex?: number | undefined;
}

export function InternChip({ assignment, intern, compact = false, animateIndex }: InternChipProps) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const violations = useViolations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const key = slotKey(assignment.dayIndex, assignment.type);
  const own = violations.chipViolations(intern.id, key);
  const severity = violations.severityOfChip(intern.id, key);
  const label = compact ? shortLabel(intern, lang) : internLabel(intern, lang);
  const dateLabel = formatDay(state.schedule.startDate, assignment.dayIndex, lang, 'd MMM EEE');
  const shiftWord = t(assignment.type === 'NIGHT' ? 'shift.night' : 'shift.day').toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${intern.id}-${key}`,
    data: { source: 'slot', internId: intern.id, dayIndex: assignment.dayIndex, type: assignment.type },
  });
  // SPEC section 11 gives a chip's keyboard to the popover and to Delete, so the
  // keyboard sensor's own handler is left off here. Keyboard dragging starts from
  // a palette row instead; a chip is moved by removing it and adding it again.
  const { onKeyDown: keyboardDragStart, ...dragListeners } = listeners ?? {};
  void keyboardDragStart;
  // dnd-kit's attributes carry an English screen-reader instruction and a
  // roledescription; the chip describes its own violations instead.
  const { 'aria-describedby': dndDescribedBy, 'aria-roledescription': dndRole, ...dragAttributes } = attributes;
  void dndDescribedBy;
  void dndRole;
  const describedById = own.length > 0 ? `viol-${intern.id}-${key}` : undefined;

  const tooltipText = own.length > 0
    ? own.slice(0, 4).map(v => violationMessage(v, state.schedule, lang)).join('\n') + (own.length > 4 ? `\n+${own.length - 4}` : '')
    : internLabel(intern, lang);
  const tip = useTooltip(<span className="whitespace-pre-line">{tooltipText}</span>);

  return (
    <>
      <button
          ref={node => {
            setNodeRef(node);
            ref.current = node;
          }}
          type="button"
          aria-label={t('a11y.chip', { intern: internLabel(intern, lang), date: dateLabel, shift: shiftWord })}
          aria-haspopup="dialog"
          style={{ ...chipStyle(intern.colorKey), animationDelay: animateIndex === undefined ? undefined : `${animateIndex * 12}ms` }}
          className={`${animateIndex === undefined ? '' : 'anim-chip'} relative inline-flex ${compact ? 'h-11' : "h-6 after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']"} max-w-[min(124px,100%)] shrink-0 items-center gap-1
            rounded-[var(--radius-control)] px-2 text-[13px] font-medium
            transition-[transform,filter,opacity] duration-[var(--dur-fast)] ease-[var(--ease-apple)]
            hover:-translate-y-px active:translate-y-0 ${isDragging ? 'opacity-35' : ''}`}
          onClick={e => {
            e.stopPropagation();
            setOpen(true);
          }}
          {...dragListeners}
          {...dragAttributes}
          aria-describedby={describedById}
          onPointerEnter={tip.handlers.onPointerEnter}
          onPointerLeave={tip.handlers.onPointerLeave}
          onPointerUp={() => tip.handlers.onPointerUp()}
          onFocus={tip.handlers.onFocus}
          onBlur={tip.handlers.onBlur}
          onPointerDown={e => {
            tip.handlers.onPointerDown(e);
            dragListeners['onPointerDown']?.(e);
          }}
          onKeyDown={e => {
            if (e.key !== 'Delete' && e.key !== 'Backspace') return;
            e.preventDefault();
            dispatch({ type: 'UNASSIGN', internId: intern.id, dayIndex: assignment.dayIndex, shift: assignment.type });
          }}
        >
          <span className="truncate">{label}</span>
          {assignment.locked ? <Lock aria-label={t('chip.locked')} size={11} strokeWidth={2.25} className="shrink-0" /> : null}
          {severity && severity !== 'info' ? <ViolationBadge severity={severity} /> : null}
      </button>
      {describedById ? <span id={describedById} hidden>{tooltipText}</span> : null}
      {tip.overlay}
      <ChipPopover open={open} onClose={() => setOpen(false)} anchorRef={ref} assignment={assignment} intern={intern} />
    </>
  );
}
