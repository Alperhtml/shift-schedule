import { useMemo } from 'react';
import { useStore } from './store';
import { validate, type Severity, type Violation } from '../engine/rules';
import { slotKey } from '../engine/schedule';
import type { SlotKey } from '../engine/types';

const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

const worst = (list: Violation[] | undefined): Severity | null =>
  list && list.length > 0 ? list.reduce<Severity>((acc, v) => (RANK[v.severity] < RANK[acc] ? v.severity : acc), 'info') : null;

export interface ViolationIndex {
  list: Violation[];
  byCell: Map<SlotKey, Violation[]>;
  byInternSlot: Map<string, Violation[]>;
  severityOfCell: (key: SlotKey) => Severity | null;
  severityOfChip: (internId: string, key: SlotKey) => Severity | null;
  cellViolations: (key: SlotKey) => Violation[];
  chipViolations: (internId: string, key: SlotKey) => Violation[];
}

export function useViolations(): ViolationIndex {
  const { state } = useStore();
  return useMemo(() => {
    const list = validate(state.schedule);
    const byCell = new Map<SlotKey, Violation[]>();
    const byInternSlot = new Map<string, Violation[]>();
    const push = <K,>(m: Map<K, Violation[]>, k: K, v: Violation): void => {
      const l = m.get(k);
      if (l) l.push(v);
      else m.set(k, [v]);
    };
    for (const v of list) {
      if (v.dayIndex < 0 || !v.type) continue;
      const cells = [{ dayIndex: v.dayIndex, type: v.type }, ...v.related];
      for (const c of cells) {
        const k = slotKey(c.dayIndex, c.type);
        push(byCell, k, v);
        if (v.internId) push(byInternSlot, `${v.internId}@${k}`, v);
      }
    }
    const slotLevel = (key: SlotKey): Violation[] => (byCell.get(key) ?? []).filter(v => v.internId === undefined);
    const chipLevel = (internId: string, key: SlotKey): Violation[] => byInternSlot.get(`${internId}@${key}`) ?? [];
    return {
      list,
      byCell,
      byInternSlot,
      severityOfCell: key => worst(slotLevel(key)),
      severityOfChip: (internId, key) => worst(chipLevel(internId, key)),
      cellViolations: slotLevel,
      chipViolations: chipLevel,
    };
  }, [state.schedule]);
}
