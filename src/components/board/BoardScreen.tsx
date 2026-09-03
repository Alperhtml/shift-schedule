import { useEffect, useRef, useState } from 'react';
import { ListChecks, Users } from 'lucide-react';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Palette } from '../palette/Palette';
import { Diagnostics } from '../diagnostics/Diagnostics';
import { MatrixView } from '../matrix/MatrixView';
import { SettingsSheet } from '../settings/SettingsSheet';
import { AnimateContext, type AnimateState } from './animate';
import { useBoardActions } from './boardActions';
import { CalendarGrid } from './CalendarGrid';
import { DndProvider } from './DndProvider';
import { MobileList } from './MobileList';
import { MobileSheet, type MobileTab } from './MobileSheet';
import { Toolbar } from './Toolbar';
import { TopBar } from './TopBar';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

export function BoardScreen() {
  const { state } = useStore();
  const t = useT();
  const mobile = useMediaQuery('(max-width: 767px)');
  const [animate, setAnimate] = useState<AnimateState>({ token: 0, batch: null });
  const staggerTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(staggerTimer.current), []);
  const [tab, setTab] = useState<MobileTab | null>(null);
  useKeyboardShortcuts();

  // The token is never reset, so no chip remounts a second after a fill and no open
  // popover closes by itself. The stagger is carried by the batch itself, so only the
  // chips that fill produced animate, whenever they happen to mount.
  const actions = useBoardActions(assignments => {
    window.clearTimeout(staggerTimer.current);
    setAnimate({ token: Date.now(), batch: new Set(assignments) });
    staggerTimer.current = window.setTimeout(() => setAnimate(a => ({ ...a, batch: null })), 1200);
  });

  const calendar = state.ui.view === 'calendar';

  return (
    <AnimateContext.Provider value={animate}>
      <DndProvider>
        <TopBar actions={actions} />

        <main className={`mx-auto w-full max-w-[1600px] px-3 pt-3 md:px-5 md:pt-4 ${mobile ? 'pb-[88px]' : 'pb-10'}`}>
          {calendar ? <p className="mb-3 px-1 text-[11px] text-text-2">{t('shift.legend')}</p> : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              {calendar ? (mobile ? <MobileList /> : <CalendarGrid />) : <MatrixView />}
            </div>

            {mobile ? null : (
              <aside className="flex w-full shrink-0 flex-col gap-3 md:flex-row lg:sticky lg:top-[104px] lg:w-72 lg:flex-col">
                <div className="min-w-0 flex-1"><Palette /></div>
                <div className="min-w-0 flex-1"><Diagnostics /></div>
              </aside>
            )}
          </div>
        </main>

        {mobile ? (
          <>
            <MobileSheet tab={tab} onTab={setTab} />
            <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 px-3 py-1.5 pb-[max(6px,env(safe-area-inset-bottom))]">
              {([['interns', Users, t('setup.interns.title')], ['checks', ListChecks, t('diag.title')]] as const).map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={tab === key}
                  onClick={() => setTab(tab === key ? null : key)}
                  className={`flex h-12 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)]
                    transition-colors duration-[var(--dur-fast)] ${tab === key ? 'bg-accent-tint text-accent-text' : 'text-text-2'}`}
                >
                  <Icon aria-hidden size={18} strokeWidth={1.75} />
                  <span className="text-[11px] font-medium leading-none">{label}</span>
                </button>
              ))}
              <div className="ml-auto flex min-w-0 items-center">
                <Toolbar onRandomize={actions.randomize} onReset={actions.reset} busy={actions.busy} compact />
              </div>
            </nav>
          </>
        ) : null}

        <SettingsSheet />
        {actions.dialogs}
      </DndProvider>
    </AnimateContext.Provider>
  );
}
