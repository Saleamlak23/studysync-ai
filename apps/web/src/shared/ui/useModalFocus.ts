import { useEffect, useRef, type RefObject } from 'react';

const activeModalStack: symbol[] = [];

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onOpenChange: (open: boolean) => void,
) {
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const modalId = Symbol('modal');
    activeModalStack.push(modalId);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (activeModalStack.at(-1) !== modalId) return;

      if (event.key === 'Escape') {
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => element.getAttribute('aria-hidden') !== 'true' && !element.closest('[hidden]'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        panel.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const modalIndex = activeModalStack.lastIndexOf(modalId);
      if (modalIndex >= 0) activeModalStack.splice(modalIndex, 1);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, panelRef]);
}
