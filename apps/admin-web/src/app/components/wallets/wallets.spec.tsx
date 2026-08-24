import { fireEvent, render, screen } from '@testing-library/react';
import {
  acquireWalletMutationLock,
  activeWalletFilterCount,
  addDecimalStrings,
  buildWalletsQuery,
  buildWalletsUrlQuery,
  clearWalletFilters,
  DEFAULT_WALLET_FILTERS,
  formatWalletBalance,
  groupWalletBalances,
  isZeroBalance,
  LatestWalletRequest,
  normalizeWallet,
  normalizeWalletPage,
  normalizeWallets,
  parseWalletFilters,
  walletStatusCounts,
} from './helpers';
import { WalletDetailsDialog } from './wallet-details-dialog';
import { WalletStatusConfirmDialog } from './wallet-status-confirm-dialog';
import { WalletsFilterBar } from './wallets-filter-bar';
import { WalletsPagination } from './wallets-pagination';
import { WalletsTable } from './wallets-table';
import type { AdminWallet } from './types';

const wallet: AdminWallet = {
  id: '12345678-1234-1234-1234-123456789012',
  userId: '87654321-1234-1234-1234-123456789012',
  currency: 'INR',
  balance: '1000.25',
  version: 2,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  user: {
    id: '87654321-1234-1234-1234-123456789012',
    email: 'owner@payflow.test',
    phone: null,
    firstName: 'Wallet',
    lastName: 'Owner',
    role: 'USER',
    status: 'ACTIVE',
  },
  ledgerAccount: {
    id: 'ledger-id', code: 'WALLET-INR', name: 'Wallet INR', type: 'ASSET', status: 'ACTIVE',
  },
  counts: { deposits: 2, withdrawals: 1, outgoingTransfers: 3, incomingTransfers: 4 },
  transactionCount: 10,
};

