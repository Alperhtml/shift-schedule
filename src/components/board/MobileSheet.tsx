import { ChevronDown } from 'lucide-react';
import { useT } from '../../i18n';
import { Segmented } from '../ui/Segmented';
import { Palette } from '../palette/Palette';
import { Diagnostics } from '../diagnostics/Diagnostics';

export type MobileTab = 'interns' | 'checks';

export interface MobileSheetProps {
  tab: MobileTab | null;
  onTab: (tab: MobileTab | null) => void;
}

/** A bottom panel, not a modal: dragging from it onto the board must keep working. */
export function MobileSheet({ tab, onTab }: MobileSheetProps) {
  const t = useT();
  if (tab === null) return null;
  return (
    <div className="glass anim-enter-bottom fixed inset-x-0 bottom-[calc(60px+max(6px,env(safe-area-inset-bottom)))] z-30 max-h-[52vh] overflow-y-auto overscroll-contain rounded-t-[var(--radius-sheet)] border-t border-hairline p-3 shadow-[var(--shadow-float)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Segmented<MobileTab>
          value={tab}
          options={[{ value: 'interns', label: t('setup.interns.title') }, { value: 'checks', label: t('diag.title') }]}
          onChange={onTab}
          ariaLabel={t('setup.interns.title')}
        />
        <button
          type="button"
          aria-label={t('dialog.close')}
          onClick={() => onTab(null)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-text-2 hover:bg-accent-tint"
        >
          <ChevronDown aria-hidden size={18} strokeWidth={1.75} />
        </button>
      </div>
      {tab === 'interns' ? <Palette showTitle={false} /> : <Diagnostics showTitle={false} />}
    </div>
  );
}
