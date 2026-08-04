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

export default function SummaryCards({
  wallets,
  transactions,
}: SummaryCardsProps) {
  const totalBalance = wallets.reduce(
    (sum, wallet) => sum + Number(wallet.balance),
    0,
  );

  const totalCredits = transactions
    .filter((item) => item.direction === 'CREDIT')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const totalDebits = transactions
    .filter((item) => item.direction === 'DEBIT')
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const cards = [
    {
      title: 'Wallet Balance',
      value: `₹${totalBalance.toLocaleString('en-IN')}`,
      color: 'bg-sky-500',
    },
    {
      title: 'Credits',
      value: `₹${totalCredits.toLocaleString('en-IN')}`,
      color: 'bg-emerald-500',
    },
    {
      title: 'Debits',
      value: `₹${totalDebits.toLocaleString('en-IN')}`,
      color: 'bg-rose-500',
    },
    {
      title: 'Transactions',
      value: transactions.length.toString(),
      color: 'bg-violet-500',
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`${card.color} rounded-2xl p-6 text-white shadow-lg`}
        >
          <p className="text-sm opacity-80">
            {card.title}
          </p>

          <h2 className="mt-4 text-3xl font-bold">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}