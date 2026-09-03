import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'quiet' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant | undefined;
  busy?: boolean | undefined;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-[1.06]',
  quiet: 'text-text hover:bg-accent-tint',
  destructive: 'text-error hover:bg-accent-tint',
};

export function Button({ variant = 'quiet', busy = false, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled === true || busy}
      className={`inline-flex h-11 md:h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3.5 text-[15px] font-medium
        transition-[background-color,transform,opacity,filter] duration-[var(--dur-fast)] ease-[var(--ease-apple)]
        active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {busy ? <Loader2 aria-hidden size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
