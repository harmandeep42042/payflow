import { Injectable } from '@nestjs/common';

import {
  InitiateUpiCollectInput,
  InitiateUpiPayInput,
  QueryUpiTransactionInput,
  ResolveUpiVpaInput,
  ReverseUpiTransactionInput,
  UpiRailCapability,
  UpiRailProvider,
} from './upi-rail-provider';

@Injectable()
export class UnconfiguredUpiRailAdapter
  implements UpiRailProvider
{
  readonly name = 'UNCONFIGURED' as const;

  isConfigured(): boolean {
    return false;
  }

  getCapabilities(): readonly UpiRailCapability[] {
    return [];
  }

  async resolveVpa(
    _input: ResolveUpiVpaInput,
  ): Promise<never> {
    throw this.notConfigured();
  }

  async initiatePay(
    _input: InitiateUpiPayInput,
  ): Promise<never> {
    throw this.notConfigured();
  }

  async initiateCollect(
    _input: InitiateUpiCollectInput,
  ): Promise<never> {
    throw this.notConfigured();
  }

  async queryTransaction(
    _input: QueryUpiTransactionInput,
  ): Promise<never> {
    throw this.notConfigured();
  }

  async reverseTransaction(
    _input: ReverseUpiTransactionInput,
  ): Promise<never> {
    throw this.notConfigured();
  }

  private notConfigured(): Error {
    return new Error(
      'Real UPI rail is not configured. PSP or sponsor-bank integration is required.',
    );
  }
}