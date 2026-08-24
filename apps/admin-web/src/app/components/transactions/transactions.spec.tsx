import { fireEvent, render, screen } from '@testing-library/react';
import {
  activeTransactionFilterCount, addDecimalStrings, buildTransactionsQuery,
  buildTransactionsUrlQuery, clearTransactionFilters, DEFAULT_TRANSACTION_FILTERS,
  escapeCsvCell, formatTransactionAmount, formatTransactionDate,
  LatestTransactionRequest, neutralizeCsvFormula, normalizeTransaction,
  normalizeTransactionDetail, normalizeTransactionPage, normalizeTransactions,
  parseTransactionFilters, transactionAmountsByCurrency,
} from './helpers';
import { TransactionSummary } from './transaction-summary';
import { TransactionsFilterBar } from './transactions-filter-bar';
import { TransactionsPagination } from './transactions-pagination';
import { TransactionsTable } from './transactions-table';
import type { AdminTransaction } from './types';

const base = {
  id: '12345678-1234-1234-1234-123456789012', amount: '1000.25', currency: 'INR', status: 'COMPLETED',
  failureReason: null, createdAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z',
  user: { id: 'user', email: 'sender@test.local', phone: null, firstName: 'Test', lastName: 'Sender', role: 'USER', status: 'ACTIVE' },
  destinationUser: null,
};
const deposit: AdminTransaction = { ...base, type: 'DEPOSIT', walletId: 'wallet-one', reference: 'deposit-ref', description: null, sourceWalletId: null, destinationWalletId: null };
const withdrawal: AdminTransaction = { ...base, id: 'withdrawal-id', type: 'WITHDRAWAL', walletId: 'wallet-one', reference: 'withdraw-ref', description: null, sourceWalletId: null, destinationWalletId: null };
const transfer: AdminTransaction = { ...base, id: 'transfer-id', type: 'TRANSFER', walletId: null, reference: null, description: 'transfer', sourceWalletId: 'source-wallet', destinationWalletId: 'destination-wallet', destinationUser: { ...base.user, id: 'receiver', email: 'receiver@test.local', firstName: 'Test', lastName: 'Receiver' } };

