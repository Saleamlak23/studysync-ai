import clsx from 'clsx';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
} as const;

export type AvatarSize = keyof typeof sizes;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function Avatar({
  name,
  src,
  alt,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  alt?: string;
  size?: AvatarSize;
  className?: string;
}) {
  const label = alt ?? name;

  if (src) {
    return (
      <img
        src={src}
        alt={label}
        className={clsx('shrink-0 rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-label={label}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
