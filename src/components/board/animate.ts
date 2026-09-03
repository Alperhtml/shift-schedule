import { createContext, useContext } from 'react';
import type { Assignment } from '../../engine/types';

export interface AnimateState {
  /** Changes on every fill so the newly placed chips remount. Never returns to zero. */
  token: number;
  /** Exactly the assignments the last fill produced, so a chip added by hand a
      moment later does not inherit a stagger delay and start out invisible. */
  batch: ReadonlySet<Assignment> | null;
}

export const AnimateContext = createContext<AnimateState>({ token: 0, batch: null });

export function useAnimate(): AnimateState {
  return useContext(AnimateContext);
}
