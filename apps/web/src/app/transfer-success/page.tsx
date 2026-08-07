'use client';

import {
  Suspense,
} from 'react';

import Link from 'next/link';

import {
  useSearchParams,
} from 'next/navigation';

import {
  jsPDF,
} from 'jspdf';

function TransferSuccessContent() {
  const params =
    useSearchParams();

  const amount =
    params.get('amount') ??
    '0.00';

  const recipient =
    params.get('recipient') ??
    'Recipient';

  const email =
    params.get('email') ??
    '';

  const note =
    params.get('note') ??
    '';

  const transferId =
    params.get('transferId') ??
    'Unavailable';

  const status =
    params.get('status') ??
    'COMPLETED';

  const date =
    new Date().toLocaleString(
      'en-IN',
      {
        dateStyle:
          'medium',

        timeStyle:
          'short',
      },
    );

  function downloadReceipt():
    void {
    const document =
      new jsPDF();

    const formattedAmount =
      Number(
        amount,
      ).toLocaleString(
        'en-IN',
        {
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2,
        },
      );

    document.setFontSize(
      22,
    );

    document.text(
      'PAYFLOW',
      20,
      22,
    );

    document.setFontSize(
      12,
    );

    document.text(
      'Digital Wallet Transfer Receipt',
      20,
      31,
    );

    document.line(
      20,
      36,
      190,
      36,
    );

    document.setFontSize(
      20,
    );

    document.text(
      `INR ${formattedAmount}`,
      20,
      52,
    );

    document.setFontSize(
      12,
    );

    let y =
      70;

    const addRow = (
      label: string,
      value: string,
    ): void => {
      document.setFont(
        'helvetica',
        'bold',
      );

      document.text(
        label,
        20,
        y,
      );

      document.setFont(
        'helvetica',
        'normal',
      );

      const lines =
        document.splitTextToSize(
          value ||
          'N/A',
          110,
        );

      document.text(
        lines,
        70,
        y,
      );

      y +=
        Math.max(
          10,
          lines.length * 7,
        );
    };

    addRow(
      'Status',
      status,
    );

    addRow(
      'Recipient',
      recipient,
    );

    addRow(
      'Email',
      email,
    );

    addRow(
      'Note',
      note ||
      'No note added',
    );

    addRow(
      'Transfer ID',
      transferId,
    );

    addRow(
      'Date & Time',
      date,
    );

    addRow(
      'Payment Method',
      'Payflow Wallet',
    );

    document.line(
      20,
      y + 4,
      190,
      y + 4,
    );

    document.setFontSize(
      10,
    );

    document.text(
      'This is a computer-generated Payflow transaction receipt.',
      20,
      y + 16,
    );

    document.text(
      'Keep the Transfer ID for future reference.',
      20,
      y + 23,
    );

    const safeTransferId =
      transferId
        .replace(
          /[^a-zA-Z0-9-]/g,
          '',
        )
        .slice(
          0,
          30,
        );

    document.save(
      `payflow-receipt-${
        safeTransferId ||
        Date.now()
      }.pdf`,
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto max-w-xl">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl font-bold text-emerald-600">
              ✓
            </div>

            <h1 className="mt-5 text-3xl font-bold text-slate-900">
              Payment Successful
            </h1>

            <p className="mt-3 text-4xl font-bold text-sky-600">
              ₹
              {Number(
                amount,
              ).toLocaleString(
                'en-IN',
                {
                  minimumFractionDigits:
                    2,

                  maximumFractionDigits:
                    2,
                },
              )}
            </p>
          </div>

          <div className="mt-8 space-y-5 rounded-2xl bg-slate-50 p-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                To
              </p>

              <p className="mt-1 font-bold text-slate-900">
                {recipient}
              </p>

              <p className="text-sm text-slate-500">
                {email}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Status
              </p>

              <p className="mt-1 font-bold text-emerald-600">
                {status}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Note
              </p>

              <p className="mt-1 text-slate-700">
                {note || 'No note added'}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Transfer ID
              </p>

              <p className="mt-1 break-all text-sm font-semibold text-slate-700">
                {transferId}
              </p>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Date & Time
              </p>

              <p className="mt-1 text-slate-700">
                {date}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={downloadReceipt}
            className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-white transition hover:bg-emerald-600"
          >
            Download PDF Receipt
          </button>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/transactions"
              className="rounded-xl bg-sky-500 px-5 py-3 text-center font-bold text-white transition hover:bg-sky-600"
            >
              View Transactions
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function TransferSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-100 px-6 py-10">
          <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow">
            Loading receipt...
          </div>
        </main>
      }
    >
      <TransferSuccessContent />
    </Suspense>
  );
}