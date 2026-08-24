import { NextResponse } from 'next/server';
import { clearToken, gateway, token } from '../../../lib/customer-session.server';
export async function POST(request: Request): Promise<NextResponse> {
  const current = token(request); if (current) { try { await gateway('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: current }) }); } catch { /* local logout must still complete */ } }
  const response = NextResponse.json({ message: 'Logout successful' }); clearToken(response); return response;
}
