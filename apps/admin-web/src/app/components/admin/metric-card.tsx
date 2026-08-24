import type { ReactNode } from 'react';
import { Card } from '../ui';

export function MetricCard({
  label,
  value,
  description,
  valueClassName = '',
  icon,
}: {
  label: string;
  value: string;
  description: string;
  valueClassName?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </p>
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-600">
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={`mt-4 break-words text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 tabular-nums ${valueClassName}`}
      >
        {value}
      </p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </Card>
  );
}
