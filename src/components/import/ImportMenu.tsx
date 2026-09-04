import { useRef, useState } from 'react';
import { FileUp, FolderInput, Users } from 'lucide-react';
import type { Schedule } from '../../engine/types';
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
  const [merging, setMerging] = useState(false);

  const load = (schedule: Schedule): void => {
    dispatch({ type: 'LOAD_SCHEDULE', schedule });
    dispatch({ type: 'SET_STEP', step: 'board' });
    toast(t('toast.imported'));
  };

  const items: MenuItem[] = [
    { label: t('import.json'), icon: FileUp, onSelect: () => fileRef.current?.click() },
    { label: t('import.merge'), icon: Users, separatorBefore: true, onSelect: () => setMerging(true) },
  ];

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
            const schedule = await importJson(file);
            if (!schedule) {
              toast(t('toast.badFile'));
              return;
            }
            // Replacing a board that has content is destructive and clears the
            // history, so it asks first, exactly as the share link does.
            const hasContent = state.schedule.assignments.length > 0
              || state.schedule.interns.some(i => i.realName.trim() !== '')
              || state.schedule.namePool.some(n => n.trim() !== '');
            if (hasContent) setPending(schedule);
            else load(schedule);
          })();
        }}
      />
      <Dialog
        open={pending !== null}
        title={t('dialog.link.title')}
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
              {t('dialog.link.confirm')}
            </Button>
          </>
        }
      >
        {t('dialog.link.body')}
      </Dialog>

      <MergeDialog open={merging} onClose={() => setMerging(false)} />
    </>
  );
}
