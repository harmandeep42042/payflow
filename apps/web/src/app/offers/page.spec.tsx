import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import OffersPage from './page';

const mockUserAuthenticatedRequest = jest.fn();

jest.mock('../lib/api', () => ({
  userAuthenticatedRequest: (...args: unknown[]) =>
    mockUserAuthenticatedRequest(...args),
}));

jest.mock('../components/customer', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),

  Card: ({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),

  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  ),

  ErrorState: ({ message }: { message: string }) => (
    <p>{message}</p>
  ),

  LoadingState: () => (
    <p>Loading...</p>
  ),

  PageContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,

  PageHeader: ({
    title,
    description,
    eyebrow,
    actions,
  }: {
    title: string;
    description: string;
    eyebrow: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),

  StatusBadge: ({ status }: { status: string }) => (
    <span>{status}</span>
  ),
}));

const offer = {
  id: 'offer-1',
  title: 'Welcome Cashback',
  description: 'A test cashback offer.',
  merchant: 'Payflow Merchant',
  category: 'Cashback',
  currency: 'INR',
  benefitDescription: '10% cashback',
  status: 'ACTIVE',
  startsAt: '2026-09-01T00:00:00.000Z',
  expiresAt: '2026-09-30T23:59:59.000Z',
  eligible: true,
  claims: [],
};

describe('OffersPage accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUserAuthenticatedRequest.mockResolvedValue([offer]);
  });

  it('moves focus into the dialog and restores focus after Escape', async () => {
    render(<OffersPage />);

    await waitFor(() => {
      expect(
        mockUserAuthenticatedRequest,
      ).toHaveBeenCalledWith('/customer-features/offers');
    });

    const detailsButton = await screen.findByRole('button', {
      name: 'Details',
    });

    detailsButton.focus();

    fireEvent.click(detailsButton);

    const dialog = await screen.findByRole('dialog', {
      name: 'Welcome Cashback',
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(dialog);
    });

    fireEvent.keyDown(document, {
      key: 'Escape',
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    expect(document.activeElement).toBe(detailsButton);
  });

  it('renders the dialog with the expected accessibility attributes', async () => {
    render(<OffersPage />);

    const detailsButton = await screen.findByRole('button', {
      name: 'Details',
    });

    fireEvent.click(detailsButton);

    const dialog = await screen.findByRole('dialog', {
      name: 'Welcome Cashback',
    });

    expect(dialog.getAttribute('aria-modal')).toBe('true');

    expect(dialog.getAttribute('aria-labelledby')).toBe('offer-title');

    expect(dialog.getAttribute('tabindex')).toBe('-1');
  });
});