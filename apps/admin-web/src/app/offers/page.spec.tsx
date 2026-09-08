import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OffersAdminPage from './page';
import { adminAuthenticatedRequest } from '../lib/api';

jest.mock('../lib/api', () => ({
  adminAuthenticatedRequest: jest.fn(),
}));

jest.mock('../components/admin/page-header', () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {actions}
    </header>
  ),
}));

jest.mock('../components/admin/accessible-dialog', () => ({
  AccessibleDialog: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <section role="dialog" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

const request = adminAuthenticatedRequest as jest.MockedFunction<
  typeof adminAuthenticatedRequest
>;

const offer = {
  id: 'offer-1',
  title: 'Test offer',
  description: 'Test description',
  merchant: 'Test merchant',
  category: 'GENERAL',
  currency: 'INR',
  benefitDescription: 'Test benefit',
  status: 'ACTIVE',
  startsAt: '2030-01-01T00:00:00.000Z',
  expiresAt: '2030-12-31T00:00:00.000Z',
  usageLimit: 10,
  _count: { claims: 0 },
};

describe('Offers admin mutation safety', () => {
  beforeEach(() => {
    request.mockReset();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not mutate offer status when confirmation is cancelled', async () => {
    request.mockResolvedValueOnce([offer]);

    render(<OffersAdminPage />);

    expect(await screen.findByText('Test offer')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /deactivate/i }),
    );

    expect(window.confirm).toHaveBeenCalled();

    expect(
      request.mock.calls.some(
        ([url, options]) =>
          String(url).includes('/offers/offer-1') &&
          options?.method === 'PATCH',
      ),
    ).toBe(false);
  });

  it('performs the confirmed status PATCH and reloads safely', async () => {
    request
      .mockResolvedValueOnce([offer])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([{ ...offer, status: 'INACTIVE' }]);

    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<OffersAdminPage />);

    expect(await screen.findByText('Test offer')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /deactivate/i }),
    );

    await waitFor(() => {
      expect(
        request.mock.calls.some(
          ([url, options]) =>
            String(url).includes('/offers/offer-1') &&
            options?.method === 'PATCH',
        ),
      ).toBe(true);
    });

    expect(
      await screen.findByText(/Offer inactive/i),
    ).toBeTruthy();
  });
});