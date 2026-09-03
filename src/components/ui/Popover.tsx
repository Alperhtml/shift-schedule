import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { placeBelow, useFocusTrap } from './overlay';

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  ariaLabel: string;
  children: ReactNode;
  width?: number | undefined;
}

export function Popover({ open, onClose, anchorRef, ariaLabel, children, width = 264 }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useFocusTrap(ref, open, onClose);

  const reposition = useCallback(() => {
    const node = ref.current;
    const anchor = anchorRef.current;
    if (!node || !anchor) return;
    setPos(placeBelow(anchor.getBoundingClientRect(), { width, height: node.offsetHeight }));
  }, [anchorRef, width]);

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && anchorRef.current?.contains(target) !== true) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchorRef, onClose, reposition]);

  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={ariaLabel}
      tabIndex={-1}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className="glass anim-enter-up fixed z-50 rounded-[var(--radius-card)] border border-hairline p-1.5 shadow-[var(--shadow-float)] outline-none"
    >
      {children}
    </div>,
    document.body,
  );
}
