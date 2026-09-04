export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string | undefined;
}

/** Two to four exclusive options. A radiogroup, not a tab row. */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel, className = '' }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex w-fit items-center gap-0.5 rounded-[var(--radius-control)] bg-surface-2 p-0.5 ${className}`}
    >
      {options.map((o, index) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={e => {
              const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (step === 0) return;
              e.preventDefault();
              const next = options[(index + step + options.length) % options.length];
              if (!next) return;
              onChange(next.value);
              const siblings = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
              siblings?.[(index + step + options.length) % options.length]?.focus();
            }}
            className={`h-11 md:h-7 rounded-[calc(var(--radius-control)-1px)] px-2.5 md:px-3 text-[13px] font-medium whitespace-nowrap
              transition-[background-color,color] duration-[var(--dur-fast)] ease-[var(--ease-apple)]
              ${selected ? 'bg-accent text-white' : 'text-text-2 hover:text-text'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
