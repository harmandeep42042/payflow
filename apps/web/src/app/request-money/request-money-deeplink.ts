const REQUEST_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown =
        JSON.parse(value);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<
          string,
          unknown
        >;
      }
    }
    catch {
      return null;
    }
  }

  return null;
}

function safeRequestId(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return REQUEST_ID.test(trimmed)
    ? trimmed
    : null;
}

export function getRequestMoneyDeepLink(
  params: URLSearchParams,
): string | null {
  return safeRequestId(
    params.get('request'),
  );
}

export function getRequestMoneyNotificationHref(
  metadata: unknown,
): string | null {
  const record =
    recordValue(metadata);

  if (!record) {
    return null;
  }

  const nestedPayload =
    recordValue(record.payload);

  const nestedData =
    recordValue(record.data);

  const requestId =
    safeRequestId(
      record.requestId ??
        nestedPayload?.requestId ??
        nestedData?.requestId,
    );

  if (!requestId) {
    return null;
  }

  return (
    '/request-money?request=' +
    encodeURIComponent(requestId)
  );
}
