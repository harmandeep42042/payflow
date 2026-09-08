import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { InternalSettlementAuthGuard } from './internal-settlement-auth.guard';

describe('InternalSettlementAuthGuard', () => {
  const originalToken = process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN;
    } else {
      process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN = originalToken;
    }
  });

  function contextWithToken(token?: string) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers:
            token === undefined
              ? {}
              : {
                  'x-payflow-service-token': token,
                },
        }),
      }),
    };
  }

  it('accepts exact internal service token', () => {
    process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN = 'test-secret';

    const guard = new InternalSettlementAuthGuard();

    expect(guard.canActivate(contextWithToken('test-secret') as never)).toBe(
      true,
    );
  });

  it('rejects incorrect service token', () => {
    process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN = 'test-secret';

    const guard = new InternalSettlementAuthGuard();

    expect(() =>
      guard.canActivate(contextWithToken('wrong-secret') as never),
    ).toThrow(UnauthorizedException);
  });

  it('rejects missing request token', () => {
    process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN = 'test-secret';

    const guard = new InternalSettlementAuthGuard();

    expect(() => guard.canActivate(contextWithToken() as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when server token is not configured', () => {
    delete process.env.PAYMENT_SETTLEMENT_INTERNAL_TOKEN;

    const guard = new InternalSettlementAuthGuard();

    expect(() =>
      guard.canActivate(contextWithToken('anything') as never),
    ).toThrow(ServiceUnavailableException);
  });
});
