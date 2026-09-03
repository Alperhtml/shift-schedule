import { solve, type SolveOptions } from './solver';
import type { Schedule } from './types';

self.onmessage = (e: MessageEvent<{ schedule: Schedule; options: SolveOptions }>): void => {
  self.postMessage(solve(e.data.schedule, e.data.options));
};
