import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

const variants = {
  tile: 'rounded-md border border-line bg-surface p-3 shadow-sm hover:border-line-strong',
  panel: 'rounded-lg border border-line bg-surface p-4',
} as const;

export type CardVariant = keyof typeof variants;

export function Card({
  variant = 'panel',
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return <div className={clsx(variants[variant], className)} {...rest} />;
}
