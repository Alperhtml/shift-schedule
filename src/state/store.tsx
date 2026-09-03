import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { reducer, type Action, type AppState } from './reducer';
import { savePersisted } from './persistence';
import { readBoot } from './boot';

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const Ctx = createContext<StoreValue | null>(null);

function boot(): AppState {
  return readBoot().state;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, boot);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => savePersisted(state), 300);
    return () => window.clearTimeout(timer.current);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}
