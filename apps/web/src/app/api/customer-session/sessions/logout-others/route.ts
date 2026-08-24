import { NextResponse } from 'next/server';
import { forward, gateway, read, token } from '../../../../lib/customer-session.server';

export async function POST(request: Request): Promise<NextResponse> {
  const refreshToken = token(request);
  if (!refreshToken) {
    return NextResponse.json({ message: 'Customer session is missing' }, { status: 401 });
  }

  const response = await gateway('/auth/sessions/logout-others', {
    method: 'POST',
    headers: { Authorization: request.headers.get('authorization') ?? '' },
    body: JSON.stringify({ refreshToken }),
  });

  return forward(response, await read(response));
}
