'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, PageContainer, PageHeader, SelectField, StatusBadge } from '../components/customer';
import { userAuthenticatedRequest } from '../lib/api';
import { getPaymentHelpTransactionId } from './payment-help-deeplink';
type Case = { id: string; category: string; description: string; status: string; resolution?: string | null };
export default function HelpPage() {
  const [
    paymentHelpTransactionId,
    setPaymentHelpTransactionId,
  ] = useState('');

  useEffect(() => {
    const transactionId =
      getPaymentHelpTransactionId(
        new URLSearchParams(
          window.location.search,
        ),
      );

    if (!transactionId) {
      return;
    }

    setPaymentHelpTransactionId(
      transactionId,
    );
  }, []);
  const [cases, setCases] = useState<Case[] | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { try { setCases(await userAuthenticatedRequest('/customer-features/support-cases')); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load cases'); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(''); const form = event.currentTarget; const data = new FormData(form); try { const created = await userAuthenticatedRequest<Case>('/customer-features/support-cases', { method: 'POST', body: JSON.stringify({ category: data.get('category'), transactionId: data.get('transactionId') || undefined, description: data.get('description') }) }); setMessage(`Case ${created.id} was created.`); form.reset(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Case creation failed'); } finally { setSaving(false); } }
  return <main><PageContainer className="max-w-5xl"><PageHeader eyebrow="Support" title="Help and disputes" description="Create a traceable support case. Only your own cases and transactions are accessible." /><div aria-live="polite" className="mt-5">{message ? <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p> : null}{error ? <ErrorState message={error} /> : null}</div><div className="mt-7 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"><Card className="p-6"><h2 className="text-lg font-bold">Report an issue</h2>
<p className="mt-2 text-sm leading-6 text-slate-600">
  A transaction ID may be prefilled from your receipt. Review the issue, describe what happened, and press Create case yourself. Opening this page never creates a support case automatically.
</p><form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}><SelectField id="case-category" name="category" label="Issue"><option value="PAYMENT">Payment problem</option><option value="UNRECOGNIZED">Unrecognized transaction</option><option value="TRANSFER">Transfer problem</option><option value="OTHER">Other</option></SelectField><Field
  id="case-transaction"
  name="transactionId"
  label="Transaction ID (optional)"
  placeholder="UUID from transaction details"
  value={paymentHelpTransactionId}
  onChange={(event) =>
    setPaymentHelpTransactionId(
      event.target.value,
    )
  }
/><div><label htmlFor="case-description" className="block text-sm font-semibold text-slate-800">Description</label><textarea id="case-description" name="description" required maxLength={2000} className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" /></div><Button type="submit" disabled={saving}>{saving ? 'Creating case…' : 'Create case'}</Button></form></Card><section aria-labelledby="case-history"><h2 id="case-history" className="text-lg font-bold">Your cases</h2><div className="mt-4 space-y-3">{cases === null ? <LoadingState /> : cases.length === 0 ? <EmptyState title="No support cases" description="Cases you create will be tracked here." /> : cases.map((item) => <Card key={item.id} className="p-5"><div className="flex justify-between gap-3"><p className="break-all font-mono text-xs">{item.id}</p><StatusBadge status={item.status} /></div><h3 className="mt-3 font-bold">{item.category}</h3><p className="mt-2 text-sm text-slate-600">{item.description}</p>{item.resolution ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><strong>Resolution:</strong> {item.resolution}</p> : null}</Card>)}</div></section></div></PageContainer></main>;
}
