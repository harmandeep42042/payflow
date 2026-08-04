'use client';

import {
  FormEvent,
} from 'react';

export type WalletActionType =
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'TRANSFER';

type Wallet = {
  id: string;
  currency: string;
};

type WalletActionsProps = {
  selectedWallet: Wallet;

  activeAction: WalletActionType;
  amount: string;
  reference: string;
  destinationWalletId: string;
  description: string;

  isLoading: boolean;

  onActionChange: (
    action: WalletActionType,
  ) => void;

  onAmountChange: (
    value: string,
  ) => void;

  onReferenceChange: (
    value: string,
  ) => void;

  onDestinationWalletChange: (
    value: string,
  ) => void;

  onDescriptionChange: (
    value: string,
  ) => void;

  onSubmit: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
};

export default function WalletActions({
  selectedWallet,
  activeAction,
  amount,
  reference,
  destinationWalletId,
  description,
  isLoading,
  onActionChange,
  onAmountChange,
  onReferenceChange,
  onDestinationWalletChange,
  onDescriptionChange,
  onSubmit,
}: WalletActionsProps) {
  const actions: WalletActionType[] = [
    'DEPOSIT',
    'WITHDRAW',
    'TRANSFER',
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-900">
            Wallet actions
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Selected wallet:{' '}
            {selectedWallet.id.slice(0, 8)}
          </p>
        </div>

        <span className="rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-700">
          {selectedWallet.currency}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {actions.map((action) => (
          <button
            type="button"
            key={action}
            onClick={() =>
              onActionChange(action)
            }
            className={`rounded-xl px-5 py-2.5 font-semibold transition ${
              activeAction === action
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {action}
          </button>
        ))}
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 grid gap-5 md:grid-cols-2"
      >
        <div>
          <label
            htmlFor="wallet-action-amount"
            className="mb-2 block text-sm font-semibold text-slate-700"
          >
            Amount
          </label>

          <input
            id="wallet-action-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) =>
              onAmountChange(
                event.target.value,
              )
            }
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="500.00"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          />
        </div>

        {activeAction === 'TRANSFER' ? (
          <div>
            <label
              htmlFor="destination-wallet-id"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Destination wallet ID
            </label>

            <input
              id="destination-wallet-id"
              type="text"
              value={destinationWalletId}
              onChange={(event) =>
                onDestinationWalletChange(
                  event.target.value,
                )
              }
              required
              placeholder="Wallet UUID"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </div>
        ) : (
          <div>
            <label
              htmlFor="wallet-action-reference"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Reference
            </label>

            <input
              id="wallet-action-reference"
              type="text"
              value={reference}
              onChange={(event) =>
                onReferenceChange(
                  event.target.value,
                )
              }
              placeholder="Transaction reference"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </div>
        )}

        {activeAction === 'TRANSFER' ? (
          <div className="md:col-span-2">
            <label
              htmlFor="wallet-action-description"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Description
            </label>

            <input
              id="wallet-action-description"
              type="text"
              value={description}
              onChange={(event) =>
                onDescriptionChange(
                  event.target.value,
                )
              }
              placeholder="Payment description"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? 'Processing...'
              : `Confirm ${activeAction.toLowerCase()}`}
          </button>
        </div>
      </form>
    </section>
  );
}