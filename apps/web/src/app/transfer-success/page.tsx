import Link from 'next/link';

export default function TransferResultPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-3xl font-bold text-sky-700" aria-hidden="true">✓</div>
            <h1 className="mt-5 text-3xl font-bold text-slate-900">Transfer submitted</h1>
            <p className="mt-3 text-slate-600">
              This page is not a payment receipt and does not independently confirm settlement.
              Check your transaction history for the authoritative amount, recipient, reference, and status.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href="/transactions" className="rounded-xl bg-sky-500 px-5 py-3 text-center font-bold text-white transition hover:bg-sky-600">
              Verify transaction
            </Link>
            <Link href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50">
              Back to Dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