describe('Transactions management', () => {
  it.each([['DEPOSIT', deposit], ['WITHDRAWAL', withdrawal], ['TRANSFER', transfer]])('normalizes and renders %s safely', (type, item) => {
    expect(normalizeTransaction(item)?.type).toBe(type);
    const { unmount } = render(<TransactionsTable transactions={[item]} initialLoading={false} filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText(type)).toBeTruthy(); unmount();
  });
  it('rejects unknown transaction types without crashing', () => { expect(normalizeTransaction({ ...deposit, type: 'PAYMENT' })).toBeNull(); expect(normalizeTransactions([{ ...deposit, type: 'PAYMENT' }, deposit])).toHaveLength(1); });
  it('preserves unknown statuses for safe fallback badges', () => { const item = normalizeTransaction({ ...deposit, status: 'NEW_FUTURE_STATUS' }); expect(item?.status).toBe('NEW_FUTURE_STATUS'); render(<TransactionsTable transactions={[item as AdminTransaction]} initialLoading={false} filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />); expect(screen.getByText('NEW FUTURE STATUS')).toBeTruthy(); });
  it('parses and constructs URL state including pageSize', () => { const filters = parseTransactionFilters(new URLSearchParams('search=ref&type=TRANSFER&status=FAILED&page=3&pageSize=50')); expect(filters).toEqual({ search: 'ref', type: 'TRANSFER', status: 'FAILED', page: 3, limit: 50 }); expect(buildTransactionsUrlQuery(filters)).toContain('pageSize=50'); expect(buildTransactionsQuery(filters)).toBe('page=3&limit=50&search=ref&type=TRANSFER&status=FAILED'); });
  it('normalizes invalid URL values and out-of-range pages', () => { expect(parseTransactionFilters(new URLSearchParams('type=PAYMENT&status=BAD&page=-1&pageSize=7'))).toEqual(DEFAULT_TRANSACTION_FILTERS); expect(normalizeTransactionPage(9, 3)).toBe(3); expect(normalizeTransactionPage(9, 0)).toBe(9); });
  it('clears filters while preserving page size', () => { expect(clearTransactionFilters({ search: 'a', type: 'DEPOSIT', status: 'FAILED', page: 4, limit: 25 })).toEqual({ ...DEFAULT_TRANSACTION_FILTERS, limit: 25 }); });
  it('cancels stale requests and keeps only the latest', () => { const requests = new LatestTransactionRequest(); const first = requests.begin(); const second = requests.begin(); expect(first.controller.signal.aborted).toBe(true); expect(requests.isLatest(first.requestId)).toBe(false); expect(requests.isLatest(second.requestId)).toBe(true); requests.abort(); expect(second.controller.signal.aborted).toBe(true); });
  it('formats and adds monetary strings without floating-point loss', () => { expect(addDecimalStrings('9007199254740993.11', '0.89')).toBe('9007199254740994.00'); expect(formatTransactionAmount('9007199254740993.11', 'USD')).toBe('USD 9,007,199,254,740,993.11'); });
  it('groups current-page PDF/summary totals by currency', () => { expect(transactionAmountsByCurrency([deposit, { ...deposit, id: 'usd', currency: 'USD', amount: '25.00' }, { ...deposit, id: 'inr-two', amount: '10.75' }])).toEqual([{ currency: 'INR', amount: '1011.00' }, { currency: 'USD', amount: '25.00' }]); render(<TransactionSummary transactions={[deposit, { ...deposit, id: 'usd', currency: 'USD' }]} />); expect(screen.getByText(/No currency conversion/)).toBeTruthy(); });
  it.each(['=SUM(A1:A2)', '+123', '-123', '@cmd'])('neutralizes user-controlled CSV formula %s', (value) => { expect(neutralizeCsvFormula(value)).toBe(`'${value}`); expect(escapeCsvCell(value, true)).toContain(`'${value}`); });
  it('does not corrupt legitimate negative monetary CSV values', () => { expect(escapeCsvCell('-123.45', false)).toBe('"-123.45"'); expect(formatTransactionAmount('-123.45', 'USD')).toBe('USD -123.45'); });
  it('uses a safe fallback for invalid dates', () => { expect(formatTransactionDate('invalid')).toBe('Unavailable'); expect(formatTransactionDate(null)).toBe('Unavailable'); });
  it('supports labelled search, type, status, page size and clear controls', () => { const handlers = { onSearchInput: jest.fn(), onType: jest.fn(), onStatus: jest.fn(), onLimit: jest.fn(), onSearch: jest.fn(), onClear: jest.fn() }; render(<TransactionsFilterBar searchInput="" type="ALL" status="ALL" limit={10} activeCount={1} disabled={false} {...handlers} />); fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ref' } }); fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'TRANSFER' } }); fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'FAILED' } }); fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '25' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' })); fireEvent.click(screen.getByRole('button', { name: 'Clear' })); expect(handlers.onSearchInput).toHaveBeenCalledWith('ref'); expect(handlers.onType).toHaveBeenCalledWith('TRANSFER'); expect(handlers.onStatus).toHaveBeenCalledWith('FAILED'); expect(handlers.onLimit).toHaveBeenCalledWith(25); expect(handlers.onSearch).toHaveBeenCalled(); expect(handlers.onClear).toHaveBeenCalled(); });
  it('preserves visible rows during background refresh and renders loading/empty states', () => { const { rerender } = render(<TransactionsTable transactions={[deposit]} initialLoading={false} filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />); expect(screen.getByText('Test Sender')).toBeTruthy(); rerender(<TransactionsTable transactions={[]} initialLoading filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />); expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true'); rerender(<TransactionsTable transactions={[]} initialLoading={false} filtered onDetails={jest.fn()} onClear={jest.fn()} />); expect(screen.getByText('No transactions match these filters')).toBeTruthy(); });
  it('provides keyboard-accessible detail actions and pagination', () => { const onDetails = jest.fn(); const { unmount } = render(<TransactionsTable transactions={[deposit]} initialLoading={false} filtered={false} onDetails={onDetails} onClear={jest.fn()} />); fireEvent.click(screen.getByRole('button', { name: 'View details' })); expect(onDetails).toHaveBeenCalledWith(deposit.id); unmount(); const onPage = jest.fn(); render(<TransactionsPagination page={2} totalPages={3} total={30} start={11} end={20} hasPrevious hasNext disabled={false} onPage={onPage} />); fireEvent.click(screen.getByRole('button', { name: 'Previous' })); fireEvent.click(screen.getByRole('button', { name: 'Next' })); expect(onPage).toHaveBeenNthCalledWith(1, 1); expect(onPage).toHaveBeenNthCalledWith(2, 3); });
  it('normalizes detail, empty ledger, missing and malformed responses', () => { const detail = normalizeTransactionDetail({ type: 'DEPOSIT', transaction: { ...deposit, updatedAt: base.createdAt, wallet: { id: 'wallet', userId: 'user', currency: 'INR', balance: '99.00', status: 'ACTIVE', user: base.user, ledgerAccount: null }, ledgerEntries: [] } }); expect(detail?.type).toBe('DEPOSIT'); expect(detail?.transaction.wallet?.balance).toBe('99.00'); expect(detail?.transaction.ledgerEntries).toEqual([]); expect(normalizeTransactionDetail(null)).toBeNull(); expect(normalizeTransactionDetail({ type: 'PAYMENT', transaction: deposit })).toBeNull(); });
  it('counts active filters', () => { expect(activeTransactionFilterCount({ ...DEFAULT_TRANSACTION_FILTERS, search: 'a', status: 'FAILED' })).toBe(2); });
});
