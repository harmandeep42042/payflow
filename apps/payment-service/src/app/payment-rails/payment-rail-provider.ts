export type PaymentRailProviderName = 'RAZORPAY' | 'MOCK';

export interface CreateRailOrderInput {
  amountMinor: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface CreateRailOrderResult {
  provider: PaymentRailProviderName;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status?: string;
  raw?: unknown;
}

export interface FindRailOrderResult {
  provider: PaymentRailProviderName;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  receipt?: string;
  status?: string;
  raw?: unknown;
}

export interface FindRailPaymentResult {
  provider: PaymentRailProviderName;
  providerPaymentId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: string;
  captured: boolean;
  raw?: unknown;
}

export interface PaymentRailProvider {
  readonly name: PaymentRailProviderName;

  isConfigured(): boolean;

  createOrder(input: CreateRailOrderInput): Promise<CreateRailOrderResult>;

  findOrderByReceipt(receipt: string): Promise<FindRailOrderResult | null>;

  findPaymentsByOrderId(
    providerOrderId: string,
  ): Promise<FindRailPaymentResult[]>;
}
