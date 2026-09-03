import type { Lang, Schedule } from '../../engine/types';
import { download, fileStem } from './download';
import { mountFrame } from './renderFrame';

export async function exportPng(schedule: Schedule, view: 'calendar' | 'matrix', lang: Lang): Promise<string> {
  const { toPng } = await import('html-to-image');
  const mounted = await mountFrame(schedule, view, lang);
  try {
    const options = { pixelRatio: 3, cacheBust: true, backgroundColor: '#FFFFFF' };
    // Safari returns a blank image on the first call; the second one is the good one.
    await toPng(mounted.node, options);
    const dataUrl = await toPng(mounted.node, options);
    // SPEC section 10 fixes these file names; they do not follow the interface language.
    const name = `${fileStem(schedule.startDate)}-${view === 'matrix' ? 'matris' : 'takvim'}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    download(blob, name);
    return name;
  } finally {
    mounted.unmount();
  }
}
