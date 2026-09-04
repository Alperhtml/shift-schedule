import { useState } from 'react';
import { useStore } from '../../state/store';
import { useLang, useT } from '../../i18n';
import type { Lang } from '../../engine/types';
import { modeOf, type UiState } from '../../state/reducer';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Segmented';
import { AppMark } from '../ui/AppMark';
import { Credit } from '../ui/Credit';
import { PeriodCard } from './PeriodCard';
import { InternsCard } from './InternsCard';
import { StaffingCard } from './StaffingCard';
import { NamePoolCard } from './NamePoolCard';
import { ModeSwitch } from './ModeSwitch';

export function SetupScreen() {
  const { state, dispatch } = useStore();
  const t = useT();
  const { lang } = useLang();
  const [showStaffing, setShowStaffing] = useState(false);
  const mode = modeOf(state.schedule);

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 py-8 md:px-6 md:py-12">
      <header className="mb-2 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <h1 className="flex items-center">
            <AppMark />
          </h1>
          <Credit />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Lang>
            value={lang}
            options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
            onChange={l => dispatch({ type: 'SET_LANG', lang: l })}
            ariaLabel={t('settings.language')}
          />
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
      </header>

      <div className="mb-1 flex flex-col gap-2">
        <ModeSwitch showHint />
      </div>

      <PeriodCard />
      <InternsCard onTouch={() => setShowStaffing(true)} />
      {mode === 'team' && showStaffing ? <StaffingCard /> : null}
      {mode === 'team' && showStaffing ? <NamePoolCard /> : null}

      <div className="mt-2 flex justify-end">
        <Button variant="primary" onClick={() => dispatch({ type: 'SET_STEP', step: 'board' })}>
          {t('setup.continue')}
        </Button>
      </div>
    </main>
  );
}
