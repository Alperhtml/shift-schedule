import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useTooltip } from './Tooltip';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: LucideIcon;
  active?: boolean | undefined;
  size?: number | undefined;
}

/** Never icon-only without a name: the tooltip and the aria-label always carry it. */
export function IconButton({ label, icon: Icon, active = false, size = 18, className = '', ...rest }: IconButtonProps) {
  const tip = useTooltip(label);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        {...tip.handlers}
        className={`inline-flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-[var(--radius-control)]
          transition-[background-color,transform,opacity] duration-[var(--dur-fast)] ease-[var(--ease-apple)]
          active:scale-[.96] disabled:opacity-40 disabled:pointer-events-none
          ${active ? 'bg-accent-tint text-accent-text' : 'text-text-2 hover:bg-accent-tint hover:text-text'} ${className}`}
        {...rest}
      >
        <Icon aria-hidden size={size} strokeWidth={1.75} />
      </button>
      {tip.overlay}
    </>
  );
}
