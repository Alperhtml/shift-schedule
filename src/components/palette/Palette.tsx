import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ListPlus } from 'lucide-react';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { modeOf } from '../../state/reducer';
import { PALETTE_ID, useDragState } from '../board/DndProvider';
import { PaletteRow } from './PaletteRow';
import { NamePoolSheet } from './NamePoolSheet';

export function Palette({ showTitle = true }: { showTitle?: boolean | undefined }) {
  const { state } = useStore();
  const t = useT();
  const { setNodeRef } = useDroppable({ id: PALETTE_ID });
  const drag = useDragState();
  const [poolOpen, setPoolOpen] = useState(false);
  const armed = drag.over === PALETTE_ID && drag.activeInternId !== null;
  const solo = modeOf(state.schedule) === 'solo';

  return (
    <section
      ref={setNodeRef}
      aria-label={t('setup.interns.title')}
      className={`rounded-[var(--radius-card)] border border-hairline bg-surface p-3 transition-colors duration-[var(--dur-fast)]
        ${armed ? 'bg-accent-tint' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2 pl-2 pr-1">
        {showTitle ? (
          <h2 className="text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{t('setup.interns.title')}</h2>
        ) : <span />}
        {solo ? null : (
        <button
          type="button"
          aria-label={t('pool.open')}
          onClick={() => setPoolOpen(true)}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-control)] px-2 text-[11px] font-medium text-text-2
            transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint hover:text-text"
        >
          <ListPlus aria-hidden size={13} strokeWidth={1.75} />
          {t('pool.title')}
        </button>
        )}
      </div>
      <div className="flex flex-col">
        {state.schedule.interns.map(i => <PaletteRow key={i.id} intern={i} />)}
      </div>
      <p className="mt-2 hidden px-2 text-[11px] leading-[1.5] text-text-3 md:block">{t('a11y.dragHint')}</p>
      <p className="mt-2 px-2 text-[11px] leading-[1.5] text-text-3 md:hidden">{t('a11y.tapHint')}</p>
      <NamePoolSheet open={poolOpen} onClose={() => setPoolOpen(false)} />
    </section>
  );
}
