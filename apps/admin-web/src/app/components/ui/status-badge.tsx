import { getStatusClasses } from '../../lib/status';

export function StatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(status)} ${className}`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
