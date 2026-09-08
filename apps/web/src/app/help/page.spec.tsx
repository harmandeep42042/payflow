import {
  render,
  screen,
} from '@testing-library/react';

import HelpPage from './page';
import { userAuthenticatedRequest } from '../lib/api';

jest.mock('../lib/api', () => ({
  userAuthenticatedRequest: jest.fn(),
}));

jest.mock('../components/customer', () => ({
  PageContainer: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,

  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),

  Card: ({
    children,
  }: {
    children: React.ReactNode;
  }) => <div>{children}</div>,

  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),

  Field: ({
    id,
    name,
    label,
    placeholder,
  }: {
    id: string;
    name: string;
    label: string;
    placeholder?: string;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        placeholder={placeholder}
      />
    </div>
  ),

  SelectField: ({
    id,
    name,
    label,
    children,
  }: {
    id: string;
    name: string;
    label: string;
    children: React.ReactNode;
  }) => (
    <div>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={name}>
        {children}
      </select>
    </div>
  ),

  LoadingState: () => <div>Loading</div>,

  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <div>
      <div>{title}</div>
      {description ? <div>{description}</div> : null}
    </div>
  ),

  ErrorState: ({
    message,
  }: {
    message: string;
  }) => <div>{message}</div>,

  StatusBadge: ({
    status,
  }: {
    status: string;
  }) => <span>{status}</span>,
}));

describe('HelpPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(userAuthenticatedRequest).mockResolvedValue([]);
  });

  it('loads support cases and renders the safe empty state', async () => {
    render(<HelpPage />);

    expect(
      await screen.findByText('No support cases'),
    ).toBeTruthy();

    expect(
      screen.getByRole('heading', {
        name: 'Help and disputes',
      }),
    ).toBeTruthy();

    expect(
      screen.getByRole('button', {
        name: 'Create case',
      }),
    ).toBeTruthy();

    expect(userAuthenticatedRequest).toHaveBeenCalledWith(
      '/customer-features/support-cases',
    );

    expect(userAuthenticatedRequest).not.toHaveBeenCalledWith(
      '/customer-features/support-cases',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});