'use client';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, PageContainer, PageHeader } from '../components/customer';
import { userAuthenticatedRequest } from '../lib/api';
import RecentRecipients from './RecentRecipients';

import { normalizeRecipientPhone } from '../lib/recipient-phone';

type Contact = { id: string; nickname?: string | null; favourite: boolean; recipient: { id: string; firstName: string; lastName?: string | null; vpa?: string | null } };
type Recipient = { userId: string; displayName?: string; vpa?: string };
export default function ContactsPage() {
  const [items, setItems] = useState<Contact[] | null>(null); const [search, setSearch] = useState(''); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { setError(''); try { setItems(await userAuthenticatedRequest(`/customer-features/contacts${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load contacts'); } }, [search]);
  useEffect(() => { void load(); }, [load]);
  async function add(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setSaving(true); setError(''); setMessage(''); try { const identifier = String(data.get('identifier') ?? '').trim(); const recipientPhone = normalizeRecipientPhone(identifier); const query = new URLSearchParams(recipientPhone ? { phone: recipientPhone } : identifier.includes('@') ? { vpa: identifier } : { email: identifier }); const result = await userAuthenticatedRequest<{ recipient: Recipient } | Recipient>(`/wallets/wallet-recipients/resolve?${query}`); const recipient = 'recipient' in result ? result.recipient : result; await userAuthenticatedRequest('/customer-features/contacts', { method: 'POST', body: JSON.stringify({ recipientUserId: recipient.userId, nickname: String(data.get('nickname') ?? '').trim() || undefined }) }); setMessage(`${recipient.displayName ?? 'Recipient'} added.`); form.reset(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to add contact'); } finally { setSaving(false); } }
  async function mutate(path: string, options: RequestInit) { setError(''); setMessage(''); try { await userAuthenticatedRequest(`/customer-features${path}`, options); setMessage('Contact updated.'); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update contact'); } }
  return <main><PageContainer><PageHeader eyebrow="People" title="Contacts and favourites" description="Recipients are verified before being added. Your contact list is private to your authenticated account." />
    <div aria-live="polite" className="mt-5">{message ? <p className="rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{message}</p> : null}{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}</div>
    <RecentRecipients /><div className="mt-7 grid gap-6 lg:grid-cols-[22rem_1fr]"><Card className="p-6"><h2 className="text-lg font-bold">Add contact</h2><form className="mt-5 space-y-4" onSubmit={(event) => void add(event)}><Field id="contact-identifier" name="identifier" label="Phone, email or Payflow VPA" required autoComplete="off" /><Field id="contact-nickname" name="nickname" label="Nickname (optional)" maxLength={80} /><Button type="submit" disabled={saving}>{saving ? 'Verifying…' : 'Verify and add'}</Button></form></Card>
      <section aria-labelledby="favourite-shortcuts" className="mb-6">
  <div className="flex items-center justify-between">
    <div>
      <h2 id="favourite-shortcuts" className="text-lg font-bold">
        Favourite shortcuts
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Pay your favourite recipients faster.
      </p>
    </div>
  </div>

  <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3">
    {items === null ? (
      <LoadingState />
    ) : items.filter((contact) => contact.favourite).length === 0 ? (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        Favourite a saved contact to create a quick-pay shortcut.
      </p>
    ) : (
      items
        .filter((contact) => contact.favourite)
        .map((contact) => {
          const name =
            contact.nickname ||
            [contact.recipient.firstName, contact.recipient.lastName]
              .filter(Boolean)
              .join(' ');

          return (
            <Link
              key={contact.id}
              href={
                contact.recipient.vpa
                  ? `/send-money?vpa=${encodeURIComponent(
                      contact.recipient.vpa,
                    )}`
                  : '/send-money'
              }
              className="min-w-40 snap-start touch-manipulation rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:min-w-44"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                {name.slice(0, 1).toUpperCase()}
              </div>
              <p className="mt-3 truncate font-bold text-slate-900">
                {name}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">
                {contact.recipient.vpa ?? 'Verified recipient'}
              </p>
              <p className="mt-3 text-sm font-semibold text-sky-600">
                Pay →
              </p>
            </Link>
          );
        })
    )}
  </div>
</section>
<section aria-labelledby="contacts-list"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h2 id="contacts-list" className="text-lg font-bold">Saved contacts</h2><form onSubmit={(event) => { event.preventDefault(); void load(); }} className="flex flex-col gap-2 sm:flex-row"><Field id="contact-search" aria-label="Search contacts" label="Search" value={search} onChange={(event) => setSearch(event.target.value)} /><Button type="submit" variant="secondary" className="w-full sm:w-auto">Search</Button></form></div><div className="mt-4 space-y-3">{items === null ? <LoadingState /> : items.length === 0 ? <EmptyState title="No contacts found" description="Add a verified Payflow recipient to get started." /> : items.map((item) => <ContactCard key={item.id} item={item} mutate={mutate} />)}</div></section></div>
  </PageContainer></main>;
}
function ContactCard({ item, mutate }: { item: Contact; mutate: (path: string, options: RequestInit) => Promise<void> }) {
  const [nickname, setNickname] = useState(item.nickname ?? ''); const name = item.nickname || [item.recipient.firstName, item.recipient.lastName].filter(Boolean).join(' ');
  return <Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-bold">{name}</h3><p className="text-sm text-slate-600">{item.recipient.vpa ?? 'Verified Payflow recipient'}</p></div><div className="flex flex-wrap gap-2">
  {item.recipient.vpa ? (
    <Link
      href={`/send-money?vpa=${encodeURIComponent(item.recipient.vpa)}`}
      className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 sm:w-auto"
    >
      Pay
    </Link>
  ) : null}
  <Button
    variant="secondary"
    onClick={() =>
      void mutate(`/contacts/${item.id}/favourite`, {
        method: item.favourite ? 'DELETE' : 'POST',
      })
    }
  >
    {item.favourite ? 'Unfavourite' : 'Favourite'}
  </Button>
  <Button
    variant="danger"
    onClick={() =>
      void mutate(`/contacts/${item.id}`, { method: 'DELETE' })
    }
  >
    Delete
  </Button>
</div></div><form className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); void mutate(`/contacts/${item.id}`, { method: 'PATCH', body: JSON.stringify({ nickname }) }); }}><Field id={`nickname-${item.id}`} label="Nickname" value={nickname} maxLength={80} onChange={(event) => setNickname(event.target.value)} /><Button type="submit" variant="secondary">Save nickname</Button></form></Card>;
}
