import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

export function Input({
  label,
  error,
  id,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const inputId = id ?? rest.name;
  const errId = inputId ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error && errId ? errId : undefined}
        className={clsx(
          'h-11 rounded-md border bg-surface px-3 text-sm text-fg placeholder:text-fg-faint md:h-10',
          error ? 'border-danger' : 'border-line-strong focus:border-primary',
          className,
        )}
        {...rest}
      />
      {error && errId && (
        <p id={errId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
