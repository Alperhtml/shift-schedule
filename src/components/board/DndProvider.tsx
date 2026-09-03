import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Action } from '../../state/reducer';
import type { Cell, InternId, Schedule, ShiftType, SlotKey } from '../../engine/types';
import { parseSlotKey } from '../../engine/schedule';
import { formatDay } from '../../engine/dates';
import { wouldViolate } from '../../engine/rules';
import { useStore } from '../../state/store';
import { useLang, internLabel, localeTag, t } from '../../i18n';
import { chipStyle } from './chipStyle';

export type DragData =
  | { source: 'palette'; internId: InternId }
  | { source: 'slot'; internId: InternId; dayIndex: number; type: ShiftType };

export const PALETTE_ID = 'palette';

/** The board a drag would produce. A palette drag adds; a slot drag moves, so the
    shift being dragged has to leave its old cell before the candidate is judged. */
export function scheduleAfterPickUp(schedule: Schedule, data: DragData): Schedule {
  if (data.source !== 'slot') return schedule;
  return {
    ...schedule,
    assignments: schedule.assignments.filter(
      a => !(a.internId === data.internId && a.dayIndex === data.dayIndex && a.type === data.type),
    ),
  };
}

/** What the drop ghost should say. `null` means the intern is already in that slot. */
export function ghostSeverity(schedule: Schedule, data: DragData, cell: Cell): 'ok' | 'error' | null {
  const already = schedule.assignments.some(a => a.internId === data.internId && a.dayIndex === cell.dayIndex && a.type === cell.type);
  if (already) return null;
  const found = wouldViolate(scheduleAfterPickUp(schedule, data), { internId: data.internId, dayIndex: cell.dayIndex, type: cell.type });
  // wouldViolate filters out the only warning-severity code (UNDER_STAFFED),
  // so the ghost is either a rule break or clean.
  return found.some(v => v.severity === 'error') ? 'error' : 'ok';
}

/** Pure drop rule, unit tested without a DOM. */
export function actionForDrop(data: DragData, overId: string | null): Action | null {
  if (overId === null) return null;
  if (overId === PALETTE_ID) {
    if (data.source !== 'slot') return null;
    return { type: 'UNASSIGN', internId: data.internId, dayIndex: data.dayIndex, shift: data.type };
  }
  const { dayIndex, type } = parseSlotKey(overId as SlotKey);
  if (data.source === 'palette') return { type: 'ASSIGN', internId: data.internId, dayIndex, shift: type };
  if (data.dayIndex === dayIndex && data.type === type) return null;
  return {
    type: 'MOVE',
    internId: data.internId,
    from: { dayIndex: data.dayIndex, shift: data.type },
    to: { dayIndex, shift: type },
  };
}

interface DragState {
  activeInternId: InternId | null;
  over: string | null;
  severity: 'ok' | 'error' | null;
  shaking: string | null;
}

const DragCtx = createContext<DragState>({ activeInternId: null, over: null, severity: null, shaking: null });

export function useDragState(): DragState {
  return useContext(DragCtx);
}

