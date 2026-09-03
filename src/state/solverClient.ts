import type { Schedule } from '../engine/types';
import { solve, type SolveResult } from '../engine/solver';

/** Runs the solver in a worker so the board never freezes. Falls back to the
    main thread when workers are unavailable (older browsers, some test runners). */
export function runSolver(schedule: Schedule, seed: number): Promise<SolveResult> {
  if (typeof Worker === 'undefined') return Promise.resolve(solve(schedule, { seed }));
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../engine/solver.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(solve(schedule, { seed }));
      return;
    }
    worker.onmessage = (e: MessageEvent<SolveResult>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = err => {
      reject(err instanceof Error ? err : new Error('solver worker failed'));
      worker.terminate();
    };
    worker.postMessage({ schedule, options: { seed } });
  });
}
