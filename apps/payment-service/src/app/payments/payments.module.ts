import { ExternalPaymentSettlementService } from './external-payment-settlement/external-payment-settlement.service';
import { ExternalPaymentReconciliationService } from './external-payment-reconciliation/external-payment-reconciliation.service';
import { ExternalPaymentRecoveryService } from './external-payment-recovery/external-payment-recovery.service';
import { PaymentRailModule } from '../payment-rails/payment-rail.module';
import { Module } from '@nestjs/common';

import { HttpModule } from '@nestjs/axios';

import {
  PrismaModule,
  PrismaService,
} from '@payflow/database';

import { PaymentsController } from './payments.controller';

import { PaymentsService } from './payments.service';

import { RazorpayService } from './razorpay/razorpay.service';

import { PaymentAuthModule } from '../payment-auth/payment-auth.module';

import { RazorpayWebhookModule } from '../webhooks/razorpay/razorpay-webhook.module';
import { ExternalPaymentWebhookLifecycleService } from './external-payment-reconciliation/external-payment-webhook-lifecycle.service';
import { ExternalPaymentWebhookWorkerService } from './external-payment-reconciliation/external-payment-webhook-worker.service';
import { PaymentOrderRateLimitService } from './security/payment-order-rate-limit.service';
@Module({
  imports: [
    RazorpayWebhookModule,
    PaymentRailModule,
    PrismaModule,

    PaymentAuthModule,

    HttpModule.register({
      timeout: 5000,
      maxRedirects: 0,
    }),
  ],

  controllers: [PaymentsController],

  providers: [

    PaymentOrderRateLimitService,
    ExternalPaymentSettlementService,
    ExternalPaymentReconciliationService,
    ExternalPaymentWebhookLifecycleService,
    ExternalPaymentWebhookWorkerService,
    PaymentsService,
    RazorpayService,
    ExternalPaymentRecoveryService,
    {
      provide: 'PAYMENT_HEALTH_PRISMA',
      useExisting: PrismaService,
    },
  ],

  exports: [
    PaymentsService, RazorpayService, ExternalPaymentRecoveryService,
    PrismaModule,
    PaymentOrderRateLimitService,
    'PAYMENT_HEALTH_PRISMA',
  ],
})
export class PaymentsModule {}