export function DndProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useStore();
  const { lang } = useLang();
  const [drag, setDrag] = useState<DragState>({ activeInternId: null, over: null, severity: null, shaking: null });

  // MouseSensor rather than PointerSensor: PointerSensor answers every pointerdown,
  // including touch, so TouchSensor's long press never ran and the browser cancelled
  // the drag as soon as it decided the gesture was a scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const dataOf = (e: DragStartEvent | DragOverEvent | DragEndEvent): DragData | null =>
    (e.active.data.current as DragData | undefined) ?? null;

  const onDragStart = useCallback((e: DragStartEvent) => {
    const data = (e.active.data.current as DragData | undefined) ?? null;
    setDrag({ activeInternId: data?.internId ?? null, over: null, severity: null, shaking: null });
  }, []);

  const onDragOver = useCallback(
    (e: DragOverEvent) => {
      const data = dataOf(e);
      const overId = e.over ? String(e.over.id) : null;
      if (!data || overId === null || overId === PALETTE_ID) {
        setDrag(d => ({ ...d, over: overId, severity: null }));
        return;
      }
      const { dayIndex, type } = parseSlotKey(overId as SlotKey);
      const severity = ghostSeverity(state.schedule, data, { dayIndex, type });
      setDrag(d => ({ ...d, over: overId, severity }));
    },
    [state.schedule],
  );

  const shake = useCallback((id: string) => {
    setDrag({ activeInternId: null, over: null, severity: null, shaking: id });
    window.setTimeout(() => setDrag(d => ({ ...d, shaking: null })), 200);
  }, []);

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const data = dataOf(e);
      const overId = e.over ? String(e.over.id) : null;
      const action = data ? actionForDrop(data, overId) : null;
      const target = action?.type === 'ASSIGN'
        ? { dayIndex: action.dayIndex, type: action.shift }
        : action?.type === 'MOVE'
          ? { dayIndex: action.to.dayIndex, type: action.to.shift }
          : null;
      const duplicate = data !== null && target !== null
        && state.schedule.assignments.some(a => a.internId === data.internId && a.dayIndex === target.dayIndex && a.type === target.type);

      if (duplicate && overId !== null) {
        shake(overId);
        return;
      }
      if (action) dispatch(action);
      setDrag({ activeInternId: null, over: null, severity: null, shaking: null });
    },
    [dispatch, shake, state.schedule],
  );

  const onDragCancel = useCallback(() => {
    setDrag({ activeInternId: null, over: null, severity: null, shaking: null });
  }, []);

  // dnd-kit's defaults are English and announce raw ids.
  const describe = useCallback(
    (id: string | number): string => {
      const key = String(id);
      const intern = state.schedule.interns.find(i => key.includes(i.id));
      return intern ? internLabel(intern, lang) : key;
    },
    [state.schedule.interns, lang],
  );
  const describeSlot = useCallback(
    (id: string | number | undefined): string => {
      if (id === undefined) return '';
      const key = String(id);
      if (key === PALETTE_ID) return t(lang, 'setup.interns.title');
      try {
        const { dayIndex, type } = parseSlotKey(key as SlotKey);
        return t(lang, 'a11y.slot', {
          date: formatDay(state.schedule.startDate, dayIndex, lang, 'd MMM EEE'),
          shift: t(lang, type === 'NIGHT' ? 'shift.night' : 'shift.day').toLocaleLowerCase(localeTag(lang)),
        });
      } catch {
        return key;
      }
    },
    [state.schedule.startDate, lang],
  );
  const announcements = useMemo(
    () => ({
      onDragStart: ({ active: a }: { active: { id: string | number } }) => t(lang, 'a11y.dragStart', { intern: describe(a.id) }),
      onDragOver: ({ active: a, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? t(lang, 'a11y.dragOver', { intern: describe(a.id), slot: describeSlot(over.id) }) : '',
      onDragEnd: ({ active: a, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
        over ? t(lang, 'a11y.dragEnd', { intern: describe(a.id), slot: describeSlot(over.id) }) : t(lang, 'a11y.dragCancel', { intern: describe(a.id) }),
      onDragCancel: ({ active: a }: { active: { id: string | number } }) => t(lang, 'a11y.dragCancel', { intern: describe(a.id) }),
    }),
    [lang, describe, describeSlot],
  );

  const active = useMemo(
    () => state.schedule.interns.find(i => i.id === drag.activeInternId) ?? null,
    [state.schedule.interns, drag.activeInternId],
  );

  return (
    <DndContext
      accessibility={{ screenReaderInstructions: { draggable: t(lang, 'a11y.dragHint') }, announcements }}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <DragCtx.Provider value={drag}>{children}</DragCtx.Provider>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <span
            style={chipStyle(active.colorKey)}
            className="inline-flex h-6 scale-[1.04] items-center rounded-[var(--radius-control)] px-2 text-[13px] font-medium shadow-[var(--shadow-float)]"
          >
            {internLabel(active, lang)}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
