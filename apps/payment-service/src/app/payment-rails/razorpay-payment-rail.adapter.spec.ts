import { RazorpayPaymentRailAdapter } from './razorpay-payment-rail.adapter';

describe('RazorpayPaymentRailAdapter', () => {
  const originalKeyId =
    process.env.RAZORPAY_KEY_ID;

  const originalKeySecret =
    process.env.RAZORPAY_KEY_SECRET;

  afterEach(() => {
    if (originalKeyId === undefined) {
      delete process.env.RAZORPAY_KEY_ID;
    } else {
      process.env.RAZORPAY_KEY_ID =
        originalKeyId;
    }

    if (originalKeySecret === undefined) {
      delete process.env.RAZORPAY_KEY_SECRET;
    } else {
      process.env.RAZORPAY_KEY_SECRET =
        originalKeySecret;
    }

    jest.restoreAllMocks();
  });

  it('stays disabled when Razorpay credentials are absent', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const adapter =
      new RazorpayPaymentRailAdapter();

    expect(
      adapter.isConfigured(),
    ).toBe(false);

    await expect(
      adapter.createOrder({
        amountMinor: 100,
        currency: 'INR',
        receipt: 'test-disabled',
      }),
    ).rejects.toThrow(
      'Razorpay provider is not configured',
    );
  });

  it('maps provider order response into PaymentRailProvider result', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const adapter =
      new RazorpayPaymentRailAdapter();

    const providerOrder = {
      id: 'order_test_123',
      amount: 1250,
      currency: 'INR',
      status: 'created',
      receipt: 'receipt_test_123',
    };

    const create =
      jest.fn().mockResolvedValue(
        providerOrder,
      );

    const adapterWithClient =
      adapter as unknown as {
        client: {
          orders: {
            create: typeof create;
          };
        } | null;
      };

    adapterWithClient.client = {
      orders: {
        create,
      },
    };

    expect(
      adapter.isConfigured(),
    ).toBe(true);

    const result =
      await adapter.createOrder({
        amountMinor: 1250,
        currency: 'INR',
        receipt: 'receipt_test_123',
        notes: {
          source: 'PAYFLOW_TEST',
        },
      });

    expect(create).toHaveBeenCalledTimes(1);

    expect(create).toHaveBeenCalledWith({
      amount: 1250,
      currency: 'INR',
      receipt: 'receipt_test_123',
      notes: {
        source: 'PAYFLOW_TEST',
      },
    });

    expect(result.provider).toBe(
      'RAZORPAY',
    );

    expect(
      result.providerOrderId,
    ).toBe('order_test_123');

    expect(result.amountMinor).toBe(
      1250,
    );

    expect(result.currency).toBe(
      'INR',
    );

    expect(result.status).toBe(
      'created',
    );

    expect(result.raw).toBe(
      providerOrder,
    );
  });

  it('passes optional receipt and notes through without manufacturing payment success', async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    const adapter =
      new RazorpayPaymentRailAdapter();

    const create =
      jest.fn().mockResolvedValue({
        id: 'order_test_optional',
        amount: 500,
        currency: 'INR',
        status: 'created',
      });

    const adapterWithClient =
      adapter as unknown as {
        client: {
          orders: {
            create: typeof create;
          };
        } | null;
      };

    adapterWithClient.client = {
      orders: {
        create,
      },
    };

    const result =
      await adapter.createOrder({
        amountMinor: 500,
        currency: 'INR',
      });

    expect(create).toHaveBeenCalledWith({
      amount: 500,
      currency: 'INR',
      receipt: undefined,
      notes: undefined,
    });

    expect(result.status).toBe(
      'created',
    );

    expect(result.providerOrderId).toBe(
      'order_test_optional',
    );
  });
});