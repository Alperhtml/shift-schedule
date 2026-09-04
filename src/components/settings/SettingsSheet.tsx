import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../../state/store';
import { modeOf } from '../../state/reducer';
import { useLang, useT } from '../../i18n';
import type { Lang } from '../../engine/types';
import type { UiState } from '../../state/reducer';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Sheet } from '../ui/Sheet';
import { Segmented } from '../ui/Segmented';
import { PeriodCard } from '../setup/PeriodCard';
import { InternsCard } from '../setup/InternsCard';
import { StaffingCard } from '../setup/StaffingCard';
import { NamePoolCard } from '../setup/NamePoolCard';
import { ModeSwitch } from '../setup/ModeSwitch';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';
import { nextMonday } from '../../engine/dates';

export function SettingsSheet() {
  const { state, dispatch } = useStore();
  const solo = modeOf(state.schedule) === 'solo';
  const { lang } = useLang();
  const t = useT();
  const mobile = useMediaQuery('(max-width: 767px)');
  const toast = useToast();
  const [askRestart, setAskRestart] = useState(false);

  const restart = (): void => {
    // A shared link would otherwise reload the same schedule on the next refresh.
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } catch {
      /* null origin or a sandboxed frame: the state still resets, the address bar just keeps the hash */
    }
    dispatch({ type: 'RESET_ALL', isoDate: nextMonday(new Date()) });
    setAskRestart(false);
    toast(t('toast.restarted'));
  };

  return (
    <Sheet
      open={state.ui.settingsOpen}
      side={mobile ? 'bottom' : 'right'}
      title={t('settings.title')}
      onClose={() => dispatch({ type: 'SET_SETTINGS_OPEN', open: false })}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-text-2">{t('settings.language')}</span>
          <Segmented<Lang>
            value={lang}
            options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
            onChange={l => dispatch({ type: 'SET_LANG', lang: l })}
            ariaLabel={t('settings.language')}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-text-2">{t('settings.mode')}</span>
          <ModeSwitch />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-text-2">{t('settings.theme')}</span>
          <Segmented<UiState['theme']>
            value={state.ui.theme}
            options={[
              { value: 'system', label: t('theme.system') },
              { value: 'light', label: t('theme.light') },
              { value: 'dark', label: t('theme.dark') },
            ]}
            onChange={theme => dispatch({ type: 'SET_THEME', theme })}
            ariaLabel={t('settings.theme')}
          />
        </div>
        <PeriodCard />
        <InternsCard />
        {solo ? null : <StaffingCard />}
        {solo ? null : <NamePoolCard />}

        <div className="mt-1 flex flex-col items-start gap-1 border-t border-hairline pt-4">
          <Button variant="destructive" onClick={() => setAskRestart(true)}>
            <RotateCcw aria-hidden size={15} strokeWidth={1.75} />
            {t('settings.restart')}
          </Button>
          <p className="px-1 text-[12px] leading-[1.45] text-text-2">{t('settings.restart.hint')}</p>
        </div>
      </div>

      <Dialog
        open={askRestart}
        title={t('dialog.restart.title')}
        onClose={() => setAskRestart(false)}
        actions={
          <>
            <Button onClick={() => setAskRestart(false)}>{t('dialog.cancel')}</Button>
            <Button variant="destructive" onClick={restart}>{t('dialog.restart.confirm')}</Button>
          </>
        }
      >
        {t('dialog.restart.body')}
      </Dialog>
    </Sheet>
  );
}
