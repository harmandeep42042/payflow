jest.mock('next/server', () => ({ NextResponse: {} }));

import { clearToken, setToken, token } from './customer-session.server';

function cookieResponse() {
  const values: unknown[] = [];
  return { response: { cookies: { set: (value: unknown) => values.push(value) } }, values };
}

describe('customer refresh cookie', () => {
  it('sets an HttpOnly strict same-site cookie without exposing it in session data', () => {
    const { response, values } = cookieResponse();
    setToken(response as never, 'refresh-secret');

    expect(values).toEqual([expect.objectContaining({
      name: 'payflow_customer_refresh_token', value: 'refresh-secret',
      httpOnly: true, sameSite: 'strict', path: '/',
    })]);
    expect({ accessToken: 'public-access' }).not.toHaveProperty('refreshToken');
  });

  it('reads only the intended cookie and can expire it', () => {
    const request = {
      headers: { get: () => 'other=value; payflow_customer_refresh_token=encoded%3Dtoken' },
    };
    expect(token(request as Request)).toBe('encoded=token');
    const { response, values } = cookieResponse();
    clearToken(response as never);
    expect(values).toEqual([expect.objectContaining({ maxAge: 0, value: '' })]);
  });
});
