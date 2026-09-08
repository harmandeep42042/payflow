import {
  assertSecureUpiExecution,
  UpiSecurityBoundaryError,
  UpiSecurityContext,
} from './upi-security-boundary';

import {
  UpiRailCapability,
  UpiRailProvider,
} from './upi-rail-provider';

function context(
  overrides: Partial<UpiSecurityContext> = {},
): UpiSecurityContext {
  return {
    authenticatedUserId: 'user-test',
    accountActive: true,
    deviceSessionTrusted: true,
    riskDecision: 'APPROVED',
    idempotencyKey: 'upi:test:idempotency',
    ...overrides,
  };
}

function rail(
  configured = true,
  capabilities: UpiRailCapability[] = ['PAY'],
): UpiRailProvider {
  return {
    name: configured ? 'PSP' : 'UNCONFIGURED',

    isConfigured: () => configured,

    getCapabilities: () => capabilities,

    resolveVpa: jest.fn(),

    initiatePay: jest.fn(),

    initiateCollect: jest.fn(),

    queryTransaction: jest.fn(),

    reverseTransaction: jest.fn(),
  };
}

describe('UPI security boundary', () => {
  it('allows an approved secure execution context', () => {
    expect(() =>
      assertSecureUpiExecution(rail(), 'PAY', context()),
    ).not.toThrow();
  });

  it('rejects unauthenticated execution', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(),
        'PAY',
        context({ authenticatedUserId: '' }),
      ),
    ).toThrow(UpiSecurityBoundaryError);
  });

  it('rejects inactive accounts', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(),
        'PAY',
        context({ accountActive: false }),
      ),
    ).toThrow(UpiSecurityBoundaryError);
  });

  it('rejects untrusted device sessions', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(),
        'PAY',
        context({ deviceSessionTrusted: false }),
      ),
    ).toThrow(UpiSecurityBoundaryError);
  });

  it('rejects risk-denied execution', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(),
        'PAY',
        context({ riskDecision: 'DENIED' }),
      ),
    ).toThrow(UpiSecurityBoundaryError);
  });

  it('requires an idempotency key', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(),
        'PAY',
        context({ idempotencyKey: '' }),
      ),
    ).toThrow(UpiSecurityBoundaryError);
  });

  it('rejects an unconfigured real UPI rail', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(false, []),
        'PAY',
        context(),
      ),
    ).toThrow('Real UPI rail is not configured');
  });

  it('rejects unsupported UPI capabilities', () => {
    expect(() =>
      assertSecureUpiExecution(
        rail(true, ['STATUS_QUERY']),
        'PAY',
        context(),
      ),
    ).toThrow('UPI rail does not support required capability');
  });
});