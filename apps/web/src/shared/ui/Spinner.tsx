import clsx from 'clsx';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={clsx('inline-flex', className)}>
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-fg-muted border-t-transparent"
      />
    </span>
  );
}
