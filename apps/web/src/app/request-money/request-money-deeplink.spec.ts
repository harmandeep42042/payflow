import {
  getRequestMoneyDeepLink,
  getRequestMoneyNotificationHref,
} from './request-money-deeplink';

const requestId =
  '11111111-2222-4333-8444-555555555555';

describe('Request Money deep links', () => {
  it('reads a valid request query parameter', () => {
    expect(
      getRequestMoneyDeepLink(
        new URLSearchParams(
          `request=${requestId}`,
        ),
      ),
    ).toBe(requestId);
  });

  it('rejects missing and unsafe request ids', () => {
    expect(
      getRequestMoneyDeepLink(
        new URLSearchParams(),
      ),
    ).toBeNull();

    expect(
      getRequestMoneyDeepLink(
        new URLSearchParams(
          'request=../../danger',
        ),
      ),
    ).toBeNull();
  });

  it('creates a deep link from notification metadata', () => {
    expect(
      getRequestMoneyNotificationHref({
        requestId,
      }),
    ).toBe(
      `/request-money?request=${requestId}`,
    );
  });

  it('supports nested event payload metadata', () => {
    expect(
      getRequestMoneyNotificationHref({
        payload: {
          requestId,
        },
      }),
    ).toBe(
      `/request-money?request=${requestId}`,
    );
  });

  it('supports serialized metadata', () => {
    expect(
      getRequestMoneyNotificationHref(
        JSON.stringify({
          requestId,
        }),
      ),
    ).toBe(
      `/request-money?request=${requestId}`,
    );
  });

  it('does not create links without a safe request id', () => {
    expect(
      getRequestMoneyNotificationHref({}),
    ).toBeNull();

    expect(
      getRequestMoneyNotificationHref({
        requestId: '../bad',
      }),
    ).toBeNull();
  });
});
