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
  { name: 'Offers marketplace', description: 'Requires an authoritative offer catalogue and eligibility contract.', status: 'BACKEND REQUIRED' },
  { name: 'Contacts', description: 'A privacy-aware contact store and consent model are not available yet.', status: 'BACKEND REQUIRED' },
  { name: 'Request money', description: 'Requires request lifecycle, expiry, authorization and notification contracts.', status: 'BACKEND REQUIRED' },
  { name: 'Split bill', description: 'Requires participant, allocation, settlement and cancellation contracts.', status: 'BACKEND REQUIRED' },
  { name: 'Recharge and bill payments', description: 'Requires biller discovery, validation and payment-provider integration.', status: 'EXTERNAL PROVIDER REQUIRED' },
  { name: 'AutoPay', description: 'Requires mandates, consent, limits, scheduling, retries and revocation support.', status: 'NOT SAFE TO IMPLEMENT YET' },
  { name: 'Help and disputes', description: 'Guidance is available; case creation requires a support and dispute backend.', status: 'FOUNDATION ONLY', href: '/help' },
  { name: 'Spending insights', description: 'Currency-separated summaries use only the recent transactions returned by existing APIs.', status: 'FOUNDATION ONLY', href: '/insights' },
  { name: 'Profile and security', description: 'Profile, password, notification preferences and session controls.', status: 'IMPLEMENTED', href: '/profile' },
];
