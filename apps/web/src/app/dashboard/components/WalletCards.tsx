type Wallet = {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type WalletCardsProps = {
  wallets: Wallet[];
  selectedWalletId: string;
  onSelectWallet: (walletId: string) => void;
};

export default function WalletCards({
  wallets,
  selectedWalletId,
  onSelectWallet,
}: WalletCardsProps) {
  if (wallets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h4 className="text-lg font-bold text-slate-900">
          No wallets found
        </h4>

        <p className="mt-2 text-slate-500">
          Create a wallet before making transactions.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {wallets.map((wallet) => (
        <button
          type="button"
          key={wallet.id}
          onClick={() => onSelectWallet(wallet.id)}
          className={`overflow-hidden rounded-2xl p-6 text-left text-white shadow-lg transition ${
            selectedWalletId === wallet.id
              ? 'bg-slate-950 ring-4 ring-sky-200'
              : 'bg-slate-800 hover:bg-slate-900'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">
                Available balance
              </p>

              <p className="mt-2 text-3xl font-bold">
                {wallet.currency}{' '}
                {Number(wallet.balance).toLocaleString(
                  'en-IN',
                  {
                    minimumFractionDigits: 2,
                  },
                )}
              </p>
            </div>

            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              {wallet.status}
            </span>
          </div>

          <div className="mt-10 border-t border-slate-700 pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">
              Wallet ID
            </p>

            <p className="mt-1 break-all text-sm text-slate-200">
              {wallet.id}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}