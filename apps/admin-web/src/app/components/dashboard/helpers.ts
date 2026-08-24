import { normalizeDecimal } from '../transactions';

export type DashboardStats = {
  totalUsers: number; activeUsers: number; blockedUsers: number; suspendedUsers: number;
  totalWallets: number; activeWallets: number; frozenWallets: number; closedWallets: number;
  totalTransactions: number; totalDeposits: number; totalWithdrawals: number; totalTransfers: number;
};
export type DashboardUser = { id: string; email: string; firstName: string; lastName: string | null; role: string; status: string; createdAt: string };
export type DashboardTransaction = { id: string; type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'; amount: string; currency: string; status: string; reference: string | null; description: string | null; walletId: string | null; sourceWalletId: string | null; createdAt: string };
export type DashboardData = { stats: DashboardStats; recentUsers: DashboardUser[]; recentTransactions: DashboardTransaction[] };

function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null; }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback; }
function count(value: unknown) { const candidate = Number(value); return Number.isFinite(candidate) && candidate >= 0 ? Math.floor(candidate) : 0; }
function stats(value: unknown): DashboardStats {
  const item = object(value); return {
    totalUsers: count(item?.totalUsers), activeUsers: count(item?.activeUsers), blockedUsers: count(item?.blockedUsers), suspendedUsers: count(item?.suspendedUsers),
    totalWallets: count(item?.totalWallets), activeWallets: count(item?.activeWallets), frozenWallets: count(item?.frozenWallets), closedWallets: count(item?.closedWallets),
    totalTransactions: count(item?.totalTransactions), totalDeposits: count(item?.totalDeposits), totalWithdrawals: count(item?.totalWithdrawals), totalTransfers: count(item?.totalTransfers),
  };
}
export function normalizeDashboard(value: unknown): DashboardData {
  const response = object(value);
  const recentUsers = Array.isArray(response?.recentUsers) ? response.recentUsers.flatMap((value) => {
    const item = object(value); const id = text(item?.id); if (!item || !id) return [];
    return [{ id, email: text(item.email, 'Email unavailable'), firstName: text(item.firstName), lastName: text(item.lastName) || null, role: text(item.role, 'UNKNOWN'), status: text(item.status, 'UNKNOWN'), createdAt: text(item.createdAt) }];
  }) : [];
  const supported = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'];
  const recentTransactions = Array.isArray(response?.recentTransactions) ? response.recentTransactions.flatMap((value) => {
    const item = object(value); const id = text(item?.id); const type = text(item?.type).toUpperCase();
    if (!item || !id || !supported.includes(type)) return [];
    return [{ id, type: type as DashboardTransaction['type'], amount: normalizeDecimal(item.amount), currency: text(item.currency, 'UNKNOWN').toUpperCase(), status: text(item.status, 'UNKNOWN').toUpperCase(), reference: text(item.reference) || null, description: text(item.description) || null, walletId: text(item.walletId) || null, sourceWalletId: text(item.sourceWalletId) || null, createdAt: text(item.createdAt) }];
  }) : [];
  return { stats: stats(response?.stats), recentUsers, recentTransactions };
}

export class LatestDashboardRequest {
  private controller: AbortController | null = null; private sequence = 0;
  begin() { this.controller?.abort(); this.controller = new AbortController(); return { controller: this.controller, requestId: ++this.sequence }; }
  isLatest(id: number) { return id === this.sequence && !this.controller?.signal.aborted; }
  abort() { this.controller?.abort(); }
}
