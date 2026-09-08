import {
  UpiRailCapability,
  UpiRailProvider,
} from './upi-rail-provider';

export type UpiSecurityDecision = 'APPROVED' | 'DENIED';

export interface UpiSecurityContext {
  authenticatedUserId: string;
  accountActive: boolean;
  deviceSessionTrusted: boolean;
  riskDecision: UpiSecurityDecision;
  idempotencyKey: string;
}

export class UpiSecurityBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpiSecurityBoundaryError';
  }
}

export function assertSecureUpiExecution(
  rail: UpiRailProvider,
  requiredCapability: UpiRailCapability,
  context: UpiSecurityContext,
): void {
  if (!context.authenticatedUserId?.trim()) {
    throw new UpiSecurityBoundaryError(
      'Authenticated user context is required for UPI execution',
    );
  }

  if (!context.accountActive) {
    throw new UpiSecurityBoundaryError(
      'Active account is required for UPI execution',
    );
  }

  if (!context.deviceSessionTrusted) {
    throw new UpiSecurityBoundaryError(
      'Trusted device session is required for UPI execution',
    );
  }

  if (context.riskDecision !== 'APPROVED') {
    throw new UpiSecurityBoundaryError(
      'UPI execution denied by risk controls',
    );
  }

  if (!context.idempotencyKey?.trim()) {
    throw new UpiSecurityBoundaryError(
      'Idempotency key is required for UPI execution',
    );
  }

  if (!rail.isConfigured()) {
    throw new UpiSecurityBoundaryError(
      'Real UPI rail is not configured',
    );
  }

  if (!rail.getCapabilities().includes(requiredCapability)) {
    throw new UpiSecurityBoundaryError(
      `UPI rail does not support required capability: ${requiredCapability}`,
    );
  }
}