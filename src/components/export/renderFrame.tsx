import { createRoot, type Root } from 'react-dom/client';
import type { Lang, Schedule } from '../../engine/types';
import { formatDay } from '../../engine/dates';
import { toIso } from '../../engine/dates';
import { ExportFrame } from './ExportFrame';

export function generatedLabel(lang: Lang, now: Date): string {
  return formatDay(toIso(now), 0, lang, 'd MMM yyyy');
}

/** requestAnimationFrame never fires in a hidden tab, so an export started
    just before the user switches away would hang. Both waits race a timer. */
function nextFrame(): Promise<void> {
  return new Promise<void>(resolve => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    window.setTimeout(finish, 60);
  });
}

async function settle(): Promise<void> {
  await nextFrame();
  await nextFrame();
  const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  if (fonts) await Promise.race([fonts.ready, new Promise(r => window.setTimeout(r, 2000))]);
}

interface Mounted {
  node: HTMLElement;
  unmount: () => void;
}

/** Mounts the export frame into `host` (created off-screen when not given). */
export async function mountFrame(
  schedule: Schedule,
  view: 'calendar' | 'matrix',
  lang: Lang,
  host?: HTMLElement,
): Promise<Mounted> {
  const owned = host === undefined;
  const container = host ?? document.createElement('div');
  if (owned) {
    container.style.cssText = 'position:fixed;left:-10000px;top:0;width:1600px;z-index:-1;';
    document.body.appendChild(container);
  }
  const root: Root = createRoot(container);
  root.render(<ExportFrame schedule={schedule} view={view} lang={lang} generatedOn={generatedLabel(lang, new Date())} />);
  await settle();
  const node = container.firstElementChild instanceof HTMLElement ? container.firstElementChild : container;
  return {
    node,
    unmount: () => {
      root.unmount();
      if (owned) container.remove();
    },
  };
}
