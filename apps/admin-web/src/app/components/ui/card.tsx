import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={`rounded-lg border border-slate-200 bg-white ${className}`}
      {...props}
    />
  );
}
