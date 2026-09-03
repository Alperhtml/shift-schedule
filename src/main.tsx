import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './App';

declare global {
  interface Window {
    __emedReady?: boolean;
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<StrictMode><App /></StrictMode>);
  window.__emedReady = true;
  // Let the first paint land, then fade the splash out and take it out of the DOM.
  const splash = document.getElementById('splash');
  if (splash) {
    // Hold it long enough for one full sweep of the mark, so a cached load does not
    // tear the animation down a third of the way through.
    const shown = Number(document.documentElement.dataset['splashAt'] ?? 0);
    const elapsed = shown > 0 ? Date.now() - shown : 0;
    window.setTimeout(() => {
      splash.classList.add('is-gone');
      window.setTimeout(() => splash.remove(), 320);
    }, Math.max(120, 1500 - elapsed));
  }
}
