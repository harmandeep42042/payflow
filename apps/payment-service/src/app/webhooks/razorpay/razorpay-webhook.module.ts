import { Module } from '@nestjs/common';
import { PrismaModule } from '@payflow/database';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { RazorpayWebhookIdentityService } from './razorpay-webhook-identity.service';
import { RazorpayWebhookIngestService } from './razorpay-webhook-ingest.service';
import { RazorpayWebhookProcessorService } from './razorpay-webhook-processor.service';
import { RazorpayWebhookSignatureService } from './razorpay-webhook-signature.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    RazorpayWebhookController,
  ],
  providers: [
    RazorpayWebhookSignatureService,
    RazorpayWebhookIdentityService,
    RazorpayWebhookIngestService,
    RazorpayWebhookProcessorService,
  ],
  exports: [
    RazorpayWebhookProcessorService,
  ],
})
export class RazorpayWebhookModule {}