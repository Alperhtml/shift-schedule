import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type FocusEvent as ReactFocusEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipHandlers {
  onPointerEnter: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: () => void;
  onClick: (e?: ReactMouseEvent) => void;
  onFocus: (e: ReactFocusEvent) => void;
  onBlur: (e: ReactFocusEvent) => void;
}

export interface TooltipBinding {
  handlers: TooltipHandlers;
  overlay: ReactNode;
}

/** Only one tooltip is ever visible; showing one closes whichever was open. */
const openTooltips = new Set<() => void>();

/** Whether the last thing the user did was press a key. A tooltip should follow a
    keyboard focus, but not the focus a closing dialog hands back to the control
    that opened it, which would otherwise sit on the page until the next click. */
let keyboardModality = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', () => { keyboardModality = true; }, true);
  window.addEventListener('pointerdown', () => { keyboardModality = false; }, true);
  window.addEventListener('mousedown', () => { keyboardModality = false; }, true);
  window.addEventListener('touchstart', () => { keyboardModality = false; }, true);
}

export interface TooltipOptions {
  /** A tap opens and closes it. For an explanation the reader goes looking for,
      where a long press is not something anybody would think to try. */
  tapToggle?: boolean | undefined;
}

/** Hover after 300 ms, focus at once, long press after 450 ms on touch.
    A hook rather than a wrapper, so it composes with drag listeners and keeps
    the consumer's own ref. */
export function useTooltip(content: ReactNode, options: TooltipOptions = {}): TooltipBinding {
  const tapToggle = options.tapToggle === true;
  const timer = useRef<number | undefined>(undefined);
  const holder = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const enabled = content !== null && content !== '' && content !== undefined && content !== false;

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setPos(null);
  }, []);

  const show = useCallback(
    (delay: number, el: HTMLElement) => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        for (const other of openTooltips) other();
        openTooltips.clear();
        openTooltips.add(hide);
        holder.current = el;
        const rect = el.getBoundingClientRect();
        setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
      }, delay);
    },
    [hide],
  );

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      openTooltips.delete(hide);
    },
    [hide],
  );

  useEffect(() => {
    if (!tapToggle || !pos) return undefined;
    const away = (e: Event): void => {
      if (!(e.target instanceof Node) || !holder.current?.contains(e.target)) hide();
    };
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') hide(); };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key);
    };
  }, [tapToggle, pos, hide]);

  const handlers: TooltipHandlers = {
    onPointerEnter: e => {
      if (enabled && e.pointerType !== 'touch') show(300, e.currentTarget as HTMLElement);
    },
    onPointerLeave: () => { if (!tapToggle) hide(); },
    onPointerDown: e => {
      if (tapToggle) return;
      if (enabled && e.pointerType === 'touch') show(450, e.currentTarget as HTMLElement);
      else hide();
    },
    onPointerUp: () => { if (!tapToggle) hide(); },
    onClick: e => {
      if (!tapToggle) {
        hide();
        return;
      }
      if (pos) hide();
      else if (enabled && e) show(0, e.currentTarget as HTMLElement);
    },
    onFocus: e => {
      if (enabled && keyboardModality) show(0, e.currentTarget as HTMLElement);
    },
    onBlur: () => hide(),
  };

  const overlay = pos && enabled
    ? createPortal(
        <div
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
          className="glass anim-fade pointer-events-none fixed z-[70] max-w-[280px] -translate-x-1/2 rounded-[var(--radius-control)] border border-hairline px-2.5 py-1.5 text-[13px] leading-[1.45] text-text shadow-[var(--shadow-float)]"
        >
          {content}
        </div>,
        document.body,
      )
    : null;

  return { handlers, overlay };
}
