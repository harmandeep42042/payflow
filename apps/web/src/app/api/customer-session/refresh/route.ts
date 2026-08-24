import { NextResponse } from 'next/server';
import type { PayflowUser } from '@payflow/shared-types';
import { clearToken, gateway, read, setToken, token, unwrap } from '../../../lib/customer-session.server';
import { singleFlightRefresh } from '../../../lib/refresh-single-flight.server';
type Tokens = { accessToken: string; refreshToken: string };
type Profile = { user: PayflowUser };
type RefreshOutcome = { status: number; body: unknown; refreshToken?: string };
export async function POST(request: Request): Promise<NextResponse> {
  const current = token(request); if (!current) return NextResponse.json({ message: 'Customer session is missing' }, { status: 401 });
  const outcome = await singleFlightRefresh<RefreshOutcome>(current, async () => {
    const refreshed = await gateway('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: current }) });
    const refreshedBody = await read(refreshed);
    if (!refreshed.ok) return { status: refreshed.status, body: refreshedBody };
    const tokens = unwrap<Tokens>(refreshedBody);
    const profileResponse = await gateway('/auth/profile', { method: 'GET', headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    const profileBody = await read(profileResponse);
    if (!profileResponse.ok) return { status: profileResponse.status, body: profileBody };
    const profile = unwrap<Profile>(profileBody);
    if (profile.user.role !== 'USER') return { status: 403, body: { message: 'Customer access is required' } };
    return { status: 200, body: { accessToken: tokens.accessToken, user: profile.user }, refreshToken: tokens.refreshToken };
  });
  const response = NextResponse.json(outcome.body, { status: outcome.status });
  if (outcome.refreshToken) setToken(response, outcome.refreshToken); else clearToken(response);
  return response;
}
