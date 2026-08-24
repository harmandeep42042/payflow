export type RecipientGatewayRequest = { path: string; authorization: string };

export function buildRecipientGatewayRequest(url: URL, authorization: string | null): RecipientGatewayRequest | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const output = new URLSearchParams();
  for (const key of ['email', 'phone', 'vpa', 'currency', 'excludeUserId']) {
    const value = url.searchParams.get(key)?.trim(); if (value) output.set(key, key === 'currency' ? value.toUpperCase() : value);
  }
  return { path: `/wallets/wallet-recipients/resolve?${output.toString()}`, authorization };
}
