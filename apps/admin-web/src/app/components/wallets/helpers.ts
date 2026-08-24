import type {
  AdminWallet,
  LedgerAccount,
  WalletCounts,
  WalletFilters,
  WalletOwner,
  WalletStatus,
} from './types';

export const DEFAULT_WALLET_FILTERS: WalletFilters = {
  search: '',
  status: 'ALL',
  currency: 'ALL',
  page: 1,
  limit: 10,
};
export const WALLET_PAGE_SIZES = [10, 25, 50, 100] as const;
const STATUSES: WalletStatus[] = ['ACTIVE', 'FROZEN', 'CLOSED'];

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}
function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export function normalizeDecimal(value: unknown): string {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!/^-?\d+(?:\.\d+)?$/.test(candidate)) return '0.00';
  const negative = candidate.startsWith('-');
  const unsigned = negative ? candidate.slice(1) : candidate;
  const [wholeValue, fractionValue = ''] = unsigned.split('.');
  const whole = wholeValue.replace(/^0+(?=\d)/, '') || '0';
  const fraction = fractionValue.replace(/0+$/, '');
  const normalized = fraction ? `${whole}.${fraction}` : `${whole}.00`;
  return negative && normalized !== '0.00' ? `-${normalized}` : normalized;
}

function decimalParts(value: string): { negative: boolean; digits: string; scale: number } {
  const normalized = normalizeDecimal(value);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  return {
    negative,
    digits: `${whole}${fraction}`.replace(/^0+(?=\d)/, ''),
    scale: fraction.length,
  };
}
function addDigits(left: string, right: string): string {
  const size = Math.max(left.length, right.length);
  const a = left.padStart(size, '0');
  const b = right.padStart(size, '0');
  let carry = 0;
  let result = '';
  for (let index = size - 1; index >= 0; index -= 1) {
    const sum = Number(a[index]) + Number(b[index]) + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}
function compareDigits(left: string, right: string): number {
  const a = left.replace(/^0+/, '') || '0';
  const b = right.replace(/^0+/, '') || '0';
  return a.length === b.length ? a.localeCompare(b) : a.length - b.length;
}
function subtractDigits(left: string, right: string): string {
  const size = Math.max(left.length, right.length);
  const a = left.padStart(size, '0');
  const b = right.padStart(size, '0');
  let borrow = 0;
  let result = '';
  for (let index = size - 1; index >= 0; index -= 1) {
    let difference = Number(a[index]) - borrow - Number(b[index]);
    if (difference < 0) { difference += 10; borrow = 1; } else borrow = 0;
    result = String(difference) + result;
  }
  return result.replace(/^0+(?=\d)/, '');
}

export function addDecimalStrings(left: string, right: string): string {
  const a = decimalParts(left);
  const b = decimalParts(right);
  const scale = Math.max(a.scale, b.scale);
  const aDigits = a.digits.padEnd(a.digits.length + scale - a.scale, '0');
  const bDigits = b.digits.padEnd(b.digits.length + scale - b.scale, '0');
  let negative = false;
  let summed: string;
  if (a.negative === b.negative) {
    summed = addDigits(aDigits, bDigits);
    negative = a.negative;
  } else if (compareDigits(aDigits, bDigits) >= 0) {
    summed = subtractDigits(aDigits, bDigits);
    negative = a.negative;
  } else {
    summed = subtractDigits(bDigits, aDigits);
    negative = b.negative;
  }
  const digits = summed.padStart(scale + 1, '0');
  const whole = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  const result = fraction ? `${whole}.${fraction}` : `${whole}.00`;
  return negative && result !== '0.00' ? `-${result}` : result;
}

export function formatWalletBalance(value: string, currency?: string): string {
  const normalized = normalizeDecimal(value);
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = fraction.padEnd(2, '0');
  const amount = `${negative ? '-' : ''}${grouped}.${decimals}`;
  return currency ? `${currency} ${amount}` : amount;
}

export function isZeroBalance(value: string): boolean {
  return /^-?0+(?:\.0+)?$/.test(value.trim());
}

function normalizeOwner(value: unknown): WalletOwner {
  const owner = record(value);
  return {
    id: text(owner?.id, 'Unavailable'),
    email: text(owner?.email, 'Email unavailable'),
    phone: text(owner?.phone) || null,
    firstName: text(owner?.firstName),
    lastName: text(owner?.lastName) || null,
    role: text(owner?.role, 'UNKNOWN'),
    status: text(owner?.status, 'UNKNOWN'),
  };
}
function normalizeLedger(value: unknown): LedgerAccount | null {
  const ledger = record(value);
  if (!ledger) return null;
  return {
    id: text(ledger.id, 'Unavailable'),
    code: text(ledger.code, 'Unavailable'),
    name: text(ledger.name, 'Unavailable'),
    type: text(ledger.type, 'Unavailable'),
    status: text(ledger.status, 'UNKNOWN'),
  };
}
function normalizeCounts(value: unknown): WalletCounts {
  const counts = record(value);
  return {
    deposits: count(counts?.deposits),
    withdrawals: count(counts?.withdrawals),
    outgoingTransfers: count(counts?.outgoingTransfers),
    incomingTransfers: count(counts?.incomingTransfers),
  };
}

export function normalizeWallet(value: unknown): AdminWallet | null {
  const wallet = record(value);
  if (!wallet) return null;
  const id = text(wallet.id);
  if (!id) return null;
  const candidateStatus = text(wallet.status).toUpperCase();
  const status = STATUSES.includes(candidateStatus as WalletStatus)
    ? (candidateStatus as WalletStatus)
    : 'CLOSED';
  const counts = normalizeCounts(wallet._count);
  const calculatedTotal = Object.values(counts).reduce((sum, item) => sum + item, 0);
  const suppliedTotal = count(wallet.transactionCount);
  return {
    id,
    userId: text(wallet.userId, 'Unavailable'),
    currency: text(wallet.currency, 'UNKNOWN').toUpperCase(),
    balance: normalizeDecimal(wallet.balance),
    version: Number.isInteger(Number(wallet.version)) ? Number(wallet.version) : null,
    status,
    createdAt: text(wallet.createdAt),
    updatedAt: text(wallet.updatedAt),
    user: normalizeOwner(wallet.user),
    ledgerAccount: normalizeLedger(wallet.ledgerAccount),
    counts,
    transactionCount: suppliedTotal || calculatedTotal,
  };
}

export function normalizeWallets(value: unknown): AdminWallet[] {
  return Array.isArray(value)
    ? value.map(normalizeWallet).filter((wallet): wallet is AdminWallet => Boolean(wallet))
    : [];
}

export function getWalletOwnerName(wallet: AdminWallet): string {
  return [wallet.user.firstName, wallet.user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || wallet.user.email || 'Owner unavailable';
}

export function formatWalletDate(value: string, includeTime = false): string {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return 'Unavailable';
  return includeTime
    ? date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export function groupWalletBalances(wallets: AdminWallet[]) {
  const totals = new Map<string, string>();
  for (const wallet of wallets)
    totals.set(
      wallet.currency,
      addDecimalStrings(totals.get(wallet.currency) ?? '0.00', wallet.balance),
    );
  return Array.from(totals, ([currency, balance]) => ({ currency, balance })).sort(
    (a, b) => a.currency.localeCompare(b.currency),
  );
}

export function walletStatusCounts(wallets: AdminWallet[]) {
  return wallets.reduce(
    (result, wallet) => ({ ...result, [wallet.status]: result[wallet.status] + 1 }),
    { ACTIVE: 0, FROZEN: 0, CLOSED: 0 },
  );
}

export function buildWalletsQuery(filters: WalletFilters): string {
  return new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
    search: filters.search,
    status: filters.status,
    currency: filters.currency,
  }).toString();
}
export function buildWalletsUrlQuery(filters: WalletFilters): string {
  return new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.limit),
    search: filters.search,
    status: filters.status,
    currency: filters.currency,
  }).toString();
}
export function parseWalletFilters(params: URLSearchParams): WalletFilters {
  const status = text(params.get('status'), 'ALL').toUpperCase();
  const currency = text(params.get('currency'), 'ALL').toUpperCase();
  const page = Number(params.get('page'));
  const limit = Number(params.get('pageSize') ?? params.get('limit'));
  return {
    search: params.get('search')?.trim() ?? '',
    status: ['ALL', ...STATUSES].includes(status) ? status : 'ALL',
    currency: /^[A-Z0-9]{2,12}$/.test(currency) ? currency : 'ALL',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: WALLET_PAGE_SIZES.includes(limit as 10 | 25 | 50 | 100) ? limit : 10,
  };
}
export function normalizeWalletPage(page: number, totalPages: number): number {
  return totalPages > 0 && page > totalPages ? totalPages : page;
}
export function clearWalletFilters(filters: WalletFilters): WalletFilters {
  return { ...DEFAULT_WALLET_FILTERS, limit: filters.limit };
}
export function activeWalletFilterCount(filters: WalletFilters): number {
  return Number(Boolean(filters.search)) + Number(filters.status !== 'ALL') + Number(filters.currency !== 'ALL');
}

export class LatestWalletRequest {
  private controller: AbortController | null = null;
  private sequence = 0;
  begin() {
    this.controller?.abort();
    this.controller = new AbortController();
    return { controller: this.controller, requestId: ++this.sequence };
  }
  isLatest(requestId: number): boolean {
    return requestId === this.sequence && !this.controller?.signal.aborted;
  }
  abort(): void {
    this.controller?.abort();
  }
}
export function acquireWalletMutationLock(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}
