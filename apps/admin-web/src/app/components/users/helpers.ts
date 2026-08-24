import type { AdminUserItem, UserWallet, UsersFilters } from './types';
import {
  addDecimalStrings,
  formatWalletBalance,
  normalizeDecimal,
} from '../wallets/helpers';

export const DEFAULT_USERS_FILTERS: UsersFilters = {
  search: '',
  status: 'ALL',
  role: 'ALL',
  page: 1,
  limit: 10,
};
export const PAGE_SIZES = [10, 25, 50, 100] as const;

export function getUserDisplayName(
  user: Pick<AdminUserItem, 'firstName' | 'lastName' | 'email'>,
): string {
  const name = [user.firstName, user.lastName]
    .filter((value) => typeof value === 'string' && value.trim())
    .join(' ')
    .trim();
  return name || user.email || 'User';
}

export function formatUserMoney(amount: string): string {
  return formatWalletBalance(amount);
}

export function getWalletBalances(
  wallets: UserWallet[] | null | undefined,
): Array<{ currency: string; amount: string }> {
  if (!Array.isArray(wallets)) return [];
  const totals = new Map<string, string>();
  for (const wallet of wallets) {
    const currency =
      typeof wallet?.currency === 'string' && wallet.currency.trim()
        ? wallet.currency.trim().toUpperCase()
        : 'UNKNOWN';
    const rawBalance = typeof wallet?.balance === 'string' ? wallet.balance.trim() : '';
    if (!/^-?\d+(?:\.\d+)?$/.test(rawBalance)) continue;
    const amount = normalizeDecimal(rawBalance);
    totals.set(currency, addDecimalStrings(totals.get(currency) ?? '0.00', amount));
  }
  return Array.from(totals, ([currency, amount]) => ({ currency, amount }));
}

export function formatCurrencyAmount(currency: string, amount: string): string {
  return formatWalletBalance(amount, currency === 'UNKNOWN' ? undefined : currency);
}

export function formatUserDate(value: string, includeTime = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return includeTime
    ? date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export function buildUsersQuery(filters: UsersFilters): string {
  return new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
    search: filters.search,
    status: filters.status,
    role: filters.role,
  }).toString();
}

export function buildUsersUrlQuery(filters: UsersFilters): string {
  return new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.limit),
    search: filters.search,
    status: filters.status,
    role: filters.role,
  }).toString();
}

export function parseUsersFilters(params: URLSearchParams): UsersFilters {
  const requestedStatus = params.get('status');
  const requestedRole = params.get('role');
  const pageValue = Number(params.get('page'));
  const limitValue = Number(params.get('pageSize') ?? params.get('limit'));
  return {
    search: params.get('search')?.trim() ?? '',
    status:
      requestedStatus &&
      ['ALL', 'ACTIVE', 'BLOCKED', 'SUSPENDED'].includes(requestedStatus)
        ? requestedStatus
        : 'ALL',
    role:
      requestedRole && ['ALL', 'USER', 'ADMIN'].includes(requestedRole)
        ? requestedRole
        : 'ALL',
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    limit: [10, 25, 50, 100].includes(limitValue) ? limitValue : 10,
  };
}

export function normalizeUsersPage(
  requestedPage: number,
  totalPages: number,
): number {
  return totalPages > 0 && requestedPage > totalPages
    ? totalPages
    : requestedPage;
}

export function clearUsersFilters(filters: UsersFilters): UsersFilters {
  return { ...DEFAULT_USERS_FILTERS, limit: filters.limit };
}

export class LatestUsersRequest {
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

export function acquireMutationLock(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function activeUsersFilterCount(
  filters: Pick<UsersFilters, 'search' | 'status' | 'role'>,
): number {
  return (
    Number(Boolean(filters.search)) +
    Number(filters.status !== 'ALL') +
    Number(filters.role !== 'ALL')
  );
}
