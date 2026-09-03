import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import type { Violation, ViolationCode } from '../../engine/rules';
import { useStore } from '../../state/store';
import { useViolations } from '../../state/useViolations';
import { useLang, useT, violationMessage } from '../../i18n';
import { cellId } from '../board/chipStyle';

type GroupKey = 'errors' | 'staffing' | 'quota';

const GROUPS: { key: GroupKey; label: 'diag.group.errors' | 'diag.group.staffing' | 'diag.group.quota'; codes: ViolationCode[] }[] = [
  { key: 'errors', label: 'diag.group.errors', codes: ['POST_NIGHT_DAY', 'NIGHT_GAP', 'DOUBLE_SHIFT', 'QUOTA_OVER'] },
  { key: 'staffing', label: 'diag.group.staffing', codes: ['UNDER_STAFFED', 'HIGH_DENSITY'] },
  { key: 'quota', label: 'diag.group.quota', codes: ['QUOTA_INCOMPLETE'] },
];

function pulse(v: Violation): void {
  if (v.dayIndex < 0 || !v.type) return;
  const node = document.getElementById(cellId(v.dayIndex, v.type));
  if (!node) return;
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.add('anim-pulse');
  window.setTimeout(() => node.classList.remove('anim-pulse'), 520);
}

export function Diagnostics({ showTitle = true }: { showTitle?: boolean | undefined }) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const { list } = useViolations();
  const [open, setOpen] = useState<Record<GroupKey, boolean | undefined>>({ errors: true, staffing: undefined, quota: undefined });

  const total = list.length;

  return (
    <section aria-label={t('diag.title')} className="rounded-[var(--radius-card)] border border-hairline bg-surface p-3">
      {showTitle ? <h2 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-[.04em] text-text-2">{t('diag.title')}</h2> : null}

      {total === 0 ? (
        <p className="flex items-center gap-2 px-2 py-2 text-[13px] text-ok">
          <CheckCircle2 aria-hidden size={15} strokeWidth={1.75} />
          {t('diag.empty')}
        </p>
      ) : null}

      {GROUPS.map(group => {
        const items = list.filter(v => group.codes.includes(v.code));
        if (items.length === 0) return null;
        const expanded = open[group.key] ?? (group.key === 'errors' || items.length <= 6);
        const worst = items.some(v => v.severity === 'error') ? 'error' : items.some(v => v.severity === 'warning') ? 'warning' : 'info';
        const Icon = worst === 'error' ? AlertCircle : worst === 'warning' ? AlertTriangle : Info;
        const tone = worst === 'error' ? 'text-error' : worst === 'warning' ? 'text-warn' : 'text-text-2';
        return (
          <div key={group.key} className="mt-1 first:mt-0">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(o => ({ ...o, [group.key]: !expanded }))}
              className="flex w-full items-center gap-1.5 rounded-[var(--radius-control)] px-2 py-1.5 text-left text-[13px] font-medium text-text hover:bg-accent-tint"
            >
              <ChevronRight
                aria-hidden
                size={14}
                strokeWidth={2}
                className={`shrink-0 text-text-3 transition-transform duration-[var(--dur-fast)] ${expanded ? 'rotate-90' : ''}`}
              />
              <Icon aria-hidden size={14} strokeWidth={2} className={`shrink-0 ${tone}`} />
              <span>{`${t(group.label)} (${items.length})`}</span>
            </button>
            {expanded ? (
              <ul className="flex flex-col">
                {items.map((v, k) => {
                  const RowIcon = v.severity === 'error' ? AlertCircle : v.severity === 'warning' ? AlertTriangle : Info;
                  const rowTone = v.severity === 'error' ? 'text-error' : v.severity === 'warning' ? 'text-warn' : 'text-text-3';
                  return (
                  <li key={`${v.code}-${v.internId ?? ''}-${v.dayIndex}-${v.type ?? ''}-${k}`}>
                    <button
                      type="button"
                      onClick={() => {
                        // The cells only exist in the calendar, so switch first.
                        if (state.ui.view !== 'calendar') {
                          dispatch({ type: 'SET_VIEW', view: 'calendar' });
                          window.setTimeout(() => pulse(v), 60);
                          return;
                        }
                        pulse(v);
                      }}
                      disabled={v.dayIndex < 0}
                      aria-label={v.dayIndex >= 0 ? `${violationMessage(v, state.schedule, lang)}. ${t('a11y.jump')}` : undefined}
                      className="flex w-full items-start gap-1.5 rounded-[var(--radius-control)] py-1 pl-5 pr-2 text-left text-[13px] leading-[1.45] text-text-2
                        transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint disabled:hover:bg-transparent"
                    >
                      <RowIcon aria-hidden size={13} strokeWidth={2} className={`mt-0.5 shrink-0 ${rowTone}`} />
                      <span>{violationMessage(v, state.schedule, lang)}</span>
                    </button>
                  </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
