import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from './overlay';
import { IconButton } from './IconButton';
import { useT } from '../../i18n';

export interface SheetProps {
  open: boolean;
  side: 'right' | 'bottom';
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, side, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  const shape = side === 'right'
    ? 'anim-enter-right right-0 top-0 h-full w-full max-w-[420px] rounded-l-[var(--radius-sheet)]'
    : 'anim-enter-bottom bottom-0 left-0 w-full max-h-[85vh] rounded-t-[var(--radius-sheet)]';
  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <div className="anim-fade absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`glass absolute flex flex-col border border-hairline shadow-[var(--shadow-float)] outline-none ${shape}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
          <h2 className="text-[15px] font-semibold text-text">{title}</h2>
          <IconButton label={t('dialog.close')} icon={X} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
