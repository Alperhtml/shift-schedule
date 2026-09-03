import type { CSSProperties } from 'react';
import type { ColorKey, ShiftType } from '../../engine/types';

export const chipStyle = (key: ColorKey): CSSProperties => ({
  background: `var(--chip-${key}-bg)`,
  color: `var(--chip-${key}-fg)`,
});

export const dotStyle = (key: ColorKey): CSSProperties => ({ background: `var(--dot-${key})` });

export const cellId = (dayIndex: number, type: ShiftType): string => `slot-${dayIndex}-${type}`;
