import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SupportCasesAdminPage from './page';
import { adminAuthenticatedRequest } from '../lib/api';

jest.mock('../lib/api', () => ({
  adminAuthenticatedRequest: jest.fn(),
}));

jest.mock('../components/admin/page-header', () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
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

const supportCase = {
  id: 'case-1',
  userId: 'user-1',
  category: 'PAYMENT',
  description: 'Payment issue',
  transactionId: null,
  status: 'OPEN',
  priority: 'NORMAL',
  resolution: null,
  user: { email: 'customer@example.test' },
};

describe('Support cases admin mutation safety', () => {
  beforeEach(() => {
    request.mockReset();
    jest.spyOn(window, 'confirm').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('cancels a status mutation when confirmation is rejected', async () => {
    request.mockResolvedValueOnce([supportCase]);

    render(<SupportCasesAdminPage />);

    expect(await screen.findByText('PAYMENT')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /details.*resolve/i }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Support case case-1',
    });
    const status = within(dialog).getByLabelText('Status');

    fireEvent.change(status, { target: { value: 'IN_REVIEW' } });

    fireEvent.click(
      screen.getByRole('button', { name: /save case/i }),
    );

    expect(window.confirm).toHaveBeenCalled();

    expect(
      request.mock.calls.some(
        ([url, options]) =>
          String(url).includes('/support-cases/case-1') &&
          options?.method === 'PATCH',
      ),
    ).toBe(false);
  });

  it('PATCHes a confirmed support-case transition and reloads', async () => {
    request
      .mockResolvedValueOnce([supportCase])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([
        { ...supportCase, status: 'IN_REVIEW' },
      ]);

    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SupportCasesAdminPage />);

    expect(await screen.findByText('PAYMENT')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: /details.*resolve/i }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Support case case-1',
    });

    fireEvent.change(
      within(dialog).getByLabelText('Status'),
      { target: { value: 'IN_REVIEW' } },
    );

    fireEvent.click(
      screen.getByRole('button', { name: /save case/i }),
    );

    await waitFor(() => {
      expect(
        request.mock.calls.some(
          ([url, options]) =>
            String(url).includes('/support-cases/case-1') &&
            options?.method === 'PATCH',
        ),
      ).toBe(true);
    });

    expect(
      await screen.findByText(
        /Support case updated and the customer was notified/i,
      ),
    ).toBeTruthy();
  });
});