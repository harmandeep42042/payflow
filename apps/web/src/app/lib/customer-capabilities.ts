export type CapabilityStatus =
  | 'IMPLEMENTED'
  | 'FOUNDATION ONLY'
  | 'BACKEND REQUIRED'
  | 'EXTERNAL PROVIDER REQUIRED'
  | 'NOT SAFE TO IMPLEMENT YET';

export type CustomerCapability = {
  name: string;
  description: string;
  status: CapabilityStatus;
  href?: string;
};

export const customerCapabilities: CustomerCapability[] = [
  { name: 'Home and wallets', description: 'Balances remain separated by currency with wallet status and recent activity.', status: 'IMPLEMENTED', href: '/dashboard' },
  { name: 'Send money', description: 'Authenticated recipient verification, exact amounts, confirmation and authoritative results.', status: 'IMPLEMENTED', href: '/send-money' },
  { name: 'Receive money', description: 'Authenticated Payflow VPA and currency-specific QR.', status: 'IMPLEMENTED', href: '/receive' },
  { name: 'Scan to pay', description: 'Payflow QR parsing with recipient hand-off to the protected send flow.', status: 'IMPLEMENTED', href: '/scan' },
  { name: 'Deposit and withdraw', description: 'Existing isolated Payflow wallet funding and withdrawal flows.', status: 'IMPLEMENTED', href: '/deposit' },
  { name: 'Transactions', description: 'Searchable recent wallet activity with exact currency-aware amounts.', status: 'IMPLEMENTED', href: '/transactions' },
  { name: 'Rewards', description: 'Available and claimed rewards backed by the existing rewards service.', status: 'IMPLEMENTED', href: '/rewards' },
  { name: 'Offers marketplace', description: 'Persisted catalogue, eligibility, expiry and duplicate-safe claim lifecycle.', status: 'IMPLEMENTED', href: '/offers' },
  { name: 'Contacts and favourites', description: 'Private authenticated contacts with ownership and active-recipient enforcement.', status: 'IMPLEMENTED', href: '/contacts' },
  { name: 'Request money', description: 'Authorized request lifecycle with expiry, idempotency and wallet-backed settlement.', status: 'IMPLEMENTED', href: '/request-money' },
  { name: 'Split bill', description: 'Equal and exact decimal allocations with participant settlement tracking.', status: 'IMPLEMENTED', href: '/split-bill' },
  { name: 'Mobile recharge', description: 'Attempt tracking and a provider boundary; unavailable until an authoritative provider is configured.', status: 'EXTERNAL PROVIDER REQUIRED', href: '/recharge' },
  { name: 'Bill payments', description: 'Category and attempt tracking; bill discovery and payment require an authoritative provider.', status: 'EXTERNAL PROVIDER REQUIRED', href: '/bills' },
  { name: 'AutoPay', description: 'Consent, limits and mandate lifecycle are persisted; provider authorization and debits remain unavailable.', status: 'EXTERNAL PROVIDER REQUIRED', href: '/autopay' },
  { name: 'Help and disputes', description: 'Authenticated case submission, transaction ownership checks and status history.', status: 'IMPLEMENTED', href: '/help' },
  { name: 'Notifications', description: 'Persistent and real-time account updates with unread, mark-read and deletion controls.', status: 'IMPLEMENTED', href: '/notifications' },
  { name: 'Spending insights', description: 'Currency-separated summaries use only the recent transactions returned by existing APIs.', status: 'FOUNDATION ONLY', href: '/insights' },
  { name: 'Profile and security', description: 'Profile, password, notification preferences and session controls.', status: 'IMPLEMENTED', href: '/profile' },
];
