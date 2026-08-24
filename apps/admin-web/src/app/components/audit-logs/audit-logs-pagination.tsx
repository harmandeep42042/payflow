import { Button } from '../ui';

export function AuditLogsPagination(props: {
  page: number; totalPages: number; total: number; start: number; end: number;
  hasPrevious: boolean; hasNext: boolean; disabled: boolean; onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:px-6">
      <p className="text-sm text-slate-500 tabular-nums">{props.total ? `Showing ${props.start}–${props.end} of ${props.total}` : 'No results'} · Page {props.page} of {props.totalPages || 1}</p>
      <div className="flex gap-2"><Button variant="secondary" disabled={props.disabled || !props.hasPrevious} onClick={() => props.onPage(Math.max(1, props.page - 1))}>Previous</Button><Button variant="secondary" disabled={props.disabled || !props.hasNext} onClick={() => props.onPage(props.page + 1)}>Next</Button></div>
    </div>
  );
}
