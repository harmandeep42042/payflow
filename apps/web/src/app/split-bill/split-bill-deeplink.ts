const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function recordValue(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

function safeUuid(
  value: unknown,
): string | null {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return UUID.test(normalized)
    ? normalized
    : null;
}

export type SplitBillDeepLink = {
  splitId: string;
  allocationId: string | null;
};

export function getSplitBillDeepLink(
  params: URLSearchParams,
): SplitBillDeepLink | null {
  const splitId =
    safeUuid(
      params.get('split'),
    );

  if (!splitId) {
    return null;
  }

  return {
    splitId,
    allocationId:
      safeUuid(
        params.get(
          'allocation',
        ),
      ),
  };
}

export function getSplitBillNotificationHref(
  value: unknown,
): string | null {
  const record =
    recordValue(value);

  if (!record) {
    return null;
  }

  const metadata =
    recordValue(
      record.metadata,
    );

  const payload =
    recordValue(
      record.payload,
    );

  const data =
    recordValue(
      record.data,
    );

  const metadataPayload =
    recordValue(
      metadata?.payload,
    );

  const metadataData =
    recordValue(
      metadata?.data,
    );

  const splitId =
    safeUuid(
      metadata?.splitId ??
        metadataPayload?.splitId ??
        metadataData?.splitId ??
        record.splitId ??
        payload?.splitId ??
        data?.splitId,
    );

  if (!splitId) {
    return null;
  }

  const allocationId =
    safeUuid(
      metadata?.allocationId ??
        metadataPayload?.allocationId ??
        metadataData?.allocationId ??
        record.allocationId ??
        payload?.allocationId ??
        data?.allocationId,
    );

  let href =
    '/split-bill?split=' +
    encodeURIComponent(
      splitId,
    );

  if (allocationId) {
    href +=
      '&allocation=' +
      encodeURIComponent(
        allocationId,
      );
  }

  return href;
}
