import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { Severity } from '../../engine/rules';
import { useT } from '../../i18n';

/** 14 px corner badge. Colour is always paired with a glyph. Info never badges. */
export function ViolationBadge({ severity }: { severity: Severity }) {
  const t = useT();
  if (severity === 'info') return null;
  const Icon = severity === 'error' ? AlertCircle : AlertTriangle;
  return (
    <span
      aria-label={t('a11y.violation')}
      role="img"
      style={{ background: severity === 'error' ? 'var(--error)' : 'var(--warn)' }}
      className="absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-white ring-2 ring-[var(--surface)]"
    >
      <Icon aria-hidden size={9} strokeWidth={3} />
    </span>
  );
}
