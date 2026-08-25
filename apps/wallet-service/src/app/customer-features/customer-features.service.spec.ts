import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { CustomerFeaturesService } from './customer-features.service';
import { PROVIDER_NOT_CONFIGURED } from './providers';

describe('CustomerFeaturesService', () => {
  const prisma = {
    user: { findUnique: jest.fn(), count: jest.fn() }, contact: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn() },
    wallet: { findUnique: jest.fn(), findMany: jest.fn() }, deposit: { findMany: jest.fn() }, withdrawal: { findMany: jest.fn() }, transfer: { findMany: jest.fn() }, moneyRequest: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    rechargeAttempt: { findUnique: jest.fn(), create: jest.fn() }, billPaymentAttempt: { findUnique: jest.fn(), create: jest.fn() },
    mandate: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() }, supportCase: { findUnique: jest.fn(), update: jest.fn() },
    splitAllocation: { findUnique: jest.fn() }, offer: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }, offerClaim: { findUnique: jest.fn(), create: jest.fn() },
    outboxEvent: { create: jest.fn() }, auditLog: { create: jest.fn() },
  };
  const wallets = { transferWallet: jest.fn() };
  let service: CustomerFeaturesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'payer', status: 'ACTIVE' });
    service = new CustomerFeaturesService(prisma as never, wallets as never);
  });

  it('builds JWT-owned, currency-separated insights with exact Decimal totals', async () => {
    const at = new Date('2026-08-20T10:00:00.000Z');
    prisma.wallet.findMany.mockResolvedValue([{ id: 'owned-wallet' }]);
    prisma.deposit.findMany.mockResolvedValue([{ id: 'deposit', amount: new Decimal('9007199254740993.25'), currency: 'INR', status: 'COMPLETED', createdAt: at }]);
    prisma.withdrawal.findMany.mockResolvedValue([{ id: 'withdrawal', amount: new Decimal('0.10'), currency: 'INR', status: 'COMPLETED', createdAt: at }]);
    prisma.transfer.findMany.mockResolvedValue([
      { id: 'usd', sourceWalletId: 'external', amount: new Decimal('2.50'), currency: 'USD', status: 'COMPLETED', createdAt: at },
      { id: 'failed', sourceWalletId: 'owned-wallet', amount: new Decimal('8.00'), currency: 'INR', status: 'FAILED', createdAt: at },
    ]);
    const result = await service.insights('jwt-user', '2026-08-01', '2026-08-31');
    expect(prisma.wallet.findMany).toHaveBeenCalledWith({ where: { userId: 'jwt-user' }, select: { id: true } });
    expect(result.currencies).toEqual([
      expect.objectContaining({ currency: 'INR', incoming: '9007199254740993.25', outgoing: '0.1', successfulCount: 2, failedOrCancelledCount: 1 }),
      expect.objectContaining({ currency: 'USD', incoming: '2.5', outgoing: '0', successfulCount: 1 }),
    ]);
  });

  it('returns empty insights and rejects invalid or oversized ranges', async () => {
    prisma.wallet.findMany.mockResolvedValue([]);
    await expect(service.insights('jwt-user', '2026-08-01', '2026-08-02')).resolves.toMatchObject({ transactionCount: 0, currencies: [], recent: [] });
    await expect(service.insights('jwt-user', '2026-08-03', '2026-08-02')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.insights('jwt-user', '2024-01-01', '2026-08-02')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.insights('jwt-user', undefined, undefined, '31')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects self contacts before looking up a recipient', async () => {
    await expect(service.createContact('same-id', { recipientUserId: 'same-id' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('enforces wallet ownership for money requests', async () => {
    prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet', userId: 'someone-else', currency: 'INR', status: 'ACTIVE' });
    await expect(service.createMoneyRequest('owner', {
      payerUserId: 'payer', walletId: 'wallet', currency: 'INR', amount: '10.00',
      expiresAt: new Date(Date.now() + 60_000).toISOString(), idempotencyKey: 'request-1',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects money with excess decimal precision', async () => {
    prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet', userId: 'owner', currency: 'INR', status: 'ACTIVE' });
    await expect(service.createMoneyRequest('owner', {
      payerUserId: 'payer', walletId: 'wallet', currency: 'INR', amount: '10.001',
      expiresAt: new Date(Date.now() + 60_000).toISOString(), idempotencyKey: 'request-2',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists and reports recharge provider-not-configured without claiming success', async () => {
    prisma.rechargeAttempt.findUnique.mockResolvedValue(null); prisma.rechargeAttempt.create.mockResolvedValue({ id: 'attempt', userId: 'owner', status: PROVIDER_NOT_CONFIGURED });
    await expect(service.createRecharge('owner', {
      operator: 'Operator', mobileNumber: '+919876543210', amount: '249.00', currency: 'INR', idempotencyKey: 'recharge-1',
    })).resolves.toMatchObject({ code: PROVIDER_NOT_CONFIGURED, status: PROVIDER_NOT_CONFIGURED });
    expect(prisma.rechargeAttempt.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: expect.anything(), idempotencyKey: 'recharge-1', failureCode: PROVIDER_NOT_CONFIGURED }) });
  });

  it('prevents an idempotency key from crossing user ownership', async () => {
    prisma.billPaymentAttempt.findUnique.mockResolvedValue({ id: 'attempt', userId: 'another-user' });
    await expect(service.createBillPayment('owner', {
      category: 'ELECTRICITY', customerRef: 'account', amount: '500', currency: 'INR', idempotencyKey: 'bill-1',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns the same recharge attempt for a repeated idempotency key', async () => {
    prisma.rechargeAttempt.findUnique.mockResolvedValue({ id: 'same-attempt', userId: 'owner', operator: 'Operator', mobileNumber: '+919876543210', planId: null, amount: { eq: () => true }, currency: 'INR', status: PROVIDER_NOT_CONFIGURED });
    const dto = { operator: 'Operator', mobileNumber: '+919876543210', amount: '249.00', currency: 'INR', idempotencyKey: 'same-key' };
    await expect(Promise.all([service.createRecharge('owner', dto), service.createRecharge('owner', dto)]))
      .resolves.toEqual([expect.objectContaining({ id: 'same-attempt' }), expect.objectContaining({ id: 'same-attempt' })]);
    expect(prisma.rechargeAttempt.create).not.toHaveBeenCalled();
  });

  it('enforces mandate ownership for details and actions', async () => {
    prisma.mandate.findUnique.mockResolvedValue({ id: 'mandate', userId: 'user-b', status: 'PENDING' });
    await expect(service.mandate('user-a', 'mandate')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.mandateAction('user-a', 'mandate', 'cancel')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.mandate.update).not.toHaveBeenCalled();
  });

  it('enforces support-case ownership', async () => {
    prisma.supportCase.findUnique.mockResolvedValue({ id: 'case', userId: 'user-b', events: [] });
    await expect(service.caseDetails('user-a', 'case')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces split participant ownership before settlement', async () => {
    prisma.splitAllocation.findUnique.mockResolvedValue({ id: 'allocation', participantUserId: 'user-b', split: { currency: 'INR' } });
    await expect(service.payAllocation('user-a', 'allocation', { sourceWalletId: 'wallet', idempotencyKey: 'pay-key' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(wallets.transferWallet).not.toHaveBeenCalled();
  });

  it('maps only an authorized money-request settlement source mismatch to conflict', async () => {
    const request = { id: 'request', requesterUserId: 'requester', payerUserId: 'payer', walletId: 'destination', currency: 'INR', amount: { toString: () => '10' }, note: null, status: 'PENDING', expiresAt: new Date(Date.now() + 60_000) };
    prisma.moneyRequest.findUnique.mockResolvedValue(request);
    wallets.transferWallet.mockRejectedValue(new ForbiddenException('You do not own the source wallet'));
    await expect(service.acceptMoneyRequest('payer', 'request', { sourceWalletId: 'incompatible', idempotencyKey: 'ignored-at-domain-boundary' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.acceptMoneyRequest('requester', 'request', { sourceWalletId: 'wallet', idempotencyKey: 'auth-failure' })).rejects.toBeInstanceOf(ForbiddenException);
    prisma.moneyRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.acceptMoneyRequest('payer', 'missing', { sourceWalletId: 'wallet', idempotencyKey: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps only an authorized split settlement source mismatch to conflict', async () => {
    const allocation = { id: 'allocation', participantUserId: 'payer', status: 'PENDING', amount: { toString: () => '10' }, split: { status: 'OPEN', dueAt: new Date(Date.now() + 60_000), currency: 'INR', walletId: 'destination', note: null } };
    prisma.splitAllocation.findUnique.mockResolvedValue(allocation);
    wallets.transferWallet.mockRejectedValue(new ForbiddenException('You do not own the source wallet'));
    await expect(service.payAllocation('payer', 'allocation', { sourceWalletId: 'incompatible', idempotencyKey: 'ignored-at-domain-boundary' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.payAllocation('intruder', 'allocation', { sourceWalletId: 'wallet', idempotencyKey: 'auth-failure' })).rejects.toBeInstanceOf(ForbiddenException);
    prisma.splitAllocation.findUnique.mockResolvedValueOnce(null);
    await expect(service.payAllocation('payer', 'missing', { sourceWalletId: 'wallet', idempotencyKey: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns empty provider data without fabricating plans, billers, or bills', () => {
    expect(service.rechargePlans()).toEqual(expect.objectContaining({ code: PROVIDER_NOT_CONFIGURED, plans: [] }));
    expect(service.billers()).toEqual(expect.objectContaining({ code: PROVIDER_NOT_CONFIGURED, billers: [] }));
    expect(service.validateBill()).toEqual(expect.objectContaining({ code: PROVIDER_NOT_CONFIGURED, bill: null }));
  });

  it('prevents another user from updating or deleting a contact', async () => {
    prisma.contact.findUnique.mockResolvedValue({ id: 'contact', ownerUserId: 'owner' });
    await expect(service.updateContact('intruder', 'contact', { nickname: 'Changed' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.deleteContact('intruder', 'contact')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.contact.update).not.toHaveBeenCalled(); expect(prisma.contact.delete).not.toHaveBeenCalled();
  });

  it('allows requester and payer access but rejects an unrelated money-request user', async () => {
    prisma.moneyRequest.findUnique.mockResolvedValue({ id: 'request', requesterUserId: 'requester', payerUserId: 'payer', status: 'PENDING' });
    await expect(service.transitionMoneyRequest('requester', 'request', 'CANCELLED')).resolves.toBeUndefined();
    prisma.moneyRequest.update.mockClear();
    await expect(service.transitionMoneyRequest('unrelated', 'request', 'CANCELLED')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a paid split allocation without a second financial transfer', async () => {
    const paid = { id: 'allocation', participantUserId: 'payer', status: 'PAID', amount: { toString: () => '10' }, split: { currency: 'INR', walletId: 'destination', note: null } };
    prisma.splitAllocation.findUnique.mockResolvedValue(paid);
    prisma.wallet.findUnique.mockResolvedValue({ id: 'wallet', userId: 'payer', currency: 'INR', status: 'ACTIVE' });
    wallets.transferWallet.mockResolvedValue({ id: 'transfer' });
    await expect(service.payAllocation('payer', 'allocation', { sourceWalletId: 'wallet', idempotencyKey: 'repeat' })).resolves.toBe(paid);
    expect(wallets.transferWallet).toHaveBeenCalledTimes(1);
  });

  it('replays duplicate offer claims safely', async () => {
    prisma.offerClaim.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'claim', offerId: 'offer', userId: 'user' });
    prisma.offer.findUnique.mockResolvedValue({ id: 'offer', status: 'ACTIVE', startsAt: new Date(Date.now()-1000), expiresAt: new Date(Date.now()+60000), usageLimit: null, _count: { claims: 0 } });
    prisma.offerClaim.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.claimOffer('user', 'offer')).resolves.toMatchObject({ id: 'claim' });
  });

  it('validates offer expiry and records an audit for valid creation', async () => {
    const actor = { id: 'admin', email: 'admin@example.test', role: 'ADMIN' }; const base = { title:'Offer',description:'Description',merchant:'Merchant',category:'Food',currency:'INR',benefitDescription:'10% off',status:'DRAFT' as const,startsAt:new Date(Date.now()+60000).toISOString(),expiresAt:new Date(Date.now()+120000).toISOString() };
    prisma.offer.create.mockResolvedValue({ id: 'offer' });
    await expect(service.createOffer(actor, { ...base, expiresAt: base.startsAt })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.createOffer(actor, base)).resolves.toEqual({ id: 'offer' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorUserId: 'admin', action: 'CREATE_OFFER' }) }));
  });

  it('rejects activating an expired offer and missing offers', async () => {
    const actor = { id: 'admin', email: 'admin@example.test', role: 'ADMIN' }; const dto = { title:'Offer',description:'Description',merchant:'Merchant',category:'Food',currency:'INR',benefitDescription:'10% off',status:'ACTIVE' as const,startsAt:new Date(Date.now()-120000).toISOString(),expiresAt:new Date(Date.now()-60000).toISOString() };
    prisma.offer.findUnique.mockResolvedValueOnce({ id: 'offer' });
    await expect(service.updateOffer(actor, 'offer', dto)).rejects.toBeInstanceOf(BadRequestException);
    prisma.offer.findUnique.mockResolvedValueOnce(null);
    await expect(service.updateOffer(actor, 'missing', { ...dto, status: 'INACTIVE' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('enforces support-case transitions and resolution requirements', async () => {
    const actor = { id: 'admin', email: 'admin@example.test', role: 'ADMIN' };
    prisma.supportCase.findUnique.mockResolvedValue({ id:'case',userId:'customer',status:'OPEN',resolution:null,events:[] });
    await expect(service.updateCase(actor,'case',{status:'CLOSED'})).rejects.toBeInstanceOf(ConflictException);
    await expect(service.updateCase(actor,'case',{status:'REJECTED'})).rejects.toBeInstanceOf(BadRequestException);
    prisma.supportCase.update.mockResolvedValue({ id:'case',status:'UNDER_REVIEW' });
    await expect(service.updateCase(actor,'case',{status:'UNDER_REVIEW',priority:'HIGH'})).resolves.toEqual({ id:'case',status:'UNDER_REVIEW' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action:'UPDATE_SUPPORT_CASE' }) }));
  });

  it('scopes provider attempts to JWT identity and ignores browser user identifiers', async () => {
    const rechargeFindMany = jest.fn().mockResolvedValue([]); const billFindMany = jest.fn().mockResolvedValue([]);
    (prisma.rechargeAttempt as unknown as { findMany: jest.Mock }).findMany = rechargeFindMany; (prisma.billPaymentAttempt as unknown as { findMany: jest.Mock }).findMany = billFindMany;
    await service.rechargeHistory('jwt-user'); await service.billHistory('jwt-user');
    expect(rechargeFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'jwt-user' } })); expect(billFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'jwt-user' } }));
  });

  it('keeps insight-style customer collections scoped to JWT identity', async () => {
    const findMany = jest.fn().mockResolvedValue([]); (prisma.contact as unknown as { findMany: jest.Mock }).findMany = findMany;
    await service.listContacts('jwt-user', 'query-user-id');
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerUserId: 'jwt-user' }) }));
  });
});
