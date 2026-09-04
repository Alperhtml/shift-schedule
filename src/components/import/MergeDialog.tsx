import { useMemo, useRef, useState } from 'react';
import { FilePlus2, Trash2, TriangleAlert } from 'lucide-react';
import { MAX_INTERNS } from '../../engine/types';
import { mergeSchedules, type MergeFile, type MergeInput, type MergeResult } from '../../engine/merge';
import { formatDay } from '../../engine/dates';
import { useStore } from '../../state/store';
import { useLang, useT } from '../../i18n';
import { importJson } from '../export/exportJson';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { useToast } from '../ui/Toast';

const LIST_MAX = 8;

/** Every person's own file, combined into one board. The review comes first:
    nothing is written until the user has seen who came in and what collides. */
export function MergeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [inputs, setInputs] = useState<MergeInput[]>([]);
  const [unreadable, setUnreadable] = useState(0);

  const result: MergeResult = useMemo(() => mergeSchedules(inputs), [inputs]);

  const close = (): void => {
    setInputs([]);
    setUnreadable(0);
    onClose();
  };

  const add = (files: FileList): void => {
    void (async () => {
      const parsed = await Promise.all([...files].map(async f => ({ file: f.name, schedule: await importJson(f) })));
      const good = parsed.filter((p): p is MergeInput => p.schedule !== null);
      const bad = parsed.length - good.length;
      // A file already in the list is replaced, so picking the same one twice is
      // not the same as two people sending the same name.
      setInputs(prev => [...prev.filter(p => !good.some(g => g.file === p.file)), ...good]);
      setUnreadable(bad);
    })();
  };

  const apply = (): void => {
    if (!result.schedule) return;
    dispatch({ type: 'LOAD_SCHEDULE', schedule: result.schedule });
    dispatch({ type: 'SET_STEP', step: 'board' });
    toast(t('toast.merged', { n: result.people.length }));
    close();
  };

  const problemText = (f: MergeFile): string | null => {
    switch (f.problem) {
      case 'noPeople': return t('merge.file.noPeople');
      case 'unnamed': return t('merge.file.unnamed');
      case 'dateMismatch': return t('merge.file.dateMismatch');
      case 'duplicate': return t('merge.file.duplicate', { file: f.otherFile ?? '' });
      case 'tooMany': return t('merge.file.tooMany', { n: MAX_INTERNS });
      case null: return null;
    }
  };

  const problems: string[] = [];
  if (result.empty.length > 0) problems.push(t('merge.problem.empty', { n: result.empty.length }));
  if (result.over.length > 0) problems.push(t('merge.problem.over', { n: result.over.length }));
  if (result.incomplete.length > 0) problems.push(t('merge.problem.incomplete', { n: result.incomplete.length }));
  if (result.ruleErrors > 0) problems.push(t('merge.problem.rules', { n: result.ruleErrors }));

  // Only a duplicate person or an over-full roster is something the user has to
  // decide; the other file problems simply leave that file out.
  const needsDecision = result.files.some(f => f.problem === 'duplicate' || f.problem === 'tooMany');
  const emptyShown = result.empty.slice(0, LIST_MAX);
  const shiftName = (type: 'DAY' | 'NIGHT'): string => t(type === 'NIGHT' ? 'shift.night' : 'shift.day');

  return (
    <>
      <Dialog
        open={open}
        size="lg"
        title={t('merge.title')}
        onClose={close}
        actions={
          <>
            <Button onClick={close}>{t('dialog.cancel')}</Button>
            <Button variant="primary" disabled={result.schedule === null || result.blocked} onClick={apply}>
              {t('merge.apply')}
            </Button>
          </>
        }
      >
        <p>{t('merge.intro')}</p>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={() => fileRef.current?.click()}>
            <FilePlus2 aria-hidden size={16} strokeWidth={1.75} />
            {inputs.length === 0 ? t('merge.pick') : t('merge.pickMore')}
          </Button>
          {unreadable > 0 ? (
            <span className="text-[13px] text-error">{t('merge.unreadable', { n: unreadable })}</span>
          ) : null}
        </div>

        {inputs.length === 0 ? (
          <p className="mt-4 text-text-3">{t('merge.none')}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-1.5">
            {result.files.map(f => {
              const person = result.people.find(p => p.file === f.file);
              const bad = problemText(f);
              return (
                <li
                  key={f.file}
                  className="flex items-center gap-3 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-text">
                      {f.people.length > 0 ? f.people.join(', ') : f.file}
                    </p>
                    <p className={`truncate text-[12px] ${bad ? 'text-error' : 'text-text-2'}`}>
                      {bad ?? (person ? t('merge.counts', { day: person.day, night: person.night }) : f.file)}
                    </p>
                  </div>
                  <IconButton
                    label={t('merge.remove')}
                    icon={Trash2}
                    size={16}
                    onClick={() => setInputs(prev => prev.filter(p => p.file !== f.file))}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {result.schedule && result.startDate !== null ? (
          <div className="mt-4 border-t border-hairline pt-3">
            <p className="text-[13px] text-text">
              {t('merge.people', { n: result.people.length, min: result.minPerShift })}
            </p>
            <p className="text-[12px] text-text-2">
              {t('merge.period', {
                start: formatDay(result.startDate, 0, lang, 'd MMM'),
                end: formatDay(result.startDate, 27, lang, 'd MMM yyyy'),
              })}
            </p>

            {problems.length === 0 ? (
              <p className="mt-3 text-[13px] text-ok">{t('merge.clean')}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1 text-[13px] text-text">
                {problems.map(p => (
                  <li key={p} className="flex items-center gap-2">
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn-stroke" />
                    {p}
                  </li>
                ))}
              </ul>
            )}

            {result.incomplete.length > 0 ? (
              <ul className="mt-2 flex flex-col text-[12px] text-text-2">
                {result.incomplete.slice(0, LIST_MAX).map(p => (
                  <li key={p.name}>{t('merge.incompleteLine', { name: p.name, day: p.day, night: p.night })}</li>
                ))}
                {result.incomplete.length > LIST_MAX
                  ? <li>{t('merge.more', { n: result.incomplete.length - LIST_MAX })}</li>
                  : null}
              </ul>
            ) : null}

            {result.empty.length > 0 ? (
              <p className="mt-2 text-[12px] text-text-2">
                {emptyShown
                  .map(c => `${formatDay(result.startDate ?? '', c.dayIndex, lang, 'd MMM')} ${shiftName(c.type).toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US')}`)
                  .join(' · ')}
                {result.empty.length > LIST_MAX ? ` · ${t('merge.more', { n: result.empty.length - LIST_MAX })}` : ''}
              </p>
            ) : null}

            <p className="mt-3 text-[12px] text-text-2">{t('merge.replaces')}</p>
          </div>
        ) : null}

        {needsDecision ? (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-error">
            <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-px shrink-0" />
            {t('merge.blocked')}
          </p>
        ) : null}
      </Dialog>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        multiple
        className="hidden"
        onChange={e => {
          const files = e.target.files;
          if (files && files.length > 0) add(files);
          e.target.value = '';
        }}
      />
    </>
  );
}
