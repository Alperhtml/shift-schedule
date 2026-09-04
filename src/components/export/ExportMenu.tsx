import { useState } from 'react';
import { FileDown, FileSpreadsheet, Image, Link2, Printer, Share2 } from 'lucide-react';
import { useStore } from '../../state/store';
import { useLang, useT } from '../../i18n';
import { useToast } from '../ui/Toast';
import { Menu, type MenuItem } from '../ui/Menu';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { exportPng } from './exportPng';
import { exportXlsx } from './exportXlsx';
import { exportJson } from './exportJson';
import { printSchedule } from './printSchedule';
import { copyLink, linkFor } from './shareLink';

export function ExportMenu({ iconOnly = false }: { iconOnly?: boolean | undefined }) {
  const { state } = useStore();
  const { lang } = useLang();
  const t = useT();
  const toast = useToast();
  const [manualLink, setManualLink] = useState<string | null>(null);

  const run = (fn: () => Promise<string> | string): void => {
    void (async () => {
      try {
        const name = await fn();
        if (name) toast(t('toast.exported', { name }));
      } catch {
        toast(t('toast.exportFailed'));
      }
    })();
  };

  const items: MenuItem[] = [
    { label: t('export.png.calendar'), icon: Image, onSelect: () => run(() => exportPng(state.schedule, 'calendar', lang)) },
    { label: t('export.png.matrix'), icon: Image, onSelect: () => run(() => exportPng(state.schedule, 'matrix', lang)) },
    { label: t('export.xlsx'), icon: FileSpreadsheet, onSelect: () => run(() => exportXlsx(state.schedule, lang)) },
    { label: t('export.print'), icon: Printer, onSelect: () => void printSchedule(state.schedule, lang) },
    { label: t('export.json'), icon: FileDown, onSelect: () => run(() => exportJson(state.schedule)) },
    {
      label: t('export.link'),
      icon: Link2,
      separatorBefore: true,
      onSelect: () => {
        void (async () => {
          const result = await copyLink(state.schedule);
          if (result === 'copied') toast(t('toast.linkCopied'));
          else setManualLink(linkFor(state.schedule));
        })();
      },
    },
  ];

  return (
    <>
      <Menu label={t('toolbar.export')} items={items} icon={Share2} iconOnly={iconOnly} />
      <Dialog
        open={manualLink !== null}
        title={t('dialog.copy.title')}
        onClose={() => setManualLink(null)}
        actions={<Button onClick={() => setManualLink(null)}>{t('dialog.close')}</Button>}
      >
        <p>{t('dialog.copy.body')}</p>
        <input
          readOnly
          value={manualLink ?? ''}
          onFocus={e => e.currentTarget.select()}
          className="mt-3 h-11 w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-[13px] text-text"
        />
      </Dialog>
    </>
  );
}
