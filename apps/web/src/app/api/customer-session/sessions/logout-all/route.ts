import { NextResponse } from 'next/server';
import { clearToken, forward, gateway, read } from '../../../../lib/customer-session.server';

export async function DELETE(request: Request): Promise<NextResponse> {
  const response = await gateway('/auth/sessions', {
    method: 'DELETE',
    headers: { Authorization: request.headers.get('authorization') ?? '' },
  });
  const result = forward(response, await read(response));
  if (response.ok) clearToken(result);
  return result;
}
