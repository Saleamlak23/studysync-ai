import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-muted',
  ghost: 'bg-transparent text-fg-muted hover:bg-surface-muted hover:text-fg',
  danger: 'bg-danger text-white hover:brightness-95',
  ai: 'bg-ai text-white hover:bg-ai-hover',
} as const;

const sizes = {
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-sm md:h-10',
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-(--duration-fast) disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