describe('Wallet management components', () => {
  it('constructs the existing API query and URL state', () => {
    expect(buildWalletsQuery(DEFAULT_WALLET_FILTERS)).toBe(
      'page=1&limit=10&search=&status=ALL&currency=ALL',
    );
    const filters = { search: 'owner', status: 'FROZEN', currency: 'USD', page: 3, limit: 25 };
    expect(buildWalletsQuery(filters)).toBe(
      'page=3&limit=25&search=owner&status=FROZEN&currency=USD',
    );
    expect(buildWalletsUrlQuery(filters)).toContain('pageSize=25');
  });

  it('parses back/forward URL filters and normalizes invalid values', () => {
    expect(parseWalletFilters(new URLSearchParams(
      'search=lee&status=CLOSED&currency=usd&page=4&pageSize=50',
    ))).toEqual({ search: 'lee', status: 'CLOSED', currency: 'USD', page: 4, limit: 50 });
    expect(parseWalletFilters(new URLSearchParams(
      'status=INVALID&currency=%25&page=-2&pageSize=7',
    ))).toEqual(DEFAULT_WALLET_FILTERS);
  });

  it('normalizes out-of-range pages and preserves page size when clearing', () => {
    expect(normalizeWalletPage(8, 3)).toBe(3);
    expect(normalizeWalletPage(8, 0)).toBe(8);
    expect(clearWalletFilters({ search: 'a', status: 'ACTIVE', currency: 'EUR', page: 4, limit: 50 }))
      .toEqual({ ...DEFAULT_WALLET_FILTERS, limit: 50 });
  });

  it('cancels stale requests and accepts only the latest request', () => {
    const requests = new LatestWalletRequest();
    const first = requests.begin();
    const second = requests.begin();
    expect(first.controller.signal.aborted).toBe(true);
    expect(requests.isLatest(first.requestId)).toBe(false);
    expect(requests.isLatest(second.requestId)).toBe(true);
    requests.abort();
    expect(second.controller.signal.aborted).toBe(true);
  });

  it('prevents duplicate synchronous mutation acquisition', () => {
    const lock = { current: false };
    expect(acquireWalletMutationLock(lock)).toBe(true);
    expect(acquireWalletMutationLock(lock)).toBe(false);
  });

  it('formats and adds financial decimals without Number precision loss', () => {
    expect(addDecimalStrings('9007199254740993.11', '0.89')).toBe('9007199254740994.00');
    expect(formatWalletBalance('9007199254740993.11', 'USD')).toBe(
      'USD 9,007,199,254,740,993.11',
    );
    expect(isZeroBalance('0.00')).toBe(true);
    expect(isZeroBalance('0.01')).toBe(false);
  });

  it('groups current-page balances by currency without conversion', () => {
    const totals = groupWalletBalances([
      wallet,
      { ...wallet, id: 'two', currency: 'USD', balance: '25.50' },
      { ...wallet, id: 'three', balance: '49.75' },
    ]);
    expect(totals).toEqual([
      { currency: 'INR', balance: '1050.00' },
      { currency: 'USD', balance: '25.5' },
    ]);
    expect(walletStatusCounts([wallet, { ...wallet, id: 'two', status: 'FROZEN' }]))
      .toEqual({ ACTIVE: 1, FROZEN: 1, CLOSED: 0 });
  });

  it('defensively normalizes invalid API wallet data', () => {
    expect(normalizeWallet(null)).toBeNull();
    expect(normalizeWallets({})).toEqual([]);
    const normalized = normalizeWallet({
      id: 'wallet', currency: null, balance: 'not-money', status: 'UNKNOWN',
      createdAt: null, user: null, _count: { deposits: -5, withdrawals: '2' },
    });
    expect(normalized).toMatchObject({
      id: 'wallet', currency: 'UNKNOWN', balance: '0.00', status: 'CLOSED',
      transactionCount: 2,
      user: { email: 'Email unavailable' },
    });
  });

  it('counts active filters and supports search, status, currency, rows and clear', () => {
    expect(activeWalletFilterCount({ ...DEFAULT_WALLET_FILTERS, search: 'a', currency: 'USD' })).toBe(2);
    const handlers = {
      onSearchInput: jest.fn(), onStatus: jest.fn(), onCurrency: jest.fn(),
      onLimit: jest.fn(), onSearch: jest.fn(), onClear: jest.fn(),
    };
    render(<WalletsFilterBar searchInput="" status="ALL" currency="ALL" currencies={['INR', 'USD']} limit={10} activeCount={1} disabled={false} {...handlers} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'owner' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'FROZEN' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(handlers.onSearchInput).toHaveBeenCalledWith('owner');
    expect(handlers.onStatus).toHaveBeenCalledWith('FROZEN');
    expect(handlers.onCurrency).toHaveBeenCalledWith('USD');
    expect(handlers.onLimit).toHaveBeenCalledWith(25);
    expect(handlers.onSearch).toHaveBeenCalled();
    expect(handlers.onClear).toHaveBeenCalled();
  });

  it('preserves rows during background refresh and renders loading/error/empty patterns', () => {
    const { rerender } = render(<WalletsTable wallets={[wallet]} initialLoading={false} filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText('Wallet Owner')).toBeTruthy();
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('false');
    rerender(<WalletsTable wallets={[]} initialLoading filtered={false} onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    rerender(<WalletsTable wallets={[]} initialLoading={false} filtered onDetails={jest.fn()} onClear={jest.fn()} />);
    expect(screen.getByText('No wallets match these filters')).toBeTruthy();
  });

  it('supports pagination controls', () => {
    const onPage = jest.fn();
    render(<WalletsPagination page={2} totalPages={3} total={30} start={11} end={20} hasPrevious hasNext disabled={false} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });

  it('renders accessible wallet details, focuses initially and closes on Escape', () => {
    const onClose = jest.fn();
    render(<WalletDetailsDialog open wallet={wallet} onClose={onClose} onStatus={jest.fn()} returnFocus={null} />);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close wallet details' }));
    expect(screen.getByText(/not complete transaction history/i)).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('offers status confirmation, reports mutation errors and confirms success action', () => {
    const onConfirm = jest.fn();
    render(<WalletStatusConfirmDialog wallet={wallet} status="CLOSED" open isUpdating={false} error="HTTP 400: balance must be zero" onCancel={jest.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText('Closing is irreversible.')).toBeTruthy();
    expect(screen.getByText('HTTP 400: balance must be zero')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('disables confirmation while mutating and makes closed wallets read-only', () => {
    const { unmount } = render(<WalletStatusConfirmDialog wallet={wallet} status="FROZEN" open isUpdating error="" onCancel={jest.fn()} onConfirm={jest.fn()} />);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Updating…' }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<WalletDetailsDialog open wallet={{ ...wallet, status: 'CLOSED' }} onClose={jest.fn()} onStatus={jest.fn()} returnFocus={null} />);
    expect(screen.getByText('Closed wallets are read-only and cannot be reactivated.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Activate wallet' })).toBeNull();
  });
});
