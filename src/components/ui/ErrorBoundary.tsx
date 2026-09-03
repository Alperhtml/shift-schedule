import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Last line of defence: a readable page with a way out, instead of a blank one.
    It sits above every provider, so it cannot ask which language is selected and
    prints both, straight from the dictionaries. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('EMED nöbet planlayıcı:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    // A crash before ThemeProvider ran would leave no data-theme, so set one here.
    if (!document.documentElement.getAttribute('data-theme')) {
      const dark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    }
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <img src="./koc-logo.png" alt="" aria-hidden width={48} height={40} className="h-10 w-12 opacity-35" />
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-text">{t('tr', 'error.title')}</h1>
        <p className="max-w-[380px] text-[13px] leading-[1.5] text-text-2">
          {t('tr', 'error.body')}
          <br />
          <span className="text-text-3">{t('en', 'error.body')}</span>
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="mt-1 inline-flex h-11 items-center rounded-[var(--radius-control)] bg-accent px-4 text-[15px] font-medium text-white"
        >
          {`${t('tr', 'error.retry')} / ${t('en', 'error.retry')}`}
        </button>
      </div>
    );
  }
}
