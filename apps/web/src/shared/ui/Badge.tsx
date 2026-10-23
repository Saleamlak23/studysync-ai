import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

const variants = {
  default: 'bg-surface-muted text-fg-muted',
  primary: 'bg-primary-soft text-primary',
  ai: 'bg-ai-soft text-ai',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
} as const;

export type BadgeVariant = keyof typeof variants;

export function Badge({
  variant = 'default',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...rest}
    />
  );
}
