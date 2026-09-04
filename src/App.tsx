import { useEffect, useRef, useState } from 'react';
import { StoreProvider, useStore } from './state/store';
import { readBoot } from './state/boot';
import { LangProvider, useT } from './i18n';
import type { Schedule } from './engine/types';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Dialog } from './components/ui/Dialog';
import { Button } from './components/ui/Button';
import { SetupScreen } from './components/setup/SetupScreen';
import { BoardScreen } from './components/board/BoardScreen';
import { PRINT_ROOT_ID } from './components/export/printSchedule';
import { download } from './components/export/download';

function Screens({ boot }: { boot: ReturnType<typeof readBoot> }) {
  const { state, dispatch } = useStore();
  const t = useT();
  const toast = useToast();
  const [pendingLink, setPendingLink] = useState<Schedule | null>(boot.pending);
  const [corrupt, setCorrupt] = useState<string | null>(boot.corrupt);
  const announced = useRef(false);

  /** A link that has been dealt with, kept or refused, must not stay in the address
      bar: the next person handed that URL would open somebody else's schedule. */
  const clearHash = (): void => {
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } catch {
      /* null origin or a sandboxed frame: the decision still stands */
    }
  };

  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    if (boot.event === 'loaded') { toast(t('toast.loadedFromLink')); clearHash(); }
    if (boot.event === 'bad') { toast(t('toast.badLink')); clearHash(); }
  }, [boot.event, toast, t]);

  return (
    <>
      <div id="app-root">{state.ui.step === 'setup' ? <SetupScreen /> : <BoardScreen />}</div>
      <div id={PRINT_ROOT_ID} style={{ position: 'fixed', left: -10000, top: 0, width: 1600 }} aria-hidden />
      <Dialog
        open={pendingLink !== null}
        title={t('dialog.link.title')}
        onClose={() => {
          setPendingLink(null);
          clearHash();
        }}
        actions={
          <>
            <Button
              onClick={() => {
                setPendingLink(null);
                clearHash();
              }}
            >
              {t('dialog.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (pendingLink) {
                  dispatch({ type: 'LOAD_SCHEDULE', schedule: pendingLink });
                  dispatch({ type: 'SET_STEP', step: 'board' });
                  toast(t('toast.loadedFromLink'));
                }
                setPendingLink(null);
                clearHash();
              }}
            >
              {t('dialog.link.confirm')}
            </Button>
          </>
        }
      >
        {t('dialog.link.body')}
      </Dialog>

      <Dialog
        open={corrupt !== null}
        title={t('dialog.corrupt.title')}
        onClose={() => setCorrupt(null)}
        actions={
          <>
            <Button
              onClick={() => {
                if (corrupt !== null) {
                  download(new Blob([corrupt], { type: 'application/json' }), 'emed-nobet-yedek.json');
                  toast(t('toast.backupSaved'));
                }
              }}
            >
              {t('dialog.corrupt.download')}
            </Button>
            <Button variant="primary" onClick={() => setCorrupt(null)}>{t('dialog.corrupt.continue')}</Button>
          </>
        }
      >
        {t('dialog.corrupt.body')}
      </Dialog>
    </>
  );
}

function Shell({ boot }: { boot: ReturnType<typeof readBoot> }) {
  const { state, dispatch } = useStore();
  return (
    <LangProvider lang={state.ui.lang} setLang={lang => dispatch({ type: 'SET_LANG', lang })}>
      <ThemeProvider theme={state.ui.theme}>
        <ToastProvider>
          <Screens boot={boot} />
        </ToastProvider>
      </ThemeProvider>
    </LangProvider>
  );
}

export function App() {
  const [boot] = useState(() => readBoot());
  return (
    <ErrorBoundary>
      <StoreProvider>
        <Shell boot={boot} />
      </StoreProvider>
    </ErrorBoundary>
  );
}
