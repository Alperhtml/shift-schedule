import { useEffect, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Check, Pencil } from 'lucide-react';
import type { Intern } from '../../engine/types';
import { NAME_MAX, QUOTA } from '../../engine/types';
import { counts } from '../../engine/schedule';
import { useStore } from '../../state/store';
import { internLabel, useLang, useT } from '../../i18n';
import { dotStyle } from '../board/chipStyle';

export function PaletteRow({ intern }: { intern: Intern }) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const c = counts(state.schedule, intern.id);
  const complete = c.day === QUOTA && c.night === QUOTA;
  const over = c.day > QUOTA || c.night > QUOTA;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${intern.id}`,
    data: { source: 'palette', internId: intern.id },
    disabled: editing,
  });

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  if (editing) {
    return (
      <div className="flex h-11 items-center gap-2 px-2">
        <span aria-hidden style={dotStyle(intern.colorKey)} className="h-2 w-2 shrink-0 rounded-full" />
        <input
          ref={input}
          type="text"
          value={intern.realName}
          maxLength={NAME_MAX}
          aria-label={`${t('setup.interns.name')}, ${internLabel(intern, lang)}`}
          placeholder={t('intern.placeholder', { n: intern.index })}
          onChange={e => dispatch({ type: 'SET_INTERN_NAME', id: intern.id, name: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
          onBlur={e => {
            const trimmed = e.target.value.trim();
            if (trimmed !== e.target.value) dispatch({ type: 'SET_INTERN_NAME', id: intern.id, name: trimmed });
            setEditing(false);
          }}
          className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 text-[13px] text-text placeholder:text-text-3"
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={`${internLabel(intern, lang)}, ${t('chip.counts', { day: c.day, night: c.night })}`}
      className={`group flex h-11 cursor-grab items-center gap-2 rounded-[var(--radius-control)] px-2
        transition-[background-color,opacity] duration-[var(--dur-fast)] hover:bg-accent-tint active:cursor-grabbing
        ${isDragging ? 'opacity-40' : ''}`}
    >
      <span aria-hidden style={dotStyle(intern.colorKey)} className="h-2 w-2 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{internLabel(intern, lang)}</span>
      <button
        type="button"
        aria-label={`${t('chip.rename')}, ${internLabel(intern, lang)}`}
        // The drag sensors listen for mousedown, touchstart and keydown, not
        // pointerdown, so those are the events the pencil has to keep to itself.
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-text-3
          after:absolute after:-inset-2 after:content-[''] md:after:content-none
          opacity-60 transition-[opacity,background-color,color] duration-[var(--dur-fast)]
          hover:bg-accent-tint hover:text-text hover:opacity-100 focus-visible:opacity-100"
      >
        <Pencil aria-hidden size={13} strokeWidth={1.75} />
      </button>
      <span className={`tabular shrink-0 text-[11px] ${over ? 'text-error' : complete ? 'text-ok' : 'text-text-2'}`}>
        {t('chip.counts', { day: c.day, night: c.night })}
      </span>
      {complete ? <Check aria-label={t('chip.complete')} size={13} strokeWidth={2.5} className="shrink-0 text-ok" /> : null}
    </div>
  );
}
