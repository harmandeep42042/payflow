import { Button } from '../ui';
import { actionLabel, actionTone, formatAuditDate, truncateAuditText } from './helpers';
import type { AuditLogItem } from './types';

const tones = {
  danger: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};
export function AuditActionBadge({ action }: { action: string }) {
  const tone = actionTone(action);
  return <span title={tone === 'neutral' ? action : undefined} className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{actionLabel(action)}</span>;
}

export function AuditLogsTable(props: {
  logs: AuditLogItem[]; initialLoading: boolean; filtered: boolean;
  onDetails: (log: AuditLogItem, trigger: HTMLButtonElement) => void; onClear: () => void;
}) {
  const skeletonRows = Array.from({ length: 5 }, (_, index) => index);
  return (
    <div className="overflow-x-auto">
      <table aria-busy={props.initialLoading} className="min-w-[64rem] w-full text-left text-sm">
        <caption className="sr-only">Administration security and compliance audit events</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Timestamp', 'Action', 'Actor', 'Target', 'Description', 'Details'].map((heading) => <th key={heading} scope="col" className="px-4 py-3 font-semibold sm:px-5">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {props.initialLoading ? skeletonRows.map((row) => <tr key={row} aria-hidden="true">{Array.from({ length: 6 }, (_, cell) => <td key={cell} className="px-4 py-4 sm:px-5"><span className="block h-4 animate-pulse rounded bg-slate-200" /></td>)}</tr>) : null}
          {!props.initialLoading && props.logs.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center"><p className="font-medium text-slate-800">{props.filtered ? 'No audit logs match these filters' : 'No audit logs available'}</p><p className="mt-1 text-sm text-slate-500">{props.filtered ? 'Clear or adjust the exact-match filters.' : 'Administrative events will appear here when recorded.'}</p>{props.filtered ? <Button className="mt-4" size="sm" variant="secondary" onClick={props.onClear}>Clear filters</Button> : null}</td></tr> : null}
          {!props.initialLoading ? props.logs.map((log) => <tr key={log.id} className="align-top hover:bg-slate-50">
            <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600 tabular-nums sm:px-5">{formatAuditDate(log.createdAt)}</td>
            <td className="px-4 py-4 sm:px-5"><AuditActionBadge action={log.action} /></td>
            <td className="max-w-56 px-4 py-4 sm:px-5"><p className="break-all font-medium text-slate-900">{log.actorEmail ?? log.actorUserId ?? 'System/Unknown'}</p>{log.actorEmail && log.actorUserId ? <p className="mt-1 break-all text-xs text-slate-500">{log.actorUserId}</p> : null}</td>
            <td className="max-w-52 px-4 py-4 sm:px-5"><p className="font-medium text-slate-800">{log.targetType}</p><p className="mt-1 break-all text-xs text-slate-500">{log.targetId ?? 'No target ID'}</p></td>
            <td className="max-w-sm px-4 py-4 text-slate-600 sm:px-5">{truncateAuditText(log.description)}</td>
            <td className="px-4 py-4 sm:px-5"><Button size="sm" variant="secondary" aria-label={`View details for audit log ${log.id}`} onClick={(event) => props.onDetails(log, event.currentTarget)}>Details</Button></td>
          </tr>) : null}
        </tbody>
      </table>
    </div>
  );
}
