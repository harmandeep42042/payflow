import {
  NextRequest,
  NextResponse,
} from 'next/server';

const walletServiceUrl =
  process.env.WALLET_SERVICE_INTERNAL_URL ??
  'http://localhost:4001/api/v1';

export async function GET(
  request: NextRequest,
) {
  const params =
    request.nextUrl.searchParams;

  const email =
    params.get('email') ?? '';

  const currency =
    params.get('currency') ?? 'INR';

  const excludeUserId =
    params.get('excludeUserId');

  const query =
    new URLSearchParams({
      email,
      currency,
    });

  if (excludeUserId) {
    query.set(
      'excludeUserId',
      excludeUserId,
    );
  }

  try {
    const response =
      await fetch(
        `${walletServiceUrl}/wallet-recipients/resolve?${query.toString()}`,
        {
          cache: 'no-store',
        },
      );

    const body =
      await response.json();

    return NextResponse.json(
      body,
      {
        status: response.status,
      },
    );
  } catch {
    return NextResponse.json(
      {
        message:
          'Wallet Service is unavailable',
      },
      {
        status: 503,
      },
    );
  }
}