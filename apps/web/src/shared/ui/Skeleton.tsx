import clsx from 'clsx';
import type { HTMLAttributes } from 'react';

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={clsx('animate-pulse rounded-md bg-stone-100', className)}
      {...rest}
    />
  );
}
