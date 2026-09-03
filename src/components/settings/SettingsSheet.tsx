import { useStore } from '../../state/store';
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

export function SettingsSheet() {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const mobile = useMediaQuery('(max-width: 767px)');

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
        <StaffingCard />
        <NamePoolCard />
      </div>
    </Sheet>
  );
}
