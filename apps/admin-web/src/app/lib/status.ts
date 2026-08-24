export function getStatusClasses(status: string): string {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
    case 'COMPLETED':
    case 'SUCCESS':
    case 'PUBLISHED':
    case 'SENT':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'PENDING':
    case 'UNDER_REVIEW':
    case 'SUSPENDED':
    case 'FROZEN':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'PROCESSING':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'FAILED':
    case 'BLOCKED':
    case 'REJECTED':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'REVERSED':
    case 'CLOSED':
    case 'REVOKED':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}
