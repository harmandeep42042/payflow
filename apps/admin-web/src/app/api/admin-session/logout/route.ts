import { NextResponse } from 'next/server';

import {
  clearRefreshTokenCookie,
  gatewayRequest,
  getRefreshTokenCookie,
} from '../../../lib/admin-session.server';

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const refreshToken =
    getRefreshTokenCookie(request);

  if (refreshToken) {
    try {
      await gatewayRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Local logout must still complete if Auth Service is unavailable.
    }
  }

  const response = NextResponse.json({
    message: 'Logout successful',
  });
  clearRefreshTokenCookie(response);
  return response;
}
