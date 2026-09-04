import { useRef, useState } from 'react';
import { Plus, Shuffle, X } from 'lucide-react';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { NAME_MAX, POOL_MAX } from '../../engine/types';
import { cleanPool, tidyName } from '../../engine/schedule';
import { poolFit } from '../../engine/pool';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';

/** Names waiting for the interns that have none. A name only enters the pool when
    it is committed with Enter or the Add button, so nothing typed and abandoned is
    silently counted, and a name with a space in it is one name. */
export function NamePoolCard({ showTitle = true }: { showTitle?: boolean | undefined }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  const names = cleanPool(state.schedule.namePool);
  const fit = poolFit(state.schedule.interns, state.schedule.namePool);
  const key = (n: string): string => tidyName(n).toLocaleLowerCase('tr-TR');

  /** Lines, commas and semicolons all separate names. No Turkish name contains
      one, and a pasted list uses whichever the person happened to have. */
  const split = (text: string): string[] =>
    text.split(/[\n\r,;]+/).map(p => tidyName(p)).filter(p => p !== '');

  const commit = (parts: string[] = split(draft)): void => {
    if (parts.length === 0) {
      field.current?.focus();
      return;
    }
    const next = [...names];
    let duplicate = false;
    let full = false;
    for (const part of parts) {
      if (next.some(n => key(n) === key(part))) {
        duplicate = true;
        continue;
      }
      if (next.length >= POOL_MAX) {
        full = true;
        break;
      }
      next.push(part);
    }
    setNote(full ? t('pool.full', { n: POOL_MAX }) : duplicate ? t('pool.duplicate') : null);
    if (next.length !== names.length) {
      dispatch({ type: 'SET_NAME_POOL', names: next });
      setDraft('');
    }
    field.current?.focus();
  };

  const remove = (name: string): void => {
    dispatch({ type: 'SET_NAME_POOL', names: names.filter(n => n !== name) });
    setNote(null);
  };

  return (
    <Card title={showTitle ? t('pool.title') : ''}>
      <p className="text-[13px] leading-[1.5] text-text-2">{t('pool.hint')}</p>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={field}
          type="text"
          value={draft}
          maxLength={NAME_MAX}
          aria-label={t('pool.field')}
          placeholder={t('pool.fieldPlaceholder')}
          onChange={e => {
            setDraft(e.target.value);
            setNote(null);
          }}
          onKeyDown={e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            commit();
          }}
          onPaste={e => {
            // A single-line input drops the newlines and maxLength cuts the rest,
            // so a pasted list used to arrive as one 40 character name.
            const text = e.clipboardData.getData('text');
            if (!/[\n\r,;]/.test(text)) return;
            e.preventDefault();
            commit(split(text));
          }}
          className="h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-3
            text-[16px] text-text md:text-[15px] placeholder:text-text-3"
        />
        <Button variant="primary" onClick={() => commit()} disabled={draft.trim() === ''}>
          <Plus aria-hidden size={15} strokeWidth={2} />
          {t('pool.add')}
        </Button>
      </div>

      {note ? <p className="mt-2 text-[13px] text-warn">{note}</p> : null}

      {names.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-3">{t('pool.none')}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {names.map(name => (
            <li key={name}>
              <span className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-control)] bg-surface-2 pl-2.5 pr-1 text-[13px] text-text">
                <span className="max-w-[180px] truncate">{name}</span>
                <button
                  type="button"
                  aria-label={t('pool.removeName', { name })}
                  onClick={() => remove(name)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-3
                    transition-colors duration-[var(--dur-fast)] hover:bg-accent-tint hover:text-text"
                >
                  <X aria-hidden size={13} strokeWidth={2} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="tabular text-[13px] text-text-2">{t('pool.count', { n: names.length, blanks: fit.open })}</span>
        <Button
          disabled={fit.available === 0 || fit.open === 0}
          onClick={() => {
            dispatch({ type: 'DISTRIBUTE_POOL', seed: Date.now() });
            toast(t('toast.poolDistributed'));
          }}
        >
          <Shuffle aria-hidden size={15} strokeWidth={1.75} />
          {t('pool.distribute')}
        </Button>
      </div>
    </Card>
  );
}
