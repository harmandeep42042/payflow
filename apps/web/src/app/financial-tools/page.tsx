'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
  StatusBadge,
} from '../components/customer';
import { userAuthenticatedRequest } from '../lib/api';
import { formatMoney } from '../lib/money';

type VpaState = { vpa: string | null; providerState: string };
type Bank = {
  id: string;
  bankName: string;
  accountHolderName: string;
  maskedAccountNumber: string;
  ifsc: string;
  status: string;
  isPrimary: boolean;
};
type Method = {
  id: string;
  type: string;
  label: string;
  maskedIdentifier: string;
  status: string;
  isDefault: boolean;
};
type Providers = Record<string, string>;
type StatementGroup = {
  currency: string;
  openingBalance: string;
  credits: string;
  debits: string;
  closingBalance: string;
  transactions: Array<{
    id: string;
    createdAt: string;
    type: string;
    credit: string;
    debit: string;
    balance: string;
  }>;
};
type Statement = {
  from: string;
  to: string;
  currencies: StatementGroup[];
  csv: string;
};
type Template={id:string;name:string;destinationRef:string;maskedDestination:string;amount:string|null;currency:string;note:string|null};
type Schedule={id:string;status:string;frequency:string;startAt:string;endAt:string|null;nextRunAt:string;template:Template;executions:Array<{id:string;status:string;scheduledFor:string;attemptedAt:string|null;failureCode:string|null}>};

