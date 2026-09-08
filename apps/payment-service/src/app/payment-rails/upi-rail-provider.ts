export type UpiRailProviderName =
  | 'UNCONFIGURED'
  | 'PSP'
  | 'SPONSOR_BANK';

export type UpiRailCapability =
  | 'PAY'
  | 'COLLECT'
  | 'VPA_RESOLUTION'
  | 'STATUS_QUERY'
  | 'REVERSAL';

export type UpiTransactionState =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'SUCCESS'
  | 'FAILED'
  | 'REVERSED'
  | 'NEEDS_REVIEW';

export interface ResolveUpiVpaInput {
  vpa: string;
}

export interface ResolveUpiVpaResult {
  provider: UpiRailProviderName;
  vpa: string;
  valid: boolean;
  accountHolderName?: string;
  raw?: unknown;
}

export interface InitiateUpiPayInput {
  clientTransactionId: string;
  payerVpa?: string;
  payeeVpa: string;
  amountMinor: number;
  currency: string;
  note?: string;
}

export interface InitiateUpiCollectInput {
  clientTransactionId: string;
  payerVpa: string;
  payeeVpa: string;
  amountMinor: number;
  currency: string;
  note?: string;
  expiresAt?: Date;
}

export interface UpiTransactionResult {
  provider: UpiRailProviderName;
  clientTransactionId: string;
  providerTransactionId?: string;
  state: UpiTransactionState;
  amountMinor: number;
  currency: string;
  payerVpa?: string;
  payeeVpa?: string;
  raw?: unknown;
}

export interface QueryUpiTransactionInput {
  clientTransactionId: string;
  providerTransactionId?: string;
}

export interface ReverseUpiTransactionInput {
  clientTransactionId: string;
  providerTransactionId: string;
  reason: string;
}

export interface UpiRailProvider {
  readonly name: UpiRailProviderName;

  isConfigured(): boolean;

  getCapabilities(): readonly UpiRailCapability[];

  resolveVpa(
    input: ResolveUpiVpaInput,
  ): Promise<ResolveUpiVpaResult>;

  initiatePay(
    input: InitiateUpiPayInput,
  ): Promise<UpiTransactionResult>;

  initiateCollect(
    input: InitiateUpiCollectInput,
  ): Promise<UpiTransactionResult>;

  queryTransaction(
    input: QueryUpiTransactionInput,
  ): Promise<UpiTransactionResult | null>;

  reverseTransaction(
    input: ReverseUpiTransactionInput,
  ): Promise<UpiTransactionResult>;
}