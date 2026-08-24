import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ReceivePage from './page';
import { userAuthenticatedRequest } from '../lib/api';

jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('next/image', () => ({ __esModule: true, default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }));
jest.mock('../lib/api', () => ({
  API_GATEWAY_URL: 'http://localhost:4000/api/v1',
  getUserAccessToken: jest.fn(),
  getStoredUser: () => ({ id: 'customer-1' }),
  userAuthenticatedRequest: jest.fn(),
}));

describe('ReceivePage', () => {
  it('renders a responsive QR, wallet, VPA and accessible copy action', async () => {
    jest.mocked(userAuthenticatedRequest).mockImplementation(async (path) => {
      if (String(path).startsWith('/wallets/user/')) {
        return [{ id: 'wallet-1', currency: 'INR', status: 'ACTIVE' }];
      }
      return {
        qr: { payload: 'payflow://pay', dataUrl: 'data:image/png;base64,AA==' },
        recipient: { displayName: 'Customer', vpa: 'customer@payflow', email: 'customer@example.test', currency: 'INR', walletStatus: 'ACTIVE' },
      };
    });
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<ReceivePage />);

    expect(await screen.findByText('customer@payflow')).toBeTruthy();
    expect(screen.getByText('wallet-1')).toBeTruthy();
    expect(screen.getByAltText('Payflow QR for customer@payflow')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copy payment address' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('customer@payflow'));
    expect(screen.getByText('Payment address copied')).toBeTruthy();
  });
});
