import { Minus, Plus } from 'lucide-react';
import { useT } from '../../i18n';

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  format?: ((n: number) => string) | undefined;
}

export function Stepper({ value, min, max, onChange, label, format }: StepperProps) {
  const t = useT();
  const button = 'inline-flex h-11 w-11 items-center justify-center rounded-full text-text-2 transition-[background-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-apple)] hover:bg-accent-tint hover:text-text active:scale-[.94] disabled:opacity-40 disabled:pointer-events-none';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] text-text">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={t('stepper.decrease')} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
          <Minus aria-hidden size={18} strokeWidth={2} />
        </button>
        <span aria-live="polite" className="tabular min-w-[68px] text-center text-[15px] font-medium text-text">
          {format ? format(value) : value}
        </span>
        <button type="button" aria-label={t('stepper.increase')} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
          <Plus aria-hidden size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
