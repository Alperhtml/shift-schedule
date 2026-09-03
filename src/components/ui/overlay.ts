import { useEffect, useRef, type RefObject } from 'react';

// `[tabindex="-1"]` is excluded everywhere: a roving-tabindex radio group keeps its
// unselected buttons out of the tab order, and they must not become trap boundaries.
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]',
].map(sel => `${sel}:not([tabindex="-1"])`).join(',');

/** Open overlays, innermost last. Escape only closes the top one. */
const stack: symbol[] = [];

/** Esc closes, Tab cycles inside, focus lands on the first control and is
    restored on close. `onClose` is read through a ref so a parent re-render
    does not tear the trap down and steal focus back. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const token = Symbol('overlay');
    stack.push(token);
    const node = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (stack[stack.length - 1] !== token) return;
        e.stopPropagation();
        latest.current();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (!firstItem || !lastItem) return;
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      // The trigger may have been removed by the overlay's own action.
      if (previous?.isConnected === true) previous.focus({ preventScroll: true });
    };
  }, [ref, open]);
}

export interface Position {
  top: number;
  left: number;
}

/** Below the anchor, flipped above and nudged inside when it would overflow. */
export function placeBelow(anchor: DOMRect, size: { width: number; height: number }, gap = 8): Position {
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = anchor.bottom + gap;
  if (top + size.height > vh - margin) {
    const above = anchor.top - gap - size.height;
    top = above >= margin ? above : Math.max(margin, vh - margin - size.height);
  }
  let left = anchor.left;
  if (left + size.width > vw - margin) left = vw - margin - size.width;
  if (left < margin) left = margin;
  return { top, left };
}
