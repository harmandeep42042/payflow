export type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
};

export type VerifiedRazorpayWebhook = {
  eventId: string;
  eventType: string;
  payloadHash: string;
  rawBody: Buffer;
  payload: RazorpayWebhookPayload;
};