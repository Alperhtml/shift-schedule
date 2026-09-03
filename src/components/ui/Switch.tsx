export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** A setting that takes effect immediately, so a switch rather than a checkbox. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-[13px] text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-[var(--dur-fast)] ease-[var(--ease-apple)]
          ${checked ? 'bg-accent' : 'bg-surface-2 border border-hairline'}`}
      >
        <span
          className={`absolute top-1/2 block h-[27px] w-[27px] -translate-y-1/2 rounded-full bg-white shadow-[var(--shadow-knob)]
            transition-[left] duration-[var(--dur-fast)] ease-[var(--ease-apple)] ${checked ? 'left-[22px]' : 'left-[2px]'}`}
        />
      </button>
    </label>
  );
}
