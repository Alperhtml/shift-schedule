import { useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Moon, Plus, Sun } from 'lucide-react';
import type { ShiftType } from '../../engine/types';
import { bySlot, slotKey } from '../../engine/schedule';
import { useStore } from '../../state/store';
import { useViolations } from '../../state/useViolations';
import { useLang, useT, violationMessage } from '../../i18n';
import { formatDay } from '../../engine/dates';
import { useTooltip } from '../ui/Tooltip';
import { InternChip } from './InternChip';
import { AssignPopover } from './AssignPopover';
import { useDragState } from './DndProvider';
import { useAnimate } from './animate';
import { cellId } from './chipStyle';

export interface SlotZoneProps {
  dayIndex: number;
  type: ShiftType;
  minHeight?: number | undefined;
  compactChips?: boolean | undefined;
}

export function SlotZone({ dayIndex, type, minHeight = 52, compactChips = false }: SlotZoneProps) {
  const { state } = useStore();
  const { lang } = useLang();
  const t = useT();
  const violations = useViolations();
  const drag = useDragState();
  const animate = useAnimate();
  const [open, setOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  const key = slotKey(dayIndex, type);
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const list = bySlot(state.schedule).get(key) ?? [];
  const own = violations.cellViolations(key);
  const severity = violations.severityOfCell(key);
  const empty = list.length === 0;

  const dateLabel = formatDay(state.schedule.startDate, dayIndex, lang, 'd MMM EEE');
  const shiftWord = t(type === 'NIGHT' ? 'shift.night' : 'shift.day').toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');

  const dragging = drag.over === key && drag.activeInternId !== null;
  const ring = dragging
    ? drag.severity === 'error'
      ? 'shadow-[inset_0_0_0_2px_var(--error)]'
      : 'shadow-[inset_0_0_0_2px_var(--accent)]'
    : severity === 'error'
      ? 'shadow-[inset_0_0_0_1.5px_var(--error)]'
      : severity === 'warning' && !empty
        ? 'shadow-[inset_0_0_0_1.5px_var(--warn-stroke)]'
        : empty
          // An empty slot reads as a place to drop, not as an alarm; the amber is
          // kept for a slot that has people in it but still misses the target.
          ? 'outline outline-1 outline-dashed outline-[var(--hairline)] -outline-offset-1'
          : '';

  const tooltipText = own.length > 0
    ? own.slice(0, 4).map(v => violationMessage(v, state.schedule, lang)).join('\n') + (own.length > 4 ? `\n+${own.length - 4}` : '')
    : '';
  const tip = useTooltip(tooltipText === '' ? null : <span className="whitespace-pre-line">{tooltipText}</span>);

  return (
    <div
      ref={setNodeRef}
      {...tip.handlers}
      id={cellId(dayIndex, type)}
      role="group"
      aria-label={`${t('a11y.slot', { date: dateLabel, shift: shiftWord })}${empty ? `, ${t('slot.empty')}` : ''}`}
      style={{ minHeight }}
      className={`relative flex flex-wrap content-start items-start gap-2 rounded-lg p-1.5 pt-5
        ${type === 'NIGHT' ? 'bg-surface-2' : 'bg-surface border-t border-hairline'}
        ${ring} ${drag.shaking === key ? 'anim-shake' : ''} ${isOver && !dragging ? 'brightness-[.98]' : ''}
        transition-[box-shadow,filter] duration-[var(--dur-fast)] ease-[var(--ease-apple)]`}
    >
      <span className="pointer-events-none absolute left-1.5 top-1 flex items-center gap-1 text-[11px] font-medium tracking-[.04em] text-text-2">
        {type === 'NIGHT' ? <Moon aria-hidden size={11} strokeWidth={2} /> : <Sun aria-hidden size={11} strokeWidth={2} />}
        {t(type === 'NIGHT' ? 'shift.night.hours' : 'shift.day.hours')}
      </span>

      {list.map(a => {
        const intern = state.schedule.interns.find(i => i.id === a.internId);
        if (!intern) return null;
        return (
          <InternChip
            key={`${a.internId}|${animate.token}`}
            assignment={a}
            intern={intern}
            compact={compactChips}
            animateIndex={animate.batch?.has(a) === true && !a.locked ? dayIndex * 2 + (type === 'NIGHT' ? 1 : 0) : undefined}
          />
        );
      })}

      <button
        ref={addRef}
        type="button"
        aria-label={`${t('a11y.slot', { date: dateLabel, shift: shiftWord })}, ${t('popover.assign.title')}`}
        aria-haspopup="listbox"
        onClick={() => setOpen(true)}
        className={`flex min-w-6 flex-1 items-center justify-end self-stretch rounded-[var(--radius-control)] pr-0.5 text-text-3
          transition-opacity duration-[var(--dur-fast)] hover:opacity-100 focus-visible:opacity-100
          ${empty ? 'min-h-8 opacity-0' : 'min-h-6 opacity-0'}`}
      >
        <Plus aria-hidden size={14} strokeWidth={2} />
      </button>

      <AssignPopover open={open} onClose={() => setOpen(false)} anchorRef={addRef} dayIndex={dayIndex} type={type} />
      {tip.overlay}
    </div>
  );
}
