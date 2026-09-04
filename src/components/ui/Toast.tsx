import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ToastItem {
  id: number;
  text: string;
}

const Ctx = createContext<(text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const push = useCallback((text: string) => {
    const id = next.current++;
    setItems(list => [...list, { id, text }]);
    window.setTimeout(() => setItems(list => list.filter(i => i.id !== id)), 3000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-6">
          {items.map(i => (
            <div key={i.id} className="glass anim-enter-up rounded-full border border-hairline px-4 py-2 text-[13px] text-text shadow-[var(--shadow-float)]">
              {i.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useToast(): (text: string) => void {
  return useContext(Ctx);
}
