import {
  __resetAdminSessionForTests,
  adminAuthenticatedRequest,
  clearAdminSession,
  getAdminAccessToken,
  loginAdmin,
  logoutAdmin,
} from './api';

const adminUser = {
  id: 'admin-id',
  email: 'admin@payflow.test',
  firstName: 'Admin',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('Admin session API', () => {
  beforeEach(() => {
    __resetAdminSessionForTests();
    sessionStorage.clear();
    localStorage.clear();
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  it('keeps the access token in memory and stores no token in web storage', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse({ accessToken: 'access-1', user: adminUser }),
    );

    await loginAdmin(adminUser.email, 'secret');

    expect(getAdminAccessToken()).toBe('access-1');
    expect(localStorage.getItem('payflow_admin_access_token')).toBeNull();
    expect(localStorage.getItem('payflow_admin_refresh_token')).toBeNull();
    expect(sessionStorage.getItem('payflow_admin_user')).toContain(adminUser.email);
  });

  it('uses one refresh request for concurrent authenticated calls', async () => {
    const fetchMock = jest.mocked(global.fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/admin-session/refresh') {
        await Promise.resolve();
        return jsonResponse({ accessToken: 'access-2', user: adminUser });
      }
      return jsonResponse({ value: url });
    });

    await Promise.all([
      adminAuthenticatedRequest('/admin/users'),
      adminAuthenticatedRequest('/admin/wallets'),
    ]);

    expect(
      fetchMock.mock.calls.filter(([url]) => String(url) === '/api/admin-session/refresh'),
    ).toHaveLength(1);
  });

  it('refreshes on HTTP 401 and retries the original request once', async () => {
    const authorizationHeaders: string[] = [];
    jest.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/admin-session/login') {
        return jsonResponse({ accessToken: 'expired', user: adminUser });
      }
      if (url === '/api/admin-session/refresh') {
        return jsonResponse({ accessToken: 'fresh', user: adminUser });
      }
      authorizationHeaders.push(
        (init?.headers as Record<string, string> | undefined)?.Authorization ?? '',
      );
      return authorizationHeaders.length === 1
        ? jsonResponse({ message: 'expired' }, 401)
        : jsonResponse({ ok: true });
    });

    await loginAdmin(adminUser.email, 'secret');
    await expect(adminAuthenticatedRequest('/admin/dashboard')).resolves.toEqual({ ok: true });
    expect(authorizationHeaders).toEqual(['Bearer expired', 'Bearer fresh']);
  });

  it('calls the revocation boundary and clears local session state on logout', async () => {
    const fetchMock = jest.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'access-1', user: adminUser }))
      .mockResolvedValueOnce(jsonResponse({ message: 'Logout successful' }));

    await loginAdmin(adminUser.email, 'secret');
    await logoutAdmin();

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/admin-session/logout',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(getAdminAccessToken()).toBeNull();
    expect(sessionStorage.getItem('payflow_admin_user')).toBeNull();
  });

  it('removes legacy localStorage tokens during migration cleanup', () => {
    localStorage.setItem('payflow_admin_access_token', 'legacy');
    localStorage.setItem('payflow_admin_refresh_token', 'legacy');
    clearAdminSession();
    expect(localStorage.length).toBe(0);
  });

  it('stops refresh retries after a revoked admin session', async () => {
    const fetchMock = jest.mocked(global.fetch).mockResolvedValue(jsonResponse({ message: 'revoked' }, 401));

    await expect(adminAuthenticatedRequest('/admin/dashboard')).rejects.toMatchObject({ status: 401 });
    await expect(adminAuthenticatedRequest('/admin/users')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/admin-session/refresh')).toHaveLength(1);
  });

  it('allows admin login after a terminal refresh failure', async () => {
    jest.mocked(global.fetch)
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'fresh-admin', user: adminUser }));

    await expect(adminAuthenticatedRequest('/admin/dashboard')).rejects.toMatchObject({ status: 401 });
    await expect(loginAdmin(adminUser.email, 'secret')).resolves.toMatchObject({ accessToken: 'fresh-admin' });
  });
});
