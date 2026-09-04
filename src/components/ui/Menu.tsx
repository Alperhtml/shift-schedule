import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Popover } from './Popover';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon | undefined;
  destructive?: boolean | undefined;
  separatorBefore?: boolean | undefined;
  disabled?: boolean | undefined;
  /** A second line under the label, for an item that needs a reason. */
  hint?: string | undefined;
  /** Tinted and ringed, for the one item most people are looking for. */
  highlight?: boolean | undefined;
}

export interface MenuProps {
  label: string;
  items: MenuItem[];
  icon?: LucideIcon | undefined;
  iconOnly?: boolean | undefined;
  trigger?: ((props: { ref: React.Ref<HTMLButtonElement>; onClick: () => void; 'aria-expanded': boolean }) => ReactNode) | undefined;
}

export function Menu({ label, items, icon: Icon, iconOnly = false }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={iconOnly ? label : undefined}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] text-[15px] font-medium text-text
          transition-[background-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-apple)] hover:bg-accent-tint active:scale-[.98]
          ${iconOnly ? 'h-11 w-11 md:h-9 md:w-9 text-text-2 hover:text-text' : 'h-11 md:h-9 px-3.5'}`}
      >
        {Icon ? <Icon aria-hidden size={iconOnly ? 18 : 16} strokeWidth={1.75} /> : null}
        {iconOnly ? null : (
          <>
            {label}
            <ChevronDown aria-hidden size={14} strokeWidth={2} className="text-text-2" />
          </>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} ariaLabel={label} width={232}>
        <div role="menu" className="flex flex-col">
          {items.map(item => (
            <div key={item.label} role="none" className="contents">
              {item.separatorBefore ? <div role="none" className="my-1.5 h-px bg-hairline" /> : null}
              <button
                type="button"
                role="menuitem"
                aria-disabled={item.disabled === true}
                onClick={() => {
                  if (item.disabled === true) return;
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-[13px]
                  transition-colors duration-[var(--dur-fast)] aria-disabled:opacity-40 aria-disabled:hover:bg-transparent
                  ${item.hint === undefined ? 'h-10' : 'py-1.5'}
                  ${item.highlight === true
                    ? 'bg-accent-tint ring-1 ring-inset ring-[var(--accent-ring)] hover:brightness-[.97]'
                    : 'hover:bg-accent-tint'}
                  ${item.destructive ? 'text-error' : 'text-text'}`}
              >
                {item.icon ? (
                  <item.icon
                    aria-hidden
                    size={16}
                    strokeWidth={1.75}
                    className={item.destructive ? '' : item.highlight === true ? 'text-accent-text' : 'text-text-2'}
                  />
                ) : null}
                <span className="flex min-w-0 flex-col">
                  <span className={item.highlight === true ? 'font-medium text-accent-text' : ''}>{item.label}</span>
                  {item.hint === undefined ? null : (
                    <span className={`text-[11px] leading-[1.4] ${item.highlight === true ? 'text-accent-text' : 'text-text-2'}`}>
                      {item.hint}
                    </span>
                  )}
                </span>
              </button>
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
