import { Languages, MoreHorizontal, Redo2, RotateCcw, Settings, Undo2 } from 'lucide-react';
import { useStore } from '../../state/store';
import { useLang, useT } from '../../i18n';
import { formatDay } from '../../engine/dates';
import type { Lang } from '../../engine/types';
import type { UiState } from '../../state/reducer';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Segmented } from '../ui/Segmented';
import { IconButton } from '../ui/IconButton';
import { Menu, type MenuItem } from '../ui/Menu';
import { ExportMenu } from '../export/ExportMenu';
import { ImportMenu } from '../import/ImportMenu';
import { AppMark } from '../ui/AppMark';
import { Credit } from '../ui/Credit';
import { Toolbar } from './Toolbar';
import type { BoardActions } from './boardActions';

export function TopBar({ actions }: { actions: BoardActions }) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const t = useT();
  const mobile = useMediaQuery('(max-width: 767px)');
  const range = `${formatDay(state.schedule.startDate, 0, lang, 'd MMM')} – ${formatDay(state.schedule.startDate, 27, lang, 'd MMM yyyy')}`;

  const viewControl = (
    <Segmented<UiState['view']>
      value={state.ui.view}
      options={[{ value: 'calendar', label: t('board.tab.calendar') }, { value: 'matrix', label: t('board.tab.matrix') }]}
      onChange={view => dispatch({ type: 'SET_VIEW', view })}
      ariaLabel={t('a11y.view')}
    />
  );

  const overflow: MenuItem[] = [
    { label: t('toolbar.undo'), icon: Undo2, onSelect: () => dispatch({ type: 'UNDO' }), disabled: state.past.length === 0 },
    { label: t('toolbar.redo'), icon: Redo2, onSelect: () => dispatch({ type: 'REDO' }), disabled: state.future.length === 0 },
    { label: t('toolbar.reset'), icon: RotateCcw, separatorBefore: true, onSelect: actions.reset, disabled: state.schedule.assignments.length === 0 },
    { label: t('lang.other'), icon: Languages, separatorBefore: true, onSelect: () => dispatch({ type: 'SET_LANG', lang: lang === 'tr' ? 'en' : 'tr' }) },
    { label: t('toolbar.settings'), icon: Settings, separatorBefore: true, onSelect: () => dispatch({ type: 'SET_SETTINGS_OPEN', open: true }) },
  ];

  return (
    <header className="glass z-40 border-b border-hairline md:sticky md:top-0">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 md:px-5 md:py-3">
        {/* On a phone the title takes its own row so nothing is abbreviated; from
            the tablet breakpoint up everything sits on one line. */}
        {/* No min-w-0 from the tablet breakpoint up: the title must not shrink, so a
            crowded row pushes the toolbar onto its own line instead of abbreviating
            the application name. */}
        <div className="w-full min-w-0 md:w-auto md:min-w-fit md:flex-1">
          <h1 className="flex min-w-0 items-center">
            <AppMark size="sm" />
          </h1>
          <div className="flex items-center gap-1">
            <p className="truncate text-[13px] text-text-2">{range}</p>
            <Credit />
          </div>
        </div>

        {viewControl}

        {mobile ? (
          <>
            <ImportMenu iconOnly />
            <ExportMenu iconOnly />
            <Menu label={t('toolbar.more')} items={overflow} icon={MoreHorizontal} iconOnly />
          </>
        ) : (
          <div className="flex items-center gap-1">
            <IconButton
              label={t('toolbar.undo')}
              icon={Undo2}
              disabled={state.past.length === 0}
              onClick={() => dispatch({ type: 'UNDO' })}
            />
            <IconButton
              label={t('toolbar.redo')}
              icon={Redo2}
              disabled={state.future.length === 0}
              onClick={() => dispatch({ type: 'REDO' })}
            />
            <IconButton label={t('toolbar.settings')} icon={Settings} onClick={() => dispatch({ type: 'SET_SETTINGS_OPEN', open: true })} />
            <Segmented<Lang>
              value={lang}
              options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
              onChange={l => dispatch({ type: 'SET_LANG', lang: l })}
              ariaLabel={t('settings.language')}
              className="ml-1"
            />
          </div>
        )}

        {mobile ? null : (
          <div className="flex w-full justify-end lg:w-auto">
            <Toolbar onRandomize={actions.randomize} onReset={actions.reset} busy={actions.busy} />
          </div>
        )}
      </div>
    </header>
  );
}
