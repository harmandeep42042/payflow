import type { AdminTransaction, LedgerEntry, TransactionDetail, TransactionFilters, TransactionType, TransactionUser, TransactionWallet } from './types';

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = { search: '', type: 'ALL', status: 'ALL', page: 1, limit: 10 };
export const TRANSACTION_PAGE_SIZES = [10, 25, 50, 100] as const;
const TYPES: TransactionType[] = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'];
const STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED'];
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

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
function parts(value: string) {
  const normalized = normalizeDecimal(value); const negative = normalized.startsWith('-');
  const [whole, fraction = ''] = (negative ? normalized.slice(1) : normalized).split('.');
  return { negative, digits: `${whole}${fraction}`.replace(/^0+(?=\d)/, ''), scale: fraction.length };
}
function addDigits(left: string, right: string) {
  const size = Math.max(left.length, right.length); const a = left.padStart(size, '0'); const b = right.padStart(size, '0');
  let carry = 0; let result = '';
  for (let index = size - 1; index >= 0; index -= 1) { const sum = Number(a[index]) + Number(b[index]) + carry; result = String(sum % 10) + result; carry = Math.floor(sum / 10); }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}
function compareDigits(left: string, right: string) { const a = left.replace(/^0+/, '') || '0'; const b = right.replace(/^0+/, '') || '0'; return a.length === b.length ? a.localeCompare(b) : a.length - b.length; }
function subtractDigits(left: string, right: string) {
  const size = Math.max(left.length, right.length); const a = left.padStart(size, '0'); const b = right.padStart(size, '0'); let borrow = 0; let result = '';
  for (let index = size - 1; index >= 0; index -= 1) { let difference = Number(a[index]) - borrow - Number(b[index]); if (difference < 0) { difference += 10; borrow = 1; } else borrow = 0; result = String(difference) + result; }
  return result.replace(/^0+(?=\d)/, '');
}
export function addDecimalStrings(left: string, right: string): string {
  const a = parts(left); const b = parts(right); const scale = Math.max(a.scale, b.scale);
  const ad = a.digits.padEnd(a.digits.length + scale - a.scale, '0'); const bd = b.digits.padEnd(b.digits.length + scale - b.scale, '0');
  let negative = false; let sum: string;
  if (a.negative === b.negative) { sum = addDigits(ad, bd); negative = a.negative; }
  else if (compareDigits(ad, bd) >= 0) { sum = subtractDigits(ad, bd); negative = a.negative; }
  else { sum = subtractDigits(bd, ad); negative = b.negative; }
  const digits = sum.padStart(scale + 1, '0'); const whole = scale ? digits.slice(0, -scale) : digits; const fraction = scale ? digits.slice(-scale).replace(/0+$/, '') : '';
  const result = fraction ? `${whole}.${fraction}` : `${whole}.00`; return negative && result !== '0.00' ? `-${result}` : result;
}
export function formatTransactionAmount(value: string, currency?: string): string {
  const normalized = normalizeDecimal(value); const negative = normalized.startsWith('-'); const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = unsigned.split('.'); const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ','); const amount = `${negative ? '-' : ''}${grouped}.${fraction.padEnd(2, '0')}`;
  return currency ? `${currency} ${amount}` : amount;
}
function normalizeUser(value: unknown): TransactionUser {
  const user = object(value); return { id: text(user?.id, 'Unavailable'), email: text(user?.email, 'Email unavailable'), phone: text(user?.phone) || null, firstName: text(user?.firstName), lastName: text(user?.lastName) || null, role: text(user?.role, 'UNKNOWN'), status: text(user?.status, 'UNKNOWN') };
}
export function userName(user: TransactionUser): string { return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'User unavailable'; }
export function normalizeTransaction(value: unknown): AdminTransaction | null {
  const item = object(value); if (!item) return null; const id = text(item.id); const type = text(item.type).toUpperCase() as TransactionType; if (!id || !TYPES.includes(type)) return null;
  const base = { id, type, amount: normalizeDecimal(item.amount), currency: text(item.currency, 'UNKNOWN').toUpperCase(), status: text(item.status, 'UNKNOWN').toUpperCase(), failureReason: text(item.failureReason) || null, createdAt: text(item.createdAt), completedAt: text(item.completedAt) || null, user: normalizeUser(item.user), destinationUser: item.destinationUser ? normalizeUser(item.destinationUser) : null };
  if (type === 'TRANSFER') return { ...base, type, walletId: null, reference: null, description: text(item.description) || null, sourceWalletId: text(item.sourceWalletId, 'Unavailable'), destinationWalletId: text(item.destinationWalletId, 'Unavailable') };
  return { ...base, type, walletId: text(item.walletId, 'Unavailable'), reference: text(item.reference) || null, description: null, sourceWalletId: null, destinationWalletId: null };
}
export function normalizeTransactions(value: unknown): AdminTransaction[] { return Array.isArray(value) ? value.map(normalizeTransaction).filter((item): item is AdminTransaction => Boolean(item)) : []; }
export function transactionAmountsByCurrency(items: AdminTransaction[]) { const totals = new Map<string, string>(); for (const item of items) totals.set(item.currency, addDecimalStrings(totals.get(item.currency) ?? '0.00', item.amount)); return Array.from(totals, ([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency)); }
export function transactionStatusCounts(items: AdminTransaction[]) { const result: Record<string, number> = {}; for (const item of items) result[item.status] = (result[item.status] ?? 0) + 1; return result; }
export function formatTransactionDate(value: string | null | undefined): string { if (!value) return 'Unavailable'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Unavailable' : `${date.toLocaleString('en-IN')} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`; }
export function buildTransactionsQuery(filters: TransactionFilters) { return new URLSearchParams({ page: String(filters.page), limit: String(filters.limit), search: filters.search, type: filters.type, status: filters.status }).toString(); }
export function buildTransactionsUrlQuery(filters: TransactionFilters) { return new URLSearchParams({ page: String(filters.page), pageSize: String(filters.limit), search: filters.search, type: filters.type, status: filters.status }).toString(); }
export function parseTransactionFilters(params: URLSearchParams): TransactionFilters { const type = text(params.get('type'), 'ALL').toUpperCase(); const status = text(params.get('status'), 'ALL').toUpperCase(); const page = Number(params.get('page')); const limit = Number(params.get('pageSize') ?? params.get('limit')); return { search: params.get('search')?.trim() ?? '', type: ['ALL', ...TYPES].includes(type) ? type : 'ALL', status: ['ALL', ...STATUSES].includes(status) ? status : 'ALL', page: Number.isInteger(page) && page > 0 ? page : 1, limit: TRANSACTION_PAGE_SIZES.includes(limit as 10 | 25 | 50 | 100) ? limit : 10 }; }
export function clearTransactionFilters(filters: TransactionFilters): TransactionFilters { return { ...DEFAULT_TRANSACTION_FILTERS, limit: filters.limit }; }
export function normalizeTransactionPage(page: number, totalPages: number) { return totalPages > 0 && page > totalPages ? totalPages : page; }
export function activeTransactionFilterCount(filters: TransactionFilters) { return Number(Boolean(filters.search)) + Number(filters.type !== 'ALL') + Number(filters.status !== 'ALL'); }
export class LatestTransactionRequest { private controller: AbortController | null = null; private sequence = 0; begin() { this.controller?.abort(); this.controller = new AbortController(); return { controller: this.controller, requestId: ++this.sequence }; } isLatest(id: number) { return id === this.sequence && !this.controller?.signal.aborted; } abort() { this.controller?.abort(); } }
export function neutralizeCsvFormula(value: unknown): string { const textValue = value === null || value === undefined ? '' : String(value); return /^[=+\-@]/.test(textValue.trimStart()) ? `'${textValue}` : textValue; }
export function escapeCsvCell(value: unknown, userControlled = false): string { const safe = userControlled ? neutralizeCsvFormula(value) : String(value ?? ''); return `"${safe.replace(/"/g, '""')}"`; }

function normalizeWallet(value: unknown): TransactionWallet | null { const wallet = object(value); if (!wallet) return null; const user = normalizeUser(wallet.user); const ledger = object(wallet.ledgerAccount); return { id: text(wallet.id, 'Unavailable'), userId: text(wallet.userId, 'Unavailable'), currency: text(wallet.currency, 'UNKNOWN').toUpperCase(), balance: normalizeDecimal(wallet.balance), status: text(wallet.status, 'UNKNOWN'), user, ledgerAccount: ledger ? { id: text(ledger.id, 'Unavailable'), code: text(ledger.code, 'Unavailable'), name: text(ledger.name, 'Unavailable'), type: text(ledger.type, 'Unavailable'), currency: text(ledger.currency, text(wallet.currency, 'UNKNOWN')).toUpperCase(), status: text(ledger.status, 'UNKNOWN') } : null }; }
function normalizeEntry(value: unknown): LedgerEntry | null { const entry = object(value); if (!entry || !text(entry.id)) return null; const ledger = object(entry.ledgerAccount); const entryType = text(entry.entryType).toUpperCase(); return { id: text(entry.id), ledgerAccountId: text(entry.ledgerAccountId, 'Unavailable'), entryType: entryType === 'CREDIT' ? 'CREDIT' : 'DEBIT', amount: normalizeDecimal(entry.amount), currency: text(entry.currency, 'UNKNOWN').toUpperCase(), createdAt: text(entry.createdAt), ledgerAccount: { id: text(ledger?.id, 'Unavailable'), code: text(ledger?.code, 'Unavailable'), name: text(ledger?.name, 'Unavailable'), type: text(ledger?.type, 'Unavailable'), status: text(ledger?.status, 'UNKNOWN') } }; }
export function normalizeTransactionDetail(value: unknown): TransactionDetail | null { const response = object(value); const type = text(response?.type).toUpperCase() as TransactionType; const transaction = object(response?.transaction); if (!TYPES.includes(type) || !transaction || !text(transaction.id)) return null; return { type, transaction: { id: text(transaction.id), amount: normalizeDecimal(transaction.amount), currency: text(transaction.currency, 'UNKNOWN').toUpperCase(), status: text(transaction.status, 'UNKNOWN').toUpperCase(), reference: text(transaction.reference) || null, description: text(transaction.description) || null, failureReason: text(transaction.failureReason) || null, createdAt: text(transaction.createdAt), updatedAt: text(transaction.updatedAt), completedAt: text(transaction.completedAt) || null, wallet: normalizeWallet(transaction.wallet), sourceWallet: normalizeWallet(transaction.sourceWallet), destinationWallet: normalizeWallet(transaction.destinationWallet), ledgerEntries: Array.isArray(transaction.ledgerEntries) ? transaction.ledgerEntries.map(normalizeEntry).filter((entry): entry is LedgerEntry => Boolean(entry)) : [] } }; }
