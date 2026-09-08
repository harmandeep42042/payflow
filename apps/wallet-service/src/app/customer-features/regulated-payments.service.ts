import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@payflow/database';
import { Decimal } from '@prisma/client/runtime/client';
import { createHash } from 'crypto';
import {
  AddPaymentMethodDto,
  ClassifyTransactionDto,
  CreatePaymentTemplateDto,
  CreateRecurringScheduleDto,
  LinkBankAccountDto,
  MerchantProfileDto,
  RequestRefundDto,
  ReviewRiskSignalDto,
  SetVpaDto,
} from './regulated-payments.dto';
import { PROVIDER_NOT_CONFIGURED } from './providers';

@Injectable()
export class RegulatedPaymentsService {
  constructor(private readonly prisma: PrismaService) {}
  private money(value: string) {
    const amount = new Decimal(value);
    if (!amount.gt(0) || amount.decimalPlaces() > 2)
      throw new BadRequestException(
        'Amount must be a positive decimal with at most two fractional digits',
      );
    return amount;
  }
  private currency(value: string) {
    return value.trim().toUpperCase();
  }
  private future(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || date <= new Date())
      throw new BadRequestException('Date must be in the future');
    return date;
  }

  providerArchitecture() {
    return {
      upi: PROVIDER_NOT_CONFIGURED,
      bankVerification: PROVIDER_NOT_CONFIGURED,
      paymentAuthentication: 'PROVIDER_BLOCKED',
      merchantSettlement: PROVIDER_NOT_CONFIGURED,
      cardTokenization: PROVIDER_NOT_CONFIGURED,
      recurringDebit: 'PROVIDER_BLOCKED',
    };
  }
  async vpa(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { vpa: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return { vpa: user.vpa, providerState: PROVIDER_NOT_CONFIGURED };
  }
  async setVpa(userId: string, dto: SetVpaDto) {
    const vpa = dto.vpa.trim().toLowerCase();
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { vpa } });
      return { vpa, providerState: PROVIDER_NOT_CONFIGURED };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('VPA is already in use');
      throw error;
    }
  }

  bankAccounts(userId: string) {
    return this.prisma.bankAccount.findMany({
      where: { userId, unlinkedAt: null },
      select: {
        id: true,
        bankName: true,
        accountHolderName: true,
        maskedAccountNumber: true,
        ifsc: true,
        status: true,
        isPrimary: true,
        linkedAt: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }
  async linkBankAccount(userId: string, dto: LinkBankAccountDto) {
    const fingerprint = createHash('sha256')
      .update(`${userId}:${dto.accountNumber}`)
      .digest('hex');
    const masked = `${'*'.repeat(Math.max(4, dto.accountNumber.length - 4))}${dto.accountNumber.slice(-4)}`;
    if (dto.isPrimary)
      await this.prisma.bankAccount.updateMany({
        where: { userId, unlinkedAt: null },
        data: { isPrimary: false },
      });
    try {
      const item = await this.prisma.bankAccount.create({
        data: {
          userId,
          bankName: dto.bankName.trim(),
          accountHolderName: dto.accountHolderName.trim(),
          maskedAccountNumber: masked,
          accountFingerprint: fingerprint,
          ifsc: dto.ifsc.toUpperCase(),
          isPrimary: Boolean(dto.isPrimary),
        },
        select: {
          id: true,
          bankName: true,
          accountHolderName: true,
          maskedAccountNumber: true,
          ifsc: true,
          status: true,
          isPrimary: true,
          linkedAt: true,
        },
      });
      return { ...item, code: PROVIDER_NOT_CONFIGURED };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('Bank account is already linked');
      throw error;
    }
  }
  async unlinkBankAccount(userId: string, id: string) {
    const item = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Bank account not found');
    if (item.userId !== userId)
      throw new ForbiddenException('Bank account ownership is required');
    if (!item.unlinkedAt)
      await this.prisma.bankAccount.update({
        where: { id },
        data: { unlinkedAt: new Date(), isPrimary: false },
      });
    return { unlinked: true };
  }

  paymentMethods(userId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { userId, removedAt: null },
      select: {
        id: true,
        type: true,
        label: true,
        maskedIdentifier: true,
        cardBrand: true,
        expiryMonth: true,
        expiryYear: true,
        status: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }
  async addPaymentMethod(userId: string, dto: AddPaymentMethodDto) {
    if (/\d{12,}/.test(dto.maskedIdentifier.replace(/[\s-]/g, '')))
      throw new BadRequestException(
        'Plain card or account numbers are not accepted',
      );
    if (dto.isDefault)
      await this.prisma.paymentMethod.updateMany({
        where: { userId, removedAt: null },
        data: { isDefault: false },
      });
    const item = await this.prisma.paymentMethod.create({
      data: {
        userId,
        type: dto.type,
        label: dto.label.trim(),
        maskedIdentifier: dto.maskedIdentifier.trim(),
        providerTokenRef: dto.providerTokenRef || null,
        cardBrand: dto.cardBrand || null,
        expiryMonth: dto.expiryMonth ? Number(dto.expiryMonth) : null,
        expiryYear: dto.expiryYear ? Number(dto.expiryYear) : null,
        isDefault: Boolean(dto.isDefault),
      },
      select: {
        id: true,
        type: true,
        label: true,
        maskedIdentifier: true,
        cardBrand: true,
        expiryMonth: true,
        expiryYear: true,
        status: true,
        isDefault: true,
      },
    });
    return { ...item, code: PROVIDER_NOT_CONFIGURED };
  }
  async removePaymentMethod(userId: string, id: string) {
    const item = await this.prisma.paymentMethod.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Payment method not found');
    if (item.userId !== userId)
      throw new ForbiddenException('Payment method ownership is required');
    await this.prisma.paymentMethod.update({
      where: { id },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
        isDefault: false,
        providerTokenRef: null,
      },
    });
    return { removed: true };
  }

  upiPayments(userId: string) {
    return this.prisma.upiPaymentIntent.findMany({
      where: { OR: [{ senderUserId: userId }, { receiverUserId: userId }] },
      include: { auditEvents: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  merchants() {
    return this.prisma.merchant.findMany({
      where: { onboardingStatus: 'ACTIVE' },
      select: {
        id: true,
        displayName: true,
        category: true,
        merchantVpa: true,
        qrIdentity: true,
        onboardingStatus: true,
        providerState: true,
      },
      orderBy: { displayName: 'asc' },
    });
  }
  merchantPayments(userId: string) {
    return this.prisma.merchantPayment.findMany({
      where: { userId },
      include: {
        merchant: {
          select: { displayName: true, category: true, merchantVpa: true },
        },
        refunds: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async merchantPaymentReceipt(userId: string, paymentId: string) {
    const payment = await this.prisma.merchantPayment.findUnique({
      where: { id: paymentId },
      include: {
        merchant: {
          select: {
            id: true,
            ownerUserId: true,
            displayName: true,
            category: true,
            merchantVpa: true,
          },
        },
        refunds: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Merchant payment not found');
    }

    const canRead =
      payment.userId === userId ||
      payment.merchant.ownerUserId === userId;

    if (!canRead) {
      throw new NotFoundException('Merchant payment not found');
    }

    return {
      id: payment.id,
      userId: payment.userId,
      merchantId: payment.merchantId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      providerState: payment.providerState,
      providerReference: payment.providerReference,
      transactionReference: payment.transactionReference,
      receiptNumber: payment.receiptNumber,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      completedAt: payment.completedAt,
      merchant: {
        id: payment.merchant.id,
        displayName: payment.merchant.displayName,
        category: payment.merchant.category,
        merchantVpa: payment.merchant.merchantVpa,
      },
      refunds: payment.refunds,
    };
  }
  merchantProfile(userId: string) {
    return this.prisma.merchant.findUnique({
      where: { ownerUserId: userId },
      select: {
        id: true,
        displayName: true,
        legalName: true,
        category: true,
        merchantVpa: true,
        qrIdentity: true,
        onboardingStatus: true,
        providerState: true,
        createdAt: true,
      },
    });
  }
  async saveMerchantProfile(userId: string, dto: MerchantProfileDto) {
    const data = {
      displayName: dto.displayName.trim(),
      legalName: dto.legalName?.trim() || null,
      category: dto.category.trim(),
      merchantVpa: dto.merchantVpa.trim().toLowerCase(),
      onboardingStatus: 'PENDING_VERIFICATION' as never,
      providerState: 'NOT_CONFIGURED' as never,
    };
    const current = await this.prisma.merchant.findUnique({
      where: { ownerUserId: userId },
    });
    if (current)
      return this.prisma.merchant.update({ where: { id: current.id }, data });
    return this.prisma.merchant.create({
      data: { ...data, ownerUserId: userId, qrIdentity: `merchant:${userId}` },
    });
  }
  async requestRefund(
    userId: string,
    paymentId: string,
    dto: RequestRefundDto,
  ) {
    const payment = await this.prisma.merchantPayment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Merchant payment not found');
    if (payment.userId !== userId)
      throw new ForbiddenException('Merchant payment ownership is required');
    const amount = this.money(dto.amount);
    if (amount.gt(payment.amount))
      throw new BadRequestException('Refund cannot exceed payment amount');
    const existing = await this.prisma.merchantRefund.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (
        existing.merchantPaymentId !== paymentId ||
        !existing.amount.eq(amount)
      )
        throw new ConflictException(
          'Idempotency key conflicts with another refund request',
        );
      return { ...existing, code: PROVIDER_NOT_CONFIGURED };
    }
    const item = await this.prisma.merchantRefund.create({
      data: {
        merchantPaymentId: paymentId,
        amount,
        currency: payment.currency,
        reason: dto.reason?.trim() || null,
        idempotencyKey: dto.idempotencyKey,
      },
    });
    return {
      ...item,
      code: PROVIDER_NOT_CONFIGURED,
      message:
        'Merchant settlement provider is not configured; no refund was executed.',
    };
  }
  paymentAuthState(userId: string) {
    return this.prisma.paymentAuthProfile
      .findUnique({
        where: { userId },
        select: {
          status: true,
          failedAttemptCount: true,
          lockedUntil: true,
          credentialChangedAt: true,
        },
      })
      .then(
        (profile) =>
          profile ?? {
            status: 'PROVIDER_BLOCKED',
            failedAttemptCount: 0,
            lockedUntil: null,
            credentialChangedAt: null,
          },
      );
  }

  async classify(
    userId: string,
    transferId: string,
    dto: ClassifyTransactionDto,
  ) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        sourceWallet: { select: { userId: true } },
        destinationWallet: { select: { userId: true } },
      },
    });
    if (!transfer) throw new NotFoundException('Transaction not found');
    if (
      transfer.sourceWallet.userId !== userId &&
      transfer.destinationWallet.userId !== userId
    )
      throw new ForbiddenException('Transaction ownership is required');
    return this.prisma.transactionClassification.upsert({
      where: { userId_transferId: { userId, transferId } },
      create: { userId, transferId, category: dto.category as never },
      update: { category: dto.category as never, source: 'USER' },
    });
  }

  templates(userId: string) {
    return this.prisma.paymentTemplate.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }
  createTemplate(userId: string, dto: CreatePaymentTemplateDto) {
    return this.prisma.paymentTemplate.create({
      data: {
        userId,
        name: dto.name.trim(),
        destinationRef: dto.destinationRef.trim(),
        maskedDestination: dto.maskedDestination.trim(),
        amount: dto.amount ? this.money(dto.amount) : null,
        currency: this.currency(dto.currency),
        note: dto.note?.trim() || null,
      },
    });
  }
  async updateTemplate(
    userId: string,
    id: string,
    dto: CreatePaymentTemplateDto,
  ) {
    const item = await this.prisma.paymentTemplate.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Payment template not found');
    if (item.userId !== userId)
      throw new ForbiddenException('Payment template ownership is required');
    return this.prisma.paymentTemplate.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        destinationRef: dto.destinationRef.trim(),
        maskedDestination: dto.maskedDestination.trim(),
        amount: dto.amount ? this.money(dto.amount) : null,
        currency: this.currency(dto.currency),
        note: dto.note?.trim() || null,
      },
    });
  }
  async deleteTemplate(userId: string, id: string) {
    const item = await this.prisma.paymentTemplate.findUnique({
      where: { id },
      include: { schedules: { select: { id: true }, take: 1 } },
    });
    if (!item) throw new NotFoundException('Payment template not found');
    if (item.userId !== userId)
      throw new ForbiddenException('Payment template ownership is required');
    if (item.schedules.length)
      throw new ConflictException('Template is used by a recurring schedule');
    await this.prisma.paymentTemplate.delete({ where: { id } });
    return { deleted: true };
  }
  schedules(userId: string) {
    return this.prisma.recurringPaymentSchedule.findMany({
      where: { userId },
      include: {
        template: true,
        executions: { orderBy: { scheduledFor: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createSchedule(userId: string, dto: CreateRecurringScheduleDto) {
    const template = await this.prisma.paymentTemplate.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) throw new NotFoundException('Payment template not found');
    if (template.userId !== userId)
      throw new ForbiddenException('Payment template ownership is required');
    const start = this.future(dto.startAt);
    const end = dto.endAt ? this.future(dto.endAt) : null;
    if (end && end <= start)
      throw new BadRequestException('End date must be after start date');
    const existing = await this.prisma.recurringPaymentSchedule.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (
        existing.userId !== userId ||
        existing.templateId !== dto.templateId ||
        existing.frequency !== dto.frequency
      )
        throw new ConflictException(
          'Idempotency key conflicts with another schedule',
        );
      return { ...existing, code: 'PROVIDER_BLOCKED' };
    }
    const item = await this.prisma.recurringPaymentSchedule.create({
      data: {
        userId,
        templateId: dto.templateId,
        frequency: dto.frequency,
        startAt: start,
        endAt: end,
        nextRunAt: start,
        idempotencyKey: dto.idempotencyKey,
      },
    });
    return {
      ...item,
      code: 'PROVIDER_BLOCKED',
      message: 'Automatic debits require an authorized provider.',
    };
  }
  async scheduleAction(
    userId: string,
    id: string,
    action: 'pause' | 'resume' | 'cancel',
  ) {
    const item = await this.prisma.recurringPaymentSchedule.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException('Recurring schedule not found');
    if (item.userId !== userId)
      throw new ForbiddenException('Recurring schedule ownership is required');
    if (action === 'resume')
      return {
        ...item,
        code: 'PROVIDER_BLOCKED',
        message: 'Provider authorization is required before activation.',
      };
    return this.prisma.recurringPaymentSchedule.update({
      where: { id },
      data: { status: action === 'cancel' ? 'CANCELLED' : 'PAUSED' },
    });
  }

  async statement(userId: string, fromValue: string, toValue: string) {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(fromValue) || !pattern.test(toValue))
      throw new BadRequestException('Valid statement dates are required');
    const from = new Date(`${fromValue}T00:00:00.000Z`);
    const to = new Date(`${toValue}T23:59:59.999Z`);
    if (from > to || to.getTime() - from.getTime() > 366 * 86_400_000)
      throw new BadRequestException(
        'Statement range must be between 1 and 366 days',
      );
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { id: true, currency: true },
    });
    const result = [];
    for (const wallet of wallets) {
      const [deposits, withdrawals, transfers] = await Promise.all([
        this.prisma.deposit.findMany({
          where: {
            walletId: wallet.id,
            status: 'COMPLETED',
            createdAt: { lte: to },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.withdrawal.findMany({
          where: {
            walletId: wallet.id,
            status: 'COMPLETED',
            createdAt: { lte: to },
          },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.transfer.findMany({
          where: {
            status: 'COMPLETED',
            createdAt: { lte: to },
            OR: [
              { sourceWalletId: wallet.id },
              { destinationWalletId: wallet.id },
            ],
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
      const all = [
        ...deposits.map((x) => ({
          id: x.id,
          at: x.createdAt,
          type: 'DEPOSIT',
          credit: x.amount,
          debit: new Decimal(0),
        })),
        ...withdrawals.map((x) => ({
          id: x.id,
          at: x.createdAt,
          type: 'WITHDRAWAL',
          credit: new Decimal(0),
          debit: x.amount,
        })),
        ...transfers.map((x) => ({
          id: x.id,
          at: x.createdAt,
          type: 'TRANSFER',
          credit:
            x.destinationWalletId === wallet.id ? x.amount : new Decimal(0),
          debit: x.sourceWalletId === wallet.id ? x.amount : new Decimal(0),
        })),
      ].sort((a, b) => a.at.getTime() - b.at.getTime());
      let opening = new Decimal(0);
      for (const x of all.filter((x) => x.at < from))
        opening = opening.add(x.credit).sub(x.debit);
      let balance = opening;
      const rows = all
        .filter((x) => x.at >= from)
        .map((x) => {
          balance = balance.add(x.credit).sub(x.debit);
          return {
            id: x.id,
            createdAt: x.at,
            type: x.type,
            credit: x.credit.toString(),
            debit: x.debit.toString(),
            balance: balance.toString(),
          };
        });
      const credits = rows.reduce((n, x) => n.add(x.credit), new Decimal(0));
      const debits = rows.reduce((n, x) => n.add(x.debit), new Decimal(0));
      result.push({
        currency: wallet.currency,
        openingBalance: opening.toString(),
        credits: credits.toString(),
        debits: debits.toString(),
        closingBalance: balance.toString(),
        transactions: rows,
      });
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      currencies: result,
      csv: this.statementCsv(result),
    };
  }
  private statementCsv(
    groups: Array<{
      currency: string;
      transactions: Array<{
        id: string;
        createdAt: Date;
        type: string;
        credit: string;
        debit: string;
        balance: string;
      }>;
    }>,
  ) {
    const rows = ['currency,date,type,reference,credit,debit,balance'];
    for (const g of groups)
      for (const x of g.transactions)
        rows.push(
          [
            g.currency,
            x.createdAt.toISOString(),
            x.type,
            x.id,
            x.credit,
            x.debit,
            x.balance,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        );
    return rows.join('\n');
  }

  async riskState(userId: string) {
    const since = new Date(Date.now() - 5 * 60_000);
    const recent = await this.prisma.transfer.findMany({ where: { status: 'COMPLETED', createdAt: { gte: since }, sourceWallet: { userId } }, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    if (recent.length >= 5) {
      const existing = await this.prisma.riskSignal.findFirst({ where: { userId, type: 'RAPID_TRANSFERS', status: 'OPEN', detectedAt: { gte: since } } });
      if (!existing) { await this.prisma.riskSignal.create({ data: { userId, type: 'RAPID_TRANSFERS', severity: 'MEDIUM', transferId: recent[0].id, summary: 'Multiple completed transfers detected in a short period', evidence: { windowMinutes: 5, transferCount: recent.length } } }); await this.prisma.riskProfile.upsert({ where: { userId }, create: { userId, status: 'REVIEW_REQUIRED', reviewReason: 'Rapid transfer activity requires review' }, update: { status: 'REVIEW_REQUIRED', reviewReason: 'Rapid transfer activity requires review' } }); }
    }
    const [profile, signals] = await Promise.all([this.prisma.riskProfile.findUnique({ where: { userId }, select: { status: true, reviewReason: true, reviewedAt: true } }), this.prisma.riskSignal.findMany({ where: { userId }, select: { id: true, type: true, status: true, severity: true, summary: true, detectedAt: true, reviewedAt: true, resolutionNote: true }, orderBy: { detectedAt: 'desc' }, take: 50 })]);
    return { profile: profile ?? { status: 'CLEAR', reviewReason: null, reviewedAt: null }, signals, recoverable: true, message: profile?.status === 'REVIEW_REQUIRED' ? 'Activity is under review; contact support if you do not recognize it.' : 'No open risk review.' };
  }
  async adminRiskSignals(search?: string, status?: string) { const rows = await this.prisma.riskSignal.findMany({ where: { ...(status ? { status: status as never } : {}), ...(search ? { OR: [{ summary: { contains: search, mode: 'insensitive' } }, { user: { email: { contains: search, mode: 'insensitive' } } }] } : {}) }, include: { user: { select: { email: true } } }, orderBy: { detectedAt: 'desc' }, take: 200 }); return rows.map((item) => ({ ...item, user: { email: this.maskEmail(item.user.email) } })); }
  async reviewRiskSignal(actor: { id: string; email: string }, id: string, dto: ReviewRiskSignalDto) { const item = await this.prisma.riskSignal.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Risk signal not found'); const updated = await this.prisma.riskSignal.update({ where: { id }, data: { status: dto.status, reviewedAt: new Date(), reviewedByUserId: actor.id, resolutionNote: dto.note.trim() } }); const open = await this.prisma.riskSignal.count({ where: { userId: item.userId, status: 'OPEN' } }); if (!open) await this.prisma.riskProfile.upsert({ where: { userId: item.userId }, create: { userId: item.userId, status: 'CLEAR', reviewedAt: new Date() }, update: { status: 'CLEAR', reviewReason: null, reviewedAt: new Date() } }); await this.prisma.auditLog.create({ data: { actorUserId: actor.id, actorEmail: actor.email, action: 'REVIEW_RISK_SIGNAL', targetType: 'RISK_SIGNAL', targetId: id, description: dto.note.trim(), metadata: { status: dto.status } } }); return updated; }
  private maskEmail(email: string) { const [name, domain] = email.split('@'); return `${name.slice(0, 2)}***@${domain}`; }

  adminOperations() {
    return Promise.all([
      this.prisma.upiPaymentIntent.findMany({
        select: {
          id: true,
          status: true,
          kind: true,
          currency: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.merchantPayment.findMany({
        select: {
          id: true,
          status: true,
          currency: true,
          createdAt: true,
          merchant: { select: { displayName: true, category: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.bankAccount.findMany({
        select: {
          id: true,
          bankName: true,
          maskedAccountNumber: true,
          status: true,
          isPrimary: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.recurringPaymentSchedule.findMany({
        select: {
          id: true,
          status: true,
          frequency: true,
          nextRunAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]).then(
      ([upiPayments, merchantPayments, bankAccounts, recurringSchedules]) => [
        ...upiPayments.map((item) => ({ ...item, title: `UPI ${item.kind}` })),
        ...merchantPayments.map((item) => ({
          ...item,
          title: item.merchant.displayName,
        })),
        ...bankAccounts.map((item) => ({
          ...item,
          title: `${item.bankName} ${item.maskedAccountNumber}`,
        })),
        ...recurringSchedules.map((item) => ({
          ...item,
          title: `Recurring ${item.frequency}`,
        })),
      ],
    );
  }
}
