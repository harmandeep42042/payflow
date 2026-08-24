import { act, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { CustomerAppShell } from './customer-app-shell';
import { ConfirmationDialog, EmptyState, ErrorState, StatusBadge } from './ui';
import SummaryCards from '../../dashboard/components/SummaryCards';
import { getStoredUser } from '../../lib/api';

const replace = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace, refresh: jest.fn() }),
}));
jest.mock('../../dashboard/components/NotificationBell', () => () => <button aria-label="Notifications">Notifications</button>);
jest.mock('../../lib/api', () => ({
  getStoredUser: jest.fn(() => ({ id: 'user-1', firstName: 'Asha', lastName: 'Singh', email: 'asha@example.test', role: 'USER', status: 'ACTIVE' })),
  logoutUser: jest.fn(),
}));

describe('customer design system', () => {
  it('renders consistent desktop and mobile primary navigation', () => {
    render(<CustomerAppShell><p>Content</p></CustomerAppShell>);
    expect(screen.getAllByRole('navigation')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Home' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Scan / Pay' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'More' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#customer-content');
  });

  it('uses a deterministic identity until browser session state is synchronized', () => {
    const mockGetStoredUser = jest.mocked(getStoredUser);
    mockGetStoredUser.mockClear();
    const serverMarkup = renderToString(<CustomerAppShell><p>Content</p></CustomerAppShell>);
    expect(serverMarkup).toContain('Customer');
    expect(serverMarkup).not.toContain('Asha Singh');
    expect(mockGetStoredUser).not.toHaveBeenCalled();
    render(<CustomerAppShell><p>Content</p></CustomerAppShell>);
    expect(screen.getByText('Asha Singh')).toBeTruthy();
    act(() => window.dispatchEvent(new Event('payflow:auth-changed')));
    expect(screen.getByText('Asha Singh')).toBeTruthy();
  });

  it('keeps balances separated by currency', () => {
    render(<SummaryCards wallets={[
      { id: 'inr', balance: '100.10', currency: 'INR' },
      { id: 'usd', balance: '25.25', currency: 'USD' },
    ]} transactions={[]} />);
    const balance = screen.getByText(/INR 100\.10/).textContent ?? '';
    expect(balance).toContain('INR 100.10');
    expect(balance).toContain('USD 25.25');
  });

  it('provides semantic status and feedback states', () => {
    render(<><StatusBadge status="FAILED" /><EmptyState title="Nothing here" description="No records." /><ErrorState message="Request failed" /></>);
    expect(screen.getByText('FAILED').className).not.toContain('text-emerald-700');
    expect(screen.getByText('Nothing here')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Request failed');
  });

  it('supports Escape and labelled confirmation-dialog controls', () => {
    const onClose = jest.fn();
    render(<ConfirmationDialog open title="Confirm payment" description="Review payment" onClose={onClose} onConfirm={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Confirm payment' }).getAttribute('aria-modal')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
