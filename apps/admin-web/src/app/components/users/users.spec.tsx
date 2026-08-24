import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  activeUsersFilterCount,
  acquireMutationLock,
  buildUsersQuery,
  buildUsersUrlQuery,
  clearUsersFilters,
  DEFAULT_USERS_FILTERS,
  formatCurrencyAmount,
  getUserDisplayName,
  getWalletBalances,
  LatestUsersRequest,
  normalizeUsersPage,
  parseUsersFilters,
} from './helpers';
import { UserDetailsDialog } from './user-details-dialog';
import { UserStatusConfirmDialog } from './user-status-confirm-dialog';
import { UsersFilterBar } from './users-filter-bar';
import { UsersPagination } from './users-pagination';
import { UsersTable } from './users-table';
import type { AdminUserDetails, AdminUserItem } from './types';

const user: AdminUserDetails = {
  id: '12345678-1234-1234-1234-123456789012',
  email: 'user@payflow.test',
  phone: null,
  firstName: 'Payflow',
  lastName: 'User',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  wallets: [],
  walletCount: 0,
  totalWalletBalance: '0.00',
};

describe('Users management components', () => {
  it('builds the existing API query with default and applied filters', () => {
    expect(buildUsersQuery(DEFAULT_USERS_FILTERS)).toBe(
      'page=1&limit=10&search=&status=ALL&role=ALL',
    );
    expect(
      buildUsersQuery({
        search: 'alice',
        status: 'BLOCKED',
        role: 'USER',
        page: 2,
        limit: 25,
      }),
    ).toBe('page=2&limit=25&search=alice&status=BLOCKED&role=USER');
  });

  it('counts active filters and safely falls back for a missing name', () => {
    expect(
      activeUsersFilterCount({ search: 'a', status: 'ACTIVE', role: 'ALL' }),
    ).toBe(2);
    expect(getUserDisplayName({ ...user, firstName: '', lastName: null })).toBe(
      user.email,
    );
  });

  it('parses back/forward URL state including pageSize', () => {
    const filters = parseUsersFilters(
      new URLSearchParams(
        'search=lee&status=SUSPENDED&role=USER&page=3&pageSize=50',
      ),
    );
    expect(filters).toEqual({
      search: 'lee',
      status: 'SUSPENDED',
      role: 'USER',
      page: 3,
      limit: 50,
    });
    expect(buildUsersUrlQuery(filters)).toContain('pageSize=50');
  });

  it('cancels stale requests and only accepts the latest request', () => {
    const requests = new LatestUsersRequest();
    const first = requests.begin();
    const second = requests.begin();
    expect(first.controller.signal.aborted).toBe(true);
    expect(requests.isLatest(first.requestId)).toBe(false);
    expect(requests.isLatest(second.requestId)).toBe(true);
  });

  it('normalizes invalid pages and preserves page size when clearing', () => {
    expect(normalizeUsersPage(8, 3)).toBe(3);
    expect(normalizeUsersPage(8, 0)).toBe(8);
    expect(
      clearUsersFilters({
        search: 'a',
        status: 'ACTIVE',
        role: 'USER',
        page: 4,
        limit: 50,
      }),
    ).toEqual({ ...DEFAULT_USERS_FILTERS, limit: 50 });
  });

  it('prevents duplicate synchronous mutation acquisition', () => {
    const lock = { current: false };
    expect(acquireMutationLock(lock)).toBe(true);
    expect(acquireMutationLock(lock)).toBe(false);
  });

  it('groups wallet balances without currency conversion', () => {
    const balances = getWalletBalances([
      {
        id: '1',
        currency: 'INR',
        balance: '100',
        status: 'ACTIVE',
        createdAt: '',
      },
      {
        id: '2',
        currency: 'USD',
        balance: '25',
        status: 'ACTIVE',
        createdAt: '',
      },
      {
        id: '3',
        currency: 'INR',
        balance: '50',
        status: 'ACTIVE',
        createdAt: '',
      },
    ]);
    expect(balances).toEqual([
      { currency: 'INR', amount: '150.00' },
      { currency: 'USD', amount: '25.00' },
    ]);
    expect(formatCurrencyAmount('INR', '150.00')).not.toEqual(
      formatCurrencyAmount('USD', '150.00'),
    );
    expect(getWalletBalances([{ id: 'large', currency: 'USD', balance: '9007199254740993.11', status: 'ACTIVE', createdAt: '' }, { id: 'small', currency: 'USD', balance: '0.89', status: 'ACTIVE', createdAt: '' }]))
      .toEqual([{ currency: 'USD', amount: '9007199254740994.00' }]);
  });

  it('supports search, status, role, page size, and clear controls', () => {
    const handlers = {
      onSearchInput: jest.fn(),
      onStatus: jest.fn(),
      onRole: jest.fn(),
      onLimit: jest.fn(),
      onSearch: jest.fn(),
      onClear: jest.fn(),
    };
    render(
      <UsersFilterBar
        searchInput=""
        status="ALL"
        role="ALL"
        limit={10}
        activeCount={1}
        disabled={false}
        {...handlers}
      />,
    );
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'alice' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'BLOCKED' },
    });
    fireEvent.change(screen.getByLabelText('Role'), {
      target: { value: 'ADMIN' },
    });
    fireEvent.change(screen.getByLabelText('Rows'), {
      target: { value: '25' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(handlers.onSearchInput).toHaveBeenCalledWith('alice');
    expect(handlers.onStatus).toHaveBeenCalledWith('BLOCKED');
    expect(handlers.onRole).toHaveBeenCalledWith('ADMIN');
    expect(handlers.onLimit).toHaveBeenCalledWith(25);
    expect(handlers.onSearch).toHaveBeenCalled();
    expect(handlers.onClear).toHaveBeenCalled();
  });

  it('renders loading, filtered empty, and populated table states', () => {
    const { rerender } = render(
      <UsersTable
        users={[]}
        initialLoading
        filtered={false}
        onDetails={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
    rerender(
      <UsersTable
        users={[]}
        initialLoading={false}
        filtered
        onDetails={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByText('No users match these filters')).toBeTruthy();
    rerender(
      <UsersTable
        users={[user as AdminUserItem]}
        initialLoading={false}
        filtered={false}
        onDetails={jest.fn()}
        onClear={jest.fn()}
      />,
    );
    expect(screen.getByText('Payflow User')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('handles pagination enablement', () => {
    const onPage = jest.fn();
    render(
      <UsersPagination
        page={2}
        totalPages={3}
        total={30}
        start={11}
        end={20}
        hasPrevious
        hasNext
        disabled={false}
        onPage={onPage}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenNthCalledWith(1, 1);
    expect(onPage).toHaveBeenNthCalledWith(2, 3);
  });

  it('provides accessible dialog loading, error retry, and Escape dismissal', () => {
    const onClose = jest.fn();
    const onRetry = jest.fn();
    const { rerender } = render(
      <UserDetailsDialog
        open
        user={null}
        isLoading
        error=""
        onClose={onClose}
        onRetry={onRetry}
        onStatus={jest.fn()}
        returnFocus={null}
      />,
    );
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    rerender(
      <UserDetailsDialog
        open
        user={null}
        isLoading={false}
        error="HTTP 404: missing"
        onClose={onClose}
        onRetry={onRetry}
        onStatus={jest.fn()}
        returnFocus={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps dialog focus stable across ordinary rerenders', () => {
    const onClose = jest.fn();
    const onRetry = jest.fn();
    const onStatus = jest.fn();
    const { rerender } = render(
      <UserDetailsDialog
        open
        user={user}
        isLoading={false}
        error=""
        onClose={onClose}
        onRetry={onRetry}
        onStatus={onStatus}
        returnFocus={null}
      />,
    );
    const copy = screen.getByRole('button', { name: 'Copy' });
    copy.focus();
    rerender(
      <UserDetailsDialog
        open
        user={user}
        isLoading={false}
        error=""
        onClose={onClose}
        onRetry={onRetry}
        onStatus={onStatus}
        returnFocus={null}
      />,
    );
    expect(document.activeElement).toBe(copy);
  });

  it('reports clipboard success and failure accessibly', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const props = {
      open: true,
      user,
      isLoading: false,
      error: '',
      onClose: jest.fn(),
      onRetry: jest.fn(),
      onStatus: jest.fn(),
      returnFocus: null,
    };
    const { rerender } = render(<UserDetailsDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await screen.findByText('User ID copied.');
    expect(writeText).toHaveBeenCalledWith(user.id);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
    });
    rerender(
      <UserDetailsDialog
        {...props}
        user={{ ...user, id: `${user.id}-next` }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() =>
      expect(screen.getByText(/Unable to copy user ID/)).toBeTruthy(),
    );
  });

  it('restricts Admin status actions and confirms or cancels mutations', () => {
    render(
      <UserDetailsDialog
        open
        user={{ ...user, role: 'ADMIN' }}
        isLoading={false}
        error=""
        onClose={jest.fn()}
        onRetry={jest.fn()}
        onStatus={jest.fn()}
        returnFocus={null}
      />,
    );
    expect(
      screen.getByText('Admin account status cannot be changed here.'),
    ).toBeTruthy();
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(
      <UserStatusConfirmDialog
        user={user}
        status="BLOCKED"
        open
        isUpdating={false}
        error=""
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
    expect(screen.getByText(/refresh sessions will be revoked/i)).toBeTruthy();
  });

  it('shows failed mutation feedback and disables mutation controls', () => {
    render(
      <UserStatusConfirmDialog
        user={user}
        status="SUSPENDED"
        open
        isUpdating
        error="HTTP 409: update failed"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    expect(screen.getByText('HTTP 409: update failed')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: /Updating/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
