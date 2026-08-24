type Wallet = {
  id: string;
  balance: string;
  currency: string;
};

type Transaction = {
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  currency: string;
};

type SummaryCardsProps = {
  wallets: Wallet[];
  transactions: Transaction[];
};

import { formatMoney, groupCurrencyAmounts } from '../../lib/money';

export default function SummaryCards({
  wallets,
  transactions,
}: SummaryCardsProps) {
  const totalBalance = groupCurrencyAmounts(wallets.map((wallet) => ({ amount: wallet.balance, currency: wallet.currency })));

  const totalCredits =
    groupCurrencyAmounts(transactions
      .filter(
        (item) =>
          item.direction ===
          'CREDIT',
      )
      .map(({ amount, currency }) => ({ amount, currency })));

  const totalDebits =
    groupCurrencyAmounts(transactions
      .filter(
        (item) =>
          item.direction ===
          'DEBIT',
      )
      .map(({ amount, currency }) => ({ amount, currency })));

  const renderTotals = (totals: { amount: string; currency: string }[]) =>
    totals.length ? totals.map((item) => formatMoney(item.amount, item.currency)).join(' · ') : '—';

  const cards = [
    {
      title:
        'Wallet Balance',
      value:
        renderTotals(totalBalance),
      accent: 'text-blue-700',
    },
    {
      title:
        'Money In',
      value:
        renderTotals(totalCredits),
      accent: 'text-emerald-700',
    },
    {
      title:
        'Money Out',
      value:
        renderTotals(totalDebits),
      accent: 'text-rose-700',
    },
    {
      title:
        'Transactions',
      value:
        transactions.length
          .toString(),
      accent: 'text-slate-950',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(
        (card) => (
          <div
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {card.title}
            </p>

            <h2 className={`mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl ${card.accent}`}>
              {card.value}
            </h2>
          </div>
        ),
      )}
    </div>
  );
}
