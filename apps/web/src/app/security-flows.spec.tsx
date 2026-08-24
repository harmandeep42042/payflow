import { render, screen } from '@testing-library/react';
import UserLoginPage from './login/page';
import TransferResultPage from './transfer-success/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('./lib/api', () => ({
  loginUser: jest.fn(),
  restoreUserSession: jest.fn(() => Promise.reject(new Error('no session'))),
}));

describe('customer security UI', () => {
  it('starts login fields empty', () => {
    render(<UserLoginPage />);
    expect((screen.getByLabelText('Email address') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  });

  it('does not render a successful receipt from URL-controlled values', () => {
    window.history.replaceState({}, '', '/transfer-success?status=COMPLETED&amount=999999.00');
    render(<TransferResultPage />);
    expect(screen.queryByText('Payment Successful')).toBeNull();
    expect(screen.queryByText(/999999/)).toBeNull();
    expect(screen.getByText(/not a payment receipt/i)).toBeTruthy();
  });
});
