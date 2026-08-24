import { __resetCustomerSessionForTests, clearUserSession, CustomerApiError, getUserRefreshToken, loginUser, logoutUser, saveUserSession, userApiRequest, userAuthenticatedRequest } from './api';

const user = { id: 'user-1', email: 'user@example.test', firstName: 'User', role: 'USER' as const, status: 'ACTIVE' as const };
const json = (value: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(value) }) as Response;

describe('customer API session', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); __resetCustomerSessionForTests(); Object.defineProperty(global, 'fetch', { value: jest.fn(), configurable: true, writable: true }); });

  it('notifies same-tab consumers when the customer session is cleared', () => {
    const listener = jest.fn();
    window.addEventListener('payflow:auth-changed', listener);
    localStorage.setItem('payflow_user_profile', JSON.stringify(user));

    clearUserSession();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('payflow:auth-changed', listener);
  });

  it('never persists access or refresh tokens in browser storage', () => {
    saveUserSession({ accessToken: 'access-secret', user });
    expect(localStorage.getItem('payflow_user_access_token')).toBeNull();
    expect(localStorage.getItem('payflow_user_refresh_token')).toBeNull();
    expect(sessionStorage.getItem('payflow_user_access_token')).toBeNull();
    expect(getUserRefreshToken()).toBeNull();
  });

  it('restores through the HttpOnly-cookie refresh route and makes one authenticated request', async () => {
    const fetchMock = jest.mocked(global.fetch)
      .mockResolvedValueOnce(json({ accessToken: 'new-access', user }))
      .mockResolvedValueOnce(json({ ok: true }));
    await expect(userAuthenticatedRequest<{ ok: boolean }>('/wallets/user/user-1')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/customer-session/refresh');
    expect(String((fetchMock.mock.calls[1][1]?.headers as Record<string, string>).Authorization)).toBe('Bearer new-access');
  });

  it.each([400, 403, 404, 409, 500])('preserves HTTP status %s and structured errors', async (status) => {
    jest.mocked(global.fetch).mockResolvedValue(json({ statusCode: status, message: ['problem'], error: 'Code' }, status));
    await expect(userApiRequest('/failure')).rejects.toMatchObject<CustomerApiError>({ status, message: 'problem', details: { statusCode: status } });
  });

  it('clears local state and calls backend logout route', async () => {
    saveUserSession({ accessToken: 'access-secret', user });
    const fetchMock = jest.mocked(global.fetch).mockResolvedValue(json({ message: 'ok' }));
    await logoutUser();
    expect(fetchMock).toHaveBeenCalledWith('/api/customer-session/logout', expect.objectContaining({ method: 'POST' }));
    expect(localStorage.getItem('payflow_user_profile')).toBeNull();
  });

  it('uses one refresh for concurrent notification requests that receive 401', async () => {
    saveUserSession({ accessToken: 'expired-access', user });
    let refreshCalls = 0;
    const fetchMock = jest.mocked(global.fetch).mockImplementation(async (input, init) => {
      if (input === '/api/customer-session/refresh') {
        refreshCalls += 1;
        return json({ accessToken: 'fresh-access', user });
      }
      const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization;
      return authorization === 'Bearer expired-access'
        ? json({ message: 'expired' }, 401)
        : json({ ok: true });
    });

    await expect(Promise.all([
      userAuthenticatedRequest('/notifications'),
      userAuthenticatedRequest('/notifications?limit=10'),
    ])).resolves.toEqual([{ ok: true }, { ok: true }]);

    expect(refreshCalls).toBe(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/customer-session/refresh')).toHaveLength(1);
  });

  it('clears the customer profile when refresh fails', async () => {
    localStorage.setItem('payflow_user_profile', JSON.stringify(user));
    jest.mocked(global.fetch).mockResolvedValue(json({ message: 'expired refresh session' }, 401));

    await expect(userAuthenticatedRequest('/notifications')).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem('payflow_user_profile')).toBeNull();
  });

  it.each([401, 403])('stops refreshing after terminal refresh status %s', async (status) => {
    const fetchMock = jest.mocked(global.fetch).mockResolvedValue(json({ message: 'refresh rejected' }, status));

    await expect(userAuthenticatedRequest('/notifications')).rejects.toMatchObject({ status });
    await expect(userAuthenticatedRequest('/wallets')).rejects.toMatchObject({ status });

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/customer-session/refresh')).toHaveLength(1);
  });

  it('allows a fresh manual login after a failed refresh', async () => {
    const fetchMock = jest.mocked(global.fetch)
      .mockResolvedValueOnce(json({ message: 'revoked' }, 401))
      .mockResolvedValueOnce(json({ accessToken: 'fresh-login', user }));

    await expect(userAuthenticatedRequest('/notifications')).rejects.toMatchObject({ status: 401 });
    await expect(loginUser(user.email, 'secret')).resolves.toMatchObject({ accessToken: 'fresh-login' });
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/customer-session/refresh')).toHaveLength(1);
  });
});