export default function FinancialToolsPage() {
  const [vpa, setVpa] = useState<VpaState | null>(null);
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [methods, setMethods] = useState<Method[] | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [templates,setTemplates]=useState<Template[]>([]);
  const [schedules,setSchedules]=useState<Schedule[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [statement, setStatement] = useState<Statement | null>(null);
  const load = useCallback(async () => {
    setError('');
    try {
      const [identity, linked, paymentMethods, states,savedTemplates,recurring] = await Promise.all([
        userAuthenticatedRequest<VpaState>('/customer-features/upi/identity'),
        userAuthenticatedRequest<Bank[]>('/customer-features/bank-accounts'),
        userAuthenticatedRequest<Method[]>(
          '/customer-features/payment-methods',
        ),
        userAuthenticatedRequest<Providers>(
          '/customer-features/regulated/providers',
        ),
        userAuthenticatedRequest<Template[]>('/customer-features/payment-templates'),
        userAuthenticatedRequest<Schedule[]>('/customer-features/recurring-payments'),
      ]);
      setVpa(identity);
      setBanks(linked);
      setMethods(paymentMethods);
      setProviders(states);
      setTemplates(savedTemplates);setSchedules(recurring);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to load payment setup',
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function submit(path: string, body: unknown, method = 'POST') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await userAuthenticatedRequest(path, {
        method,
        body: JSON.stringify(body),
      });
      setNotice(
        'Saved. Provider-dependent activation remains blocked until an approved provider is configured.',
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save');
    } finally {
      setBusy(false);
    }
  }
  async function saveVpa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit(
      '/customer-features/upi/identity',
      { vpa: data.get('vpa') },
      'PATCH',
    );
  }
  async function linkBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit('/customer-features/bank-accounts', {
      bankName: data.get('bankName'),
      accountHolderName: data.get('accountHolderName'),
      accountNumber: data.get('accountNumber'),
      ifsc: data.get('ifsc'),
      isPrimary: data.get('isPrimary') === 'on',
    });
    event.currentTarget.reset();
  }
  async function getStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      setStatement(
        await userAuthenticatedRequest<Statement>(
          `/customer-features/statements?from=${encodeURIComponent(String(data.get('from')))}&to=${encodeURIComponent(String(data.get('to')))}`,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Unable to create statement',
      );
    } finally {
      setBusy(false);
    }
  }
  function downloadCsv() {
    if (!statement) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(
      new Blob([statement.csv], { type: 'text/csv;charset=utf-8' }),
    );
    link.download = 'payflow-statement.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }
  async function downloadPdf(){if(!statement)return;const[{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);const doc=new jsPDF();doc.setFontSize(16);doc.text('Payflow account statement',14,16);doc.setFontSize(10);doc.text(`${new Date(statement.from).toLocaleDateString()} - ${new Date(statement.to).toLocaleDateString()}`,14,23);let y=30;for(const group of statement.currencies){doc.setFontSize(11);doc.text(`${group.currency} | Opening ${group.openingBalance} | Credits ${group.credits} | Debits ${group.debits} | Closing ${group.closingBalance}`,14,y);autoTable(doc,{startY:y+4,head:[['Date','Type','Reference','Credit','Debit','Balance']],body:group.transactions.map(row=>[new Date(row.createdAt).toLocaleString(),row.type,row.id,row.credit,row.debit,row.balance]),styles:{fontSize:8},columnStyles:{2:{cellWidth:45}}});y=(doc as typeof doc&{lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??y+20;if(y>250){doc.addPage();y=20}else y+=10;}doc.save('payflow-statement.pdf');}
  async function createTemplate(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);await submit('/customer-features/payment-templates',{name:data.get('name'),destinationRef:data.get('destinationRef'),maskedDestination:data.get('maskedDestination'),amount:data.get('amount')||undefined,currency:data.get('currency'),note:data.get('note')||undefined});form.reset();}
  async function createSchedule(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);await submit('/customer-features/recurring-payments',{templateId:data.get('templateId'),frequency:data.get('frequency'),startAt:new Date(String(data.get('startAt'))).toISOString(),endAt:data.get('endAt')?new Date(String(data.get('endAt'))).toISOString():undefined,idempotencyKey:`recurring:${crypto.randomUUID()}`});form.reset();}
  if (!vpa && !banks && !methods && !error)
    return (
      <main>
        <PageContainer>
          <LoadingState label="Loading payment setup" />
        </PageContainer>
      </main>
    );
  return (
    <main>
      <PageContainer>
        <PageHeader
          eyebrow="Payments"
          title="Payment setup and statements"
          description="Local account records are safe and ownership-protected. UPI rails, bank verification, card tokenization and recurring debits remain unavailable until approved providers are configured."
          actions={
            <button
              type="button"
              onClick={() => void load()}
              className="min-h-11 rounded-xl border px-4 font-bold"
            >
              Refresh
            </button>
          }
        />
        <div aria-live="polite" className="mt-5">
          {error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : notice ? (
            <p
              role="status"
              className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900"
            >
              {notice}
            </p>
          ) : null}
        </div>
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-bold">Provider readiness</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(providers ?? {}).map(([name, status]) => (
              <div key={name} className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold">
                  {name.replace(/([A-Z])/g, ' $1')}
                </p>
                <p className="mt-2 text-sm text-amber-800">{status}</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-lg font-bold">Payflow VPA</h2>
            <p className="mt-2 text-sm text-slate-600">
              Current: {vpa?.vpa ?? 'Not set'} ·{' '}
              <StatusBadge status="EXTERNAL PROVIDER REQUIRED" />
            </p>
            <form
              onSubmit={saveVpa}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <label className="flex-1 text-sm font-semibold">
                VPA
                <input
                  name="vpa"
                  required
                  defaultValue={vpa?.vpa ?? ''}
                  placeholder="yourname@payflow"
                  className="mt-2 min-h-11 w-full rounded-xl border px-3"
                />
              </label>
              <button
                disabled={busy}
                className="min-h-11 self-end rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50"
              >
                Save VPA
              </button>
            </form>
          </Card>
          <Card className="p-5">
            <h2 className="text-lg font-bold">Linked bank records</h2>
            <p className="mt-2 text-sm text-slate-600">
              Account numbers are accepted only for one-way masking and
              duplicate detection; verification remains provider-blocked.
            </p>
            <form
              onSubmit={linkBank}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <Field name="bankName" label="Bank name" />
              <Field name="accountHolderName" label="Account holder" />
              <Field
                name="accountNumber"
                label="Account number"
                type="password"
                inputMode="numeric"
              />
              <Field name="ifsc" label="IFSC" />
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="isPrimary" />
                Primary record
              </label>
              <button
                disabled={busy}
                className="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white disabled:opacity-50"
              >
                Link record
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {banks?.length ? (
                banks.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <span>
                      <strong>{item.bankName}</strong>
                      <br />
                      <span className="text-sm">
                        {item.maskedAccountNumber} · {item.status}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void submit(
                          `/customer-features/bank-accounts/${item.id}`,
                          undefined,
                          'DELETE',
                        )
                      }
                      className="min-h-11 px-3 font-bold text-red-700"
                    >
                      Unlink
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No bank records"
                  description="Add a record when you are ready."
                />
              )}
            </div>
          </Card>
        </div>
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-bold">Payment methods</h2>
          <p className="mt-2 text-sm text-slate-600">
            Only provider-tokenized methods can be activated. Payflow does not
            collect full card numbers or CVV here.
          </p>
          {methods?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {methods.map((item) => (
                <div key={item.id} className="rounded-xl bg-slate-50 p-4">
                  <strong>{item.label}</strong>
                  <p className="text-sm">
                    {item.maskedIdentifier} · {item.status}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No tokenized methods"
                description="An approved tokenization provider is required before a method can be added."
              />
            </div>
          )}
        </Card>
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-bold">Account statement</h2>
          <form
            onSubmit={getStatement}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <Field name="from" label="From" type="date" />
            <Field name="to" label="To" type="date" />
            <button
              disabled={busy}
              className="min-h-11 self-end rounded-xl bg-slate-950 px-5 font-bold text-white disabled:opacity-50"
            >
              Generate
            </button>
          </form>
          {statement ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={downloadCsv}
                className="min-h-11 rounded-xl border px-4 font-bold"
              >
                Download CSV
              </button>
              <button type="button" onClick={()=>void downloadPdf()} className="ml-2 min-h-11 rounded-xl border px-4 font-bold">Download PDF</button>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {statement.currencies.map((group) => (
                  <div
                    key={group.currency}
                    className="rounded-xl bg-slate-50 p-4"
                  >
                    <h3 className="font-bold">{group.currency}</h3>
                    <p className="mt-2 text-sm">
                      Opening{' '}
                      {formatMoney(group.openingBalance, group.currency)} ·
                      Credits {formatMoney(group.credits, group.currency)} ·
                      Debits {formatMoney(group.debits, group.currency)} ·
                      Closing{' '}
                      {formatMoney(group.closingBalance, group.currency)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {group.transactions.length} transaction(s)
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
        <Card className="mt-6 p-5"><h2 className="text-lg font-bold">Saved payment templates</h2><form onSubmit={createTemplate} className="mt-4 grid gap-3 sm:grid-cols-2"><Field name="name" label="Template name"/><Field name="destinationRef" label="Destination reference"/><Field name="maskedDestination" label="Masked destination"/><Field name="amount" label="Optional amount"/><Field name="currency" label="Currency"/><Field name="note" label="Note"/><button disabled={busy} className="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white">Save template</button></form><div className="mt-4 space-y-2">{templates.length?templates.map(item=><div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><span><strong>{item.name}</strong><br/><span className="text-sm">{item.maskedDestination} · {item.currency} {item.amount??'variable'}</span></span><button type="button" className="min-h-11 px-3 font-bold text-red-700" onClick={()=>void submit(`/customer-features/payment-templates/${item.id}`,undefined,'DELETE')}>Delete</button></div>):<EmptyState title="No templates" description="Save a destination without storing sensitive payment credentials."/>}</div></Card>
        <Card className="mt-6 p-5"><h2 className="text-lg font-bold">Recurring schedules</h2><p className="mt-2 text-sm text-amber-800">Automatic debit remains PROVIDER_BLOCKED. Schedules are planning records only.</p><form onSubmit={createSchedule} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Template<select required name="templateId" className="mt-2 min-h-11 w-full rounded-xl border px-3"><option value="">Choose template</option>{templates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Frequency<select name="frequency" className="mt-2 min-h-11 w-full rounded-xl border px-3">{['DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY'].map(value=><option key={value}>{value}</option>)}</select></label><Field name="startAt" label="Start" type="datetime-local"/><label className="text-sm font-semibold">Optional end<input name="endAt" type="datetime-local" className="mt-2 min-h-11 w-full rounded-xl border px-3"/></label><button disabled={busy||!templates.length} className="min-h-11 rounded-xl bg-blue-700 px-5 font-bold text-white">Create blocked schedule</button></form><div className="mt-4 space-y-3">{schedules.map(item=><div key={item.id} className="rounded-xl bg-slate-50 p-4"><strong>{item.template.name} · {item.frequency}</strong><p className="mt-1 text-sm">{item.status} · next {new Date(item.nextRunAt).toLocaleString()}</p><div className="mt-2 flex flex-wrap gap-2">{(['pause','resume','cancel'] as const).map(action=><button key={action} type="button" className="min-h-11 rounded-lg border px-3 font-semibold" onClick={()=>void submit(`/customer-features/recurring-payments/${item.id}/${action}`,{})}>{action}</button>)}</div><p className="mt-2 text-xs text-slate-600">Execution history: {item.executions.length?item.executions.map(run=>`${run.status} ${new Date(run.scheduledFor).toLocaleDateString()}${run.failureCode?` (${run.failureCode})`:''}`).join(', '):'No executions; provider authorization is absent.'}</p></div>)}</div></Card>
      </PageContainer>
    </main>
  );
}

function Field({
  name,
  label,
  type = 'text',
  inputMode,
}: {
  name: string;
  label: string;
  type?: string;
  inputMode?: 'numeric';
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        inputMode={inputMode}
        required
        autoComplete="off"
        className="mt-2 min-h-11 w-full rounded-xl border px-3"
      />
    </label>
  );
}
