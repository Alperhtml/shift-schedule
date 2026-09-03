import { useEffect } from 'react';
import { useStore } from '../../state/store';

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement
  && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

export function useKeyboardShortcuts(): void {
  const { dispatch } = useStore();
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);
}
