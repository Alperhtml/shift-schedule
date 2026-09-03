import { useRef, useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { useT } from '../../i18n';
import { Popover } from './Popover';

export const GITHUB_URL = 'https://github.com/Alperhtml';

/** Quiet authorship line beside the application name. The handle is the link; the
    glyph explains what the tool is and where feedback goes. */
export function Credit() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-[var(--radius-control)] px-1.5 py-0.5 text-[11px] tracking-[.04em] text-text-3
          transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint hover:text-accent-text"
      >
        {t('credit.handle')}
      </a>
      <button
        ref={ref}
        type="button"
        aria-label={t('credit.about')}
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-3
          transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint hover:text-text-2"
      >
        <Info aria-hidden size={13} strokeWidth={1.75} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} ariaLabel={t('credit.about')} width={300}>
        <p className="px-2.5 pb-1 pt-2 text-[13px] leading-[1.45] text-text">{t('credit.body')}</p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="mt-1 flex items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-2 text-[13px] text-accent-text
            transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint"
        >
          <ExternalLink aria-hidden size={14} strokeWidth={1.75} />
          {t('credit.link')}
        </a>
      </Popover>
    </span>
  );
}
