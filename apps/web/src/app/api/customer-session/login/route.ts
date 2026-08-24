import { NextResponse } from 'next/server';
import type { AdminLoginResponse } from '@payflow/shared-types';
import { clearToken, forward, gateway, publicSession, read, setToken, token, unwrap } from '../../../lib/customer-session.server';
export async function POST(request: Request): Promise<NextResponse> {
  const previous = token(request);
  if (previous) { try { await gateway('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: previous }) }); } catch { /* stale-session cleanup is best effort */ } }
  const response = await gateway('/auth/login', { method: 'POST', body: await request.text(), headers: { 'User-Agent': request.headers.get('user-agent') ?? '' } });
  const value = await read(response);
  if (!response.ok) { const failure = forward(response, value); clearToken(failure); return failure; }
  const login = unwrap<AdminLoginResponse>(value);
  if (login.user.role !== 'USER') {
    await gateway('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: login.refreshToken }) });
    const failure = NextResponse.json({ message: 'Only customers can access this application' }, { status: 403 }); clearToken(failure); return failure;
  }
  const success = NextResponse.json(publicSession(login)); setToken(success, login.refreshToken); return success;
}
