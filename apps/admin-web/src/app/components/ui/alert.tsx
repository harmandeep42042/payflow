import type { ReactNode } from 'react';

export function Alert({
  children,
  title = 'Something went wrong',
  action,
}: {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
      {action}
    </div>
  );
}
