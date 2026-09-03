import { useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './overlay';

export interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}

export function Dialog({ open, title, children, actions, onClose }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="anim-fade absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="glass anim-enter-scale relative w-full max-w-[400px] rounded-[var(--radius-sheet)] border border-hairline p-5 shadow-[var(--shadow-float)] outline-none"
      >
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        <div className="mt-2 text-[13px] leading-[1.45] text-text-2">{children}</div>
        <div className="mt-5 flex items-center justify-end gap-2">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
