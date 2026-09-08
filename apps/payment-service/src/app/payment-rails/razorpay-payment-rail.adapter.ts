import { Injectable } from '@nestjs/common';
import Razorpay from 'razorpay';
import {
  CreateRailOrderInput,
  CreateRailOrderResult,
  FindRailPaymentResult,
  PaymentRailProvider,
} from './payment-rail-provider';

@Injectable()
export class RazorpayPaymentRailAdapter implements PaymentRailProvider {
  readonly name = 'RAZORPAY' as const;

  private readonly client: Razorpay | null;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    this.client =
      keyId && keySecret
        ? new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
          })
        : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async createOrder(
    input: CreateRailOrderInput,
  ): Promise<CreateRailOrderResult> {
    if (!this.client) {
      throw new Error('Razorpay provider is not configured');
    }

    const order = await this.client.orders.create({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    });

    return {
      provider: this.name,
      providerOrderId: order.id,
      amountMinor: Number(order.amount),
      currency: order.currency,
      status: order.status,
      raw: order,
    };
  }

  /**
   * Recovery-only provider lookup.
   *
   * This method MUST NOT create a new provider order.
   * It searches Razorpay using Payflow's deterministic receipt.
   */
  async findOrderByReceipt(receipt: string) {
    if (!this.client) {
      throw new Error('Razorpay payment rail is not configured');
    }

    const normalizedReceipt = receipt.trim();

    if (!normalizedReceipt) {
      throw new Error('Razorpay recovery receipt is required');
    }

    const response = await this.client.orders.all({
      receipt: normalizedReceipt,
      count: 10,
    });

    const items = Array.isArray(response.items) ? response.items : [];

    const order = items.find((item) => item.receipt === normalizedReceipt);

    if (!order) {
      return null;
    }

    return {
      provider: this.name,
      providerOrderId: order.id,
      amountMinor: Number(order.amount),
      currency: order.currency,
      receipt: order.receipt ?? undefined,
      status: order.status ?? undefined,
      raw: order,
    };
  }

  /**
   * Read-only reconciliation lookup.
   *
   * This method MUST NOT capture, authorize,
   * refund, or create a payment.
   */
  async findPaymentsByOrderId(
    providerOrderId: string,
  ): Promise<FindRailPaymentResult[]> {
    if (!this.client) {
      throw new Error('Razorpay payment rail is not configured');
    }

    const normalizedOrderId = providerOrderId.trim();

    if (!normalizedOrderId) {
      throw new Error('Razorpay provider order id is required');
    }

    const response = await this.client.orders.fetchPayments(normalizedOrderId);

    const items = Array.isArray(response.items) ? response.items : [];

    return items.map((payment) => ({
      provider: this.name,
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id,
      amountMinor: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      captured: payment.captured === true,
      raw: payment,
    }));
  }
}
