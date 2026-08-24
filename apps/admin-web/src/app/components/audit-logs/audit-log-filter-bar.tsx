import type { FormEvent } from 'react';
import { Button, Field, Input, Label, Select } from '../ui';
import { AUDIT_PAGE_SIZES } from './helpers';

export function AuditLogFilterBar(props: {
  actionInput: string; targetType: string; actorInput: string; limit: number;
  activeCount: number; disabled: boolean;
  onActionInput: (value: string) => void; onTargetType: (value: string) => void;
  onActorInput: (value: string) => void; onLimit: (value: number) => void;
  onApply: () => void; onClear: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); props.onApply(); }
  return (
    <section aria-labelledby="audit-filters-title" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between"><h2 id="audit-filters-title" className="text-sm font-semibold text-slate-900">Filters</h2><span className="text-xs text-slate-500">{props.activeCount} active</span></div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_minmax(14rem,1fr)_8rem_auto_auto] xl:items-end">
        <Field hint="Exact action name, for example BLOCK_USER"><Label htmlFor="audit-action">Action</Label><Input id="audit-action" value={props.actionInput} onChange={(event) => props.onActionInput(event.target.value)} placeholder="Exact action" /></Field>
        <Field><Label htmlFor="audit-target">Target type</Label><Select id="audit-target" value={props.targetType} onChange={(event) => props.onTargetType(event.target.value)}><option value="ALL">All targets</option><option value="USER">User</option><option value="WALLET">Wallet</option><option value="TRANSACTION">Transaction</option></Select></Field>
        <Field hint="Exact actor user ID"><Label htmlFor="audit-actor">Actor user ID</Label><Input id="audit-actor" value={props.actorInput} onChange={(event) => props.onActorInput(event.target.value)} placeholder="Exact user ID" /></Field>
        <Field><Label htmlFor="audit-limit">Rows</Label><Select id="audit-limit" value={props.limit} onChange={(event) => props.onLimit(Number(event.target.value))}>{AUDIT_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</Select></Field>
        <Button type="submit" disabled={props.disabled}>Apply</Button>
        <Button variant="secondary" disabled={props.disabled || props.activeCount === 0} onClick={props.onClear}>Clear</Button>
      </form>
    </section>
  );
}
