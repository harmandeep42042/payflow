'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, ErrorState, LoadingState, PageContainer, PageHeader, SelectField, StatusBadge } from '../components/customer';
import { getStoredUser, userAuthenticatedRequest } from '../lib/api';
import { beginLatestRequest, isLatestRequest, type ActiveRequest } from '../lib/request-sequencing';

type Wallet = { id: string; currency: string; status: string };
type QrResponse = {
  qr: { payload: string; dataUrl: string };
  recipient: { displayName: string; vpa: string; email: string; currency: string; walletStatus: string };
};

export default function ReceivePage() {
  const router = useRouter();
  const requestRef = useRef<ActiveRequest | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [currency, setCurrency] = useState('');
  const [details, setDetails] = useState<QrResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const selectedWallet = wallets.find((wallet) => wallet.currency === currency) ?? null;

  async function copyPaymentAddress(): Promise<void> {
    if (!details?.recipient.vpa) return;
    try {
      await navigator.clipboard.writeText(details.recipient.vpa);
      setCopyMessage('Payment address copied');
    } catch {
      setCopyMessage('Copy failed. Select and copy the address manually.');
    }
  }

  const loadWallets = useCallback(async () => {
    const user = getStoredUser();
    if (!user) { router.replace('/login'); return; }
    try {
      const response = await userAuthenticatedRequest<Wallet[] | { wallets?: Wallet[] }>(`/wallets/user/${user.id}`);
      const available = Array.isArray(response) ? response : response.wallets ?? [];
      const active = available.filter((wallet) => wallet.status === 'ACTIVE');
      setWallets(active);
      setCurrency((current) => current || active[0]?.currency || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load wallets');
    } finally { setIsLoading(false); }
  }, [router]);

  const loadQr = useCallback(async (selectedCurrency: string) => {
    if (!selectedCurrency) return;
    const request = beginLatestRequest(requestRef);
    try {
      setIsLoading(true); setError('');
      const response = await userAuthenticatedRequest<QrResponse>(`/wallet-qr/my?currency=${encodeURIComponent(selectedCurrency)}`, { signal: request.controller.signal });
      if (isLatestRequest(requestRef, request)) setDetails(response);
    } catch (requestError) {
      if (isLatestRequest(requestRef, request)) setError(requestError instanceof Error ? requestError.message : 'Unable to generate payment QR');
    } finally { if (requestRef.current?.id === request.id) setIsLoading(false); }
  }, []);

  useEffect(() => { void loadWallets(); }, [loadWallets]);
  useEffect(() => { if (currency) void loadQr(currency); return () => requestRef.current?.controller.abort(); }, [currency, loadQr]);

  return <main><PageContainer className="max-w-3xl"><PageHeader eyebrow="Receive" title="Receive money" description="Share this Payflow payment address or QR for the selected wallet currency." />
    {wallets.length > 1 ? <div className="mt-7 max-w-xs"><SelectField id="receive-currency" label="Wallet currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{wallets.map((wallet) => <option key={wallet.id} value={wallet.currency}>{wallet.currency}</option>)}</SelectField></div> : null}
    {error ? <div className="mt-6"><ErrorState message={error} onRetry={() => void (currency ? loadQr(currency) : loadWallets())} /></div> : null}
    {isLoading ? <LoadingState label="Preparing payment QR" /> : !details ? <div className="mt-7"><EmptyState title="No active wallet available" description="An active wallet is required before you can receive money." /></div> : <section className="mt-7 grid min-w-0 gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[minmax(0,280px)_1fr] sm:p-7"><div className="mx-auto w-full max-w-[280px] rounded-2xl border border-slate-200 bg-white p-3"><Image src={details.qr.dataUrl} alt={`Payflow QR for ${details.recipient.vpa}`} width={400} height={400} className="h-auto w-full" unoptimized /></div><div className="min-w-0 self-center"><p className="text-sm font-semibold text-slate-500">Receive as</p><h2 className="mt-1 break-words text-2xl font-bold text-slate-950">{details.recipient.displayName || details.recipient.email}</h2><p className="mt-5 text-sm font-semibold text-slate-500">Payment address</p><p className="mt-1 break-all text-lg font-bold text-blue-700">{details.recipient.vpa}</p><Button type="button" variant="secondary" className="mt-3 w-full sm:w-auto" onClick={() => void copyPaymentAddress()}>Copy payment address</Button><p aria-live="polite" className="mt-2 min-h-5 text-xs font-medium text-slate-600">{copyMessage}</p><p className="mt-4 text-sm font-semibold text-slate-500">Wallet</p><p className="mt-1 break-all font-mono text-sm text-slate-800">{selectedWallet?.id ?? 'Unavailable'}</p><p className="mt-5 text-sm font-semibold text-slate-500">Wallet currency</p><p className="mt-1 text-xl font-bold text-slate-950">{details.recipient.currency}</p><div className="mt-4"><StatusBadge status={details.recipient.walletStatus} /></div><p className="mt-5 text-xs leading-5 text-slate-500">Only request payments in the currency shown. Payflow does not perform currency conversion here.</p></div></section>}
  </PageContainer></main>;
}
