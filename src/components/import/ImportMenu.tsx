import { useRef, useState } from 'react';
import { FileUp, FolderInput, Users } from 'lucide-react';
import type { Schedule } from '../../engine/types';
import type { ScheduleError } from '../../engine/codec';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { useToast } from '../ui/Toast';
import { Menu, type MenuItem } from '../ui/Menu';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { importJson } from '../export/exportJson';
import { MergeDialog } from './MergeDialog';

/** Every way into the app: one file, or everyone's files at once. */
export function ImportMenu({ iconOnly = false }: { iconOnly?: boolean | undefined }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Schedule | null>(null);
  const [failure, setFailure] = useState<ScheduleError | null>(null);
  const [merging, setMerging] = useState(false);

  const load = (schedule: Schedule): void => {
    dispatch({ type: 'LOAD_SCHEDULE', schedule });
    dispatch({ type: 'SET_STEP', step: 'board' });
    toast(t('toast.imported'));
  };

  const items: MenuItem[] = [
    { label: t('import.json'), icon: FileUp, onSelect: () => fileRef.current?.click() },
    {
      label: t('import.merge'),
      icon: Users,
      hint: t('import.merge.hint'),
      highlight: true,
      separatorBefore: true,
      onSelect: () => setMerging(true),
    },
  ];

  // A one-person file turns a team board into a solo one, which is a bigger change
  // than "load a file" suggests, so the confirmation says so out loud.
  const shrinksToSolo = pending !== null && pending.interns.length === 1 && state.schedule.interns.length > 1;

  return (
    <>
      <Menu label={t('toolbar.import')} items={items} icon={FolderInput} iconOnly={iconOnly} />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void (async () => {
            const parsed = await importJson(file);
            if (!parsed.ok) {
              setFailure(parsed.error);
              return;
            }
            // Replacing a board that has content is destructive and clears the
            // history, so it asks first, exactly as the share link does.
            const hasContent = state.schedule.assignments.length > 0
              || state.schedule.interns.some(i => i.realName.trim() !== '')
              || state.schedule.namePool.some(n => n.trim() !== '');
            if (hasContent) setPending(parsed.schedule);
            else load(parsed.schedule);
          })();
        }}
      />
      <Dialog
        open={pending !== null}
        title={t('dialog.import.title')}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button onClick={() => setPending(null)}>{t('dialog.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pending) load(pending);
                setPending(null);
              }}
            >
              {t('dialog.import.confirm')}
            </Button>
          </>
        }
      >
        <p>{t('dialog.import.body')}</p>
        {shrinksToSolo ? (
          <p className="mt-2">{t('dialog.import.solo', { n: state.schedule.interns.length })}</p>
        ) : null}
      </Dialog>

      <Dialog
        open={failure !== null}
        title={t('dialog.badFile.title')}
        onClose={() => setFailure(null)}
        actions={<Button onClick={() => setFailure(null)}>{t('dialog.close')}</Button>}
      >
        {failure ? t(`file.error.${failure.code}`, failure.params) : ''}
      </Dialog>

      <MergeDialog open={merging} onClose={() => setMerging(false)} />
    </>
  );
}
