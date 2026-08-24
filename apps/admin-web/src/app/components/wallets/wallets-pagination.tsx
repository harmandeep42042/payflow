import { Button } from '../ui';

export function WalletsPagination({ page, totalPages, total, start, end, hasPrevious, hasNext, disabled, onPage }: {
  page: number; totalPages: number; total: number; start: number; end: number;
  hasPrevious: boolean; hasNext: boolean; disabled: boolean; onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:px-6">
      <p className="text-sm text-slate-500 tabular-nums">
        {total ? `Showing ${start}–${end} of ${total}` : 'No results'} · Page {page} of {totalPages || 1}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={disabled || !hasPrevious} onClick={() => onPage(Math.max(1, page - 1))}>Previous</Button>
        <Button variant="secondary" disabled={disabled || !hasNext} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
