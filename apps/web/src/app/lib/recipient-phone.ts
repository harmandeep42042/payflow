export function normalizeRecipientPhone(
  input: string,
): string | null {
  const compact = input
    .trim()
    .replace(/[\s()-]/g, '');

  if (!/^\+?[1-9]\d{7,14}$/.test(compact)) {
    return null;
  }

  return compact;
}

export function getRecipientPhoneShortcut(
  params: URLSearchParams,
): string | null {
  if (params.get('qr') === '1') {
    return null;
  }

  return normalizeRecipientPhone(
    params.get('phone') ?? '',
  );
}
