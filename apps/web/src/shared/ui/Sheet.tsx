import clsx from 'clsx';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalFocus } from './useModalFocus.js';

export type SheetSide = 'right' | 'bottom';

export function Sheet({
  open,
  onOpenChange,
  title,
  side = 'right',
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: SheetSide;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(open, panelRef, onOpenChange);

  if (!open) return null;

  const panelPosition =
    side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-xl'
      : 'inset-y-0 right-0 h-full w-full max-w-md border-l border-line';

  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close sheet backdrop"
        className="absolute inset-0 bg-stone-900/40"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'absolute z-10 flex flex-col bg-surface p-4 shadow-lg',
          panelPosition,
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-fg">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
            onClick={() => onOpenChange(false)}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
