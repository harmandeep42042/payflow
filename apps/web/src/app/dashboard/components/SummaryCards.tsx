type Wallet = {
  id: string;
  balance: string;
  currency: string;
};

type Transaction = {
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
};

type SummaryCardsProps = {
  wallets: Wallet[];
  transactions: Transaction[];
};

function formatMoney(
  amount: number,
): string {
  return new Intl.NumberFormat(
    'en-IN',
    {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

export default function SummaryCards({
  wallets,
  transactions,
}: SummaryCardsProps) {
  const totalBalance =
    wallets.reduce(
      (sum, wallet) =>
        sum +
        Number(wallet.balance),
      0,
    );

  const totalCredits =
    transactions
      .filter(
        (item) =>
          item.direction ===
          'CREDIT',
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(item.amount),
        0,
      );

  const totalDebits =
    transactions
      .filter(
        (item) =>
          item.direction ===
          'DEBIT',
      )
      .reduce(
        (sum, item) =>
          sum +
          Number(item.amount),
        0,
      );

  const cards = [
    {
      title:
        'Wallet Balance',
      value:
        formatMoney(
          totalBalance,
        ),
      color:
        'bg-sky-500',
    },
    {
      title:
        'Money In',
      value:
        formatMoney(
          totalCredits,
        ),
      color:
        'bg-emerald-500',
    },
    {
      title:
        'Money Out',
      value:
        formatMoney(
          totalDebits,
        ),
      color:
        'bg-rose-500',
    },
    {
      title:
        'Transactions',
      value:
        transactions.length
          .toString(),
      color:
        'bg-violet-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(
        (card) => (
          <div
            key={card.title}
            className={`${card.color} rounded-2xl p-5 text-white shadow-lg`}
          >
            <p className="text-sm opacity-80">
              {card.title}
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              {card.value}
            </h2>
          </div>
        ),
      )}
    </div>
  );
}
