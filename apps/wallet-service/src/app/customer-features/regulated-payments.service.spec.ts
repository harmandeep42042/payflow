import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { RegulatedPaymentsService } from './regulated-payments.service';

describe('RegulatedPaymentsService safe boundaries', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() }, bankAccount: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    paymentMethod: { findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    upiPaymentIntent: { findMany: jest.fn() }, merchant: { findMany: jest.fn() }, merchantPayment: { findMany: jest.fn() }, paymentAuthProfile: { findUnique: jest.fn() },
    transfer: { findUnique: jest.fn(), findMany: jest.fn() }, transactionClassification: { upsert: jest.fn() }, paymentTemplate: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    recurringPaymentSchedule: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, wallet: { findMany: jest.fn() }, deposit: { findMany: jest.fn() }, withdrawal: { findMany: jest.fn() },
  };
  let service: RegulatedPaymentsService;
  beforeEach(() => { jest.clearAllMocks(); service = new RegulatedPaymentsService(prisma as never); });

  it('stores only masked bank data and reports provider-not-configured', async () => {
    prisma.bankAccount.create.mockImplementation(({ data, select }) => Promise.resolve({ id: 'bank', maskedAccountNumber: data.maskedAccountNumber, status: 'NOT_CONFIGURED', select }));
    const result = await service.linkBankAccount('owner', { bankName: 'Safe Bank', accountHolderName: 'Owner', accountNumber: '123456789012', ifsc: 'ABCD0123456' });
    expect(result).toMatchObject({ maskedAccountNumber: '********9012', code: 'PROVIDER_NOT_CONFIGURED' });
    const data = prisma.bankAccount.create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain('123456789012');
    expect(data.accountFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('never accepts a plaintext card number as masked metadata', async () => {
    await expect(service.addPaymentMethod('owner', { type: 'CARD_TOKEN', label: 'Card', maskedIdentifier: '4111111111111111' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.paymentMethod.create).not.toHaveBeenCalled();
  });

  it('enforces ownership before classifying transactions', async () => {
    prisma.transfer.findUnique.mockResolvedValue({ sourceWallet: { userId: 'other' }, destinationWallet: { userId: 'another' } });
    await expect(service.classify('owner', 'transfer', { category: 'OTHER' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces template ownership and prevents deleting scheduled templates', async()=>{prisma.paymentTemplate.findUnique.mockResolvedValueOnce({id:'template',userId:'other'});await expect(service.updateTemplate('owner','template',{name:'Rent',destinationRef:'ref',maskedDestination:'***1',currency:'INR'})).rejects.toBeInstanceOf(ForbiddenException);prisma.paymentTemplate.findUnique.mockResolvedValueOnce({id:'template',userId:'owner',schedules:[{id:'schedule'}]});await expect(service.deleteTemplate('owner','template')).rejects.toBeInstanceOf(ConflictException);expect(prisma.paymentTemplate.delete).not.toHaveBeenCalled();});

  it('keeps recurring debit activation provider-blocked and idempotent', async () => {
    const startAt = new Date(Date.now() + 86_400_000).toISOString(); prisma.paymentTemplate.findUnique.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', userId: 'owner' }); prisma.recurringPaymentSchedule.findUnique.mockResolvedValue({ userId: 'other' });
    await expect(service.createSchedule('owner', { templateId: '11111111-1111-4111-8111-111111111111', frequency: 'MONTHLY', startAt, idempotencyKey: 'schedule:key' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('computes currency-separated statement balances with Decimal arithmetic', async () => {
    prisma.wallet.findMany.mockResolvedValue([{ id: 'wallet', currency: 'INR' }]);
    prisma.deposit.findMany.mockResolvedValue([{ id: 'd1', amount: new Decimal('9007199254740993.25'), createdAt: new Date('2026-01-01') }]);
    prisma.withdrawal.findMany.mockResolvedValue([{ id: 'w1', amount: new Decimal('0.10'), createdAt: new Date('2026-01-02') }]);
    prisma.transfer.findMany.mockResolvedValue([]);
    const result = await service.statement('owner', '2026-01-01', '2026-01-31');
    expect(result.currencies[0]).toMatchObject({ credits: '9007199254740993.25', debits: '0.1', closingBalance: '9007199254740993.15' });
  });

  it('exposes regulated providers only as blocked or not configured', () => {
    expect(Object.values(service.providerArchitecture())).not.toContain('SUCCESS');
  });
});
