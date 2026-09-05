import { Info } from 'lucide-react';
import { useTooltip } from './Tooltip';

/** A small "i" beside a control. Hover on a desktop, tap on a phone, and the
    keyboard reaches it like any other button. The text is one sentence: if it
    needs two, the label above it is wrong. */
export function InfoDot({ label, text }: { label: string; text: string }) {
  const tip = useTooltip(text, { tapToggle: true });
  return (
    <>
      <button
        type="button"
        aria-label={label}
        {...tip.handlers}
        onClick={e => {
          // The row underneath is an action; the "i" must not trigger it.
          e.stopPropagation();
          tip.handlers.onClick(e);
        }}
        className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-3
          transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint hover:text-text
          after:absolute after:-inset-1.5 after:content-['']"
      >
        <Info aria-hidden size={15} strokeWidth={1.75} />
      </button>
      {tip.overlay}
    </>
  );
}
