import type { Lang, Schedule } from '../../engine/types';
import { mountFrame } from './renderFrame';

export const PRINT_ROOT_ID = 'print-root';

/** Prints the calendar frame on one A4 landscape page; print.css does the fitting. */
export async function printSchedule(schedule: Schedule, lang: Lang): Promise<void> {
  const host = document.getElementById(PRINT_ROOT_ID);
  if (!host) return;
  const mounted = await mountFrame(schedule, 'calendar', lang, host);

  // Fit one A4 landscape page in both directions. The usable box is
  // 297 x 210 mm minus 10 mm margins, in CSS pixels at 96 dpi.
  const PX_PER_MM = 96 / 25.4;
  const usableWidth = 277 * PX_PER_MM;
  const usableHeight = 190 * PX_PER_MM;
  const height = mounted.node.scrollHeight || 1040;
  host.style.setProperty('--print-scale', String(Math.min(usableWidth / 1600, usableHeight / height)));

  const cleanup = (): void => {
    window.removeEventListener('afterprint', cleanup);
    window.setTimeout(() => mounted.unmount(), 0);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Browsers that never fire afterprint (some mobile ones) still get cleaned up.
  window.setTimeout(cleanup, 60_000);
}
