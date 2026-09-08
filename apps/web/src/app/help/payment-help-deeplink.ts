const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeTransactionId(
  value: string | null | undefined,
): string | null {
  const normalized =
    value?.trim();

  if (
    !normalized ||
    !UUID.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function getPaymentHelpTransactionId(
  params: URLSearchParams,
): string | null {
  return safeTransactionId(
    params.get('transactionId'),
  );
}

export function buildPaymentHelpHref(
  transactionId: string,
): string | null {
  const safe =
    safeTransactionId(
      transactionId,
    );

  if (!safe) {
    return null;
  }

  return (
    '/help?transactionId=' +
    encodeURIComponent(safe)
  );
}
