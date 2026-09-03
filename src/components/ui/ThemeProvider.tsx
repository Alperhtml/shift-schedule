import { useEffect, type ReactNode } from 'react';
import type { UiState } from '../../state/reducer';

/** Writes data-theme on <html>. "system" follows prefers-color-scheme live. */
export function ThemeProvider({ theme, children }: { theme: UiState['theme']; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media?.matches === true);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      // Keep the browser chrome in step with the choice, not with the OS.
      document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = dark ? '#151517' : '#F5F5F7';
      document.head.appendChild(meta);
    };
    apply();
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <>{children}</>;
}
