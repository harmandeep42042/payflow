import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@payflow/database';
import { Decimal } from '@prisma/client/runtime/client';
import { WalletsService } from '../wallets/wallets.service';
import {
  AcceptMoneyRequestDto, CreateBillPaymentDto, CreateSavedBillerDto, CreateBillReminderDto, CreateBillSplitDto, CreateContactDto, CreateMandateDto,
  CreateMoneyRequestDto, CreateOfferDto, CreateRechargeDto, CreateSupportCaseDto, PaySplitAllocationDto,
  UpdateContactDto, UpdateOfferDto, UpdateSupportCaseDto,
} from './customer-features.dto';
import { PROVIDER_NOT_CONFIGURED } from './providers';

type Actor = { id: string; email: string; role: string };

@Injectable()
export class CustomerFeaturesService {
  constructor(private readonly prisma: PrismaService, private readonly wallets: WalletsService) {}

  private money(value: string): Decimal {
    const amount = new Decimal(value);
    if (!amount.isFinite() || !amount.gt(0) || amount.decimalPlaces() > 2) throw new BadRequestException('Amount must be a positive decimal with at most two fractional digits');
    return amount;
  }
  private currency(value: string): string { return value.trim().toUpperCase(); }
  private async event(eventType: string, aggregateType: string, aggregateId: string, userIds: string[], payload: Record<string, unknown>) {
    await this.prisma.outboxEvent.create({ data: { producer: 'WALLET_SERVICE', eventType, aggregateType, aggregateId, payload: { ...payload, userIds } } });
  }
  private ensureFuture(value: string, label: string): Date {
    const date = new Date(value); if (date.getTime() <= Date.now()) throw new BadRequestException(`${label} must be in the future`); return date;
  }
  private async ownedWallet(walletId: string, userId: string, currency?: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.userId !== userId) throw new ForbiddenException('Wallet ownership is required');
    if (currency && wallet.currency !== this.currency(currency)) throw new BadRequestException('Currency must match the wallet');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Wallet must be active');
    return wallet;
  }

  async insights(userId: string, fromValue?: string, toValue?: string, daysValue?: string, categoryValue?: string) {
    const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
    const end = toValue ? new Date(`${toValue}T23:59:59.999Z`) : new Date();
    let start: Date;
    if (fromValue || toValue) {
      if (!fromValue || !toValue || !dayPattern.test(fromValue) || !dayPattern.test(toValue) || Number.isNaN(end.getTime())) throw new BadRequestException('A valid from and to date are required');
      start = new Date(`${fromValue}T00:00:00.000Z`);
    } else {
      const days = daysValue === undefined ? 30 : Number(daysValue);
      if (!Number.isInteger(days) || ![1, 7, 30, 90].includes(days)) throw new BadRequestException('Range must be today, 7, 30, or 90 days');
      start = new Date(end); start.setUTCDate(start.getUTCDate() - days + 1); start.setUTCHours(0, 0, 0, 0);
    }
    if (start > end) throw new BadRequestException('From date must not be after to date');
    if (end.getTime() - start.getTime() > 366 * 86_400_000) throw new BadRequestException('Custom range cannot exceed 366 days');

    const wallets = await this.prisma.wallet.findMany({ where: { userId }, select: { id: true } });
    const walletIds = wallets.map((wallet) => wallet.id);
    const createdAt = { gte: start, lte: end };
    const [deposits, withdrawals, transfers] = walletIds.length ? await Promise.all([
      this.prisma.deposit.findMany({ where: { walletId: { in: walletIds }, createdAt }, select: { id: true, amount: true, currency: true, status: true, createdAt: true } }),
      this.prisma.withdrawal.findMany({ where: { walletId: { in: walletIds }, createdAt }, select: { id: true, amount: true, currency: true, status: true, createdAt: true } }),
      this.prisma.transfer.findMany({ where: { OR: [{ sourceWalletId: { in: walletIds } }, { destinationWalletId: { in: walletIds } }], createdAt }, select: { id: true, sourceWalletId: true, amount: true, currency: true, status: true, createdAt: true } }),
    ]) : [[], [], []];
    const classifications = transfers.length ? await this.prisma.transactionClassification.findMany({ where: { userId, transferId: { in: transfers.map(item=>item.id) } }, select: { transferId: true, category: true } }) : [];
    const categoryByTransfer = new Map(classifications.map(item=>[item.transferId,item.category]));
    const requestedCategory = categoryValue?.trim().toUpperCase();
    const allowedCategories = ['FOOD','SHOPPING','TRAVEL','BILLS','RECHARGE','TRANSFER','RENT','ENTERTAINMENT','OTHER'];
    if (requestedCategory && !allowedCategories.includes(requestedCategory)) throw new BadRequestException('Unknown transaction category');
    const activity = [
      ...deposits.map((item) => ({ ...item, type: 'DEPOSIT', direction: 'CREDIT' as const })),
      ...withdrawals.map((item) => ({ ...item, type: 'WITHDRAWAL', direction: 'DEBIT' as const })),
      ...transfers.map((item) => ({ ...item, type: 'TRANSFER', direction: walletIds.includes(item.sourceWalletId) ? 'DEBIT' as const : 'CREDIT' as const, category: categoryByTransfer.get(item.id) ?? null })),
    ].filter(item=>!requestedCategory || ('category' in item && item.category===requestedCategory)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    type Bucket = { currency: string; incoming: Decimal; outgoing: Decimal; successfulCount: number; failedOrReversedCount: number; successfulTotal: Decimal; largest: Decimal; trend: Map<string, { incoming: Decimal; outgoing: Decimal }> };
    const buckets = new Map<string, Bucket>();
    for (const item of activity) {
      const bucket = buckets.get(item.currency) ?? { currency: item.currency, incoming: new Decimal(0), outgoing: new Decimal(0), successfulCount: 0, failedOrReversedCount: 0, successfulTotal: new Decimal(0), largest: new Decimal(0), trend: new Map() };
      const successful = item.status === 'COMPLETED';
      if (successful) {
        bucket.successfulCount += 1; bucket.successfulTotal = bucket.successfulTotal.add(item.amount); if (item.amount.gt(bucket.largest)) bucket.largest = item.amount;
        if (item.direction === 'CREDIT') bucket.incoming = bucket.incoming.add(item.amount); else bucket.outgoing = bucket.outgoing.add(item.amount);
        const date = item.createdAt.toISOString().slice(0, 10); const point = bucket.trend.get(date) ?? { incoming: new Decimal(0), outgoing: new Decimal(0) };
        if (item.direction === 'CREDIT') point.incoming = point.incoming.add(item.amount); else point.outgoing = point.outgoing.add(item.amount); bucket.trend.set(date, point);
      } else if (item.status === 'FAILED' || item.status === 'REVERSED') bucket.failedOrReversedCount += 1;
      buckets.set(item.currency, bucket);
    }
    return {
      range: { from: start.toISOString(), to: end.toISOString() }, transactionCount: activity.length,
      currencies: [...buckets.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map((bucket) => ({
        currency: bucket.currency, incoming: bucket.incoming.toString(), outgoing: bucket.outgoing.toString(), successfulCount: bucket.successfulCount,
        failedOrCancelledCount: bucket.failedOrReversedCount, averageAmount: bucket.successfulCount ? bucket.successfulTotal.div(bucket.successfulCount).toDecimalPlaces(2).toString() : '0', largestAmount: bucket.largest.toString(),
        trend: [...bucket.trend.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, incoming: value.incoming.toString(), outgoing: value.outgoing.toString() })),
      })),
      recent: activity.slice(0, 10).map((item) => ({ id: item.id, type: item.type, direction: item.direction, amount: item.amount.toString(), currency: item.currency, status: item.status, createdAt: item.createdAt })),
      categoriesAvailable: classifications.length > 0,
      categoryTotals: allowedCategories.map(category=>({ category, currencies: [...new Set(activity.filter(item=>'category' in item&&item.category===category).map(item=>item.currency))].map(currency=>({ currency, amount: activity.filter(item=>'category' in item&&item.category===category&&item.currency===currency&&item.status==='COMPLETED'&&item.direction==='DEBIT').reduce((sum,item)=>sum.add(item.amount),new Decimal(0)).toString() })) })).filter(item=>item.currencies.length),
      typeBreakdown: ['DEPOSIT','WITHDRAWAL','TRANSFER'].map(type=>({ type, count: activity.filter(item=>item.type===type).length })),
      monthlyTrend: [...new Set(activity.map(item=>item.createdAt.toISOString().slice(0,7)))].sort().map(month=>({ month, count: activity.filter(item=>item.createdAt.toISOString().startsWith(month)).length })),
    };
  }

  async listContacts(userId: string, search?: string) {
    return this.prisma.contact.findMany({ where: { ownerUserId: userId, ...(search ? { OR: [{ nickname: { contains: search, mode: 'insensitive' } }, { recipient: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { vpa: { contains: search, mode: 'insensitive' } }] } }] } : {}) }, include: { recipient: { select: { id: true, firstName: true, lastName: true, vpa: true } } }, orderBy: [{ favourite: 'desc' }, { updatedAt: 'desc' }] });
  }
  async createContact(userId: string, dto: CreateContactDto) {
    if (dto.recipientUserId === userId) throw new BadRequestException('You cannot add yourself as a contact');
    const recipient = await this.prisma.user.findUnique({ where: { id: dto.recipientUserId } });
    if (!recipient || recipient.status !== 'ACTIVE') throw new NotFoundException('Active recipient not found');
    try { return await this.prisma.contact.create({ data: { ownerUserId: userId, recipientUserId: dto.recipientUserId, nickname: dto.nickname?.trim() || null } }); }
    catch (error) { if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new ConflictException('Contact already exists'); throw error; }
  }
  async updateContact(userId: string, id: string, dto: UpdateContactDto) {
    const existing = await this.prisma.contact.findUnique({ where: { id } }); if (!existing) throw new NotFoundException('Contact not found');
    if (existing.ownerUserId !== userId) throw new ForbiddenException('Contact ownership is required');
    return this.prisma.contact.update({ where: { id }, data: { ...(dto.nickname !== undefined ? { nickname: dto.nickname.trim() || null } : {}), ...(dto.favourite !== undefined ? { favourite: dto.favourite } : {}) } });
  }
  async deleteContact(userId: string, id: string) { await this.updateContact(userId, id, {}); await this.prisma.contact.delete({ where: { id } }); return { deleted: true }; }

  async createMoneyRequest(userId: string, dto: CreateMoneyRequestDto) {
    const currency = this.currency(dto.currency); const amount = this.money(dto.amount); const note = dto.note?.trim() || null; const expiresAt = new Date(dto.expiresAt);
    const replay = (existing: { requesterUserId: string; payerUserId: string; walletId: string; currency: string; amount: Decimal; note: string | null; expiresAt: Date }) => {
      if (existing.requesterUserId !== userId) throw new ConflictException('Idempotency key is already in use');
      if (existing.payerUserId !== dto.payerUserId || existing.walletId !== dto.walletId || existing.currency !== currency || !existing.amount.eq(amount) || existing.note !== note || existing.expiresAt.getTime() !== expiresAt.getTime()) throw new ConflictException('Idempotency key was used for a different money request');
      return existing;
    };
    const existing = await this.prisma.moneyRequest.findUnique({ where: { idempotencyKey: dto.idempotencyKey } }); if (existing) return replay(existing);
    if (dto.payerUserId === userId) throw new BadRequestException('You cannot request money from yourself');
    await this.ownedWallet(dto.walletId, userId, dto.currency);
    const payer = await this.prisma.user.findUnique({ where: { id: dto.payerUserId } }); if (!payer || payer.status !== 'ACTIVE') throw new NotFoundException('Active payer not found');
    this.ensureFuture(dto.expiresAt, 'Expiry');
    try { const request = await this.prisma.moneyRequest.create({ data: { requesterUserId: userId, payerUserId: dto.payerUserId, walletId: dto.walletId, currency, amount, note, expiresAt, idempotencyKey: dto.idempotencyKey } }); await this.event('money.request.created', 'MONEY_REQUEST', request.id, [dto.payerUserId], { requestId: request.id }); return request; }
    catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error; const winner = await this.prisma.moneyRequest.findUnique({ where: { idempotencyKey: dto.idempotencyKey } }); if (!winner) throw error; return replay(winner); }
  }
  async listMoneyRequests(userId: string) { await this.expireMoneyRequests(); return this.prisma.moneyRequest.findMany({ where: { OR: [{ requesterUserId: userId }, { payerUserId: userId }] }, include: { requester: { select: { id: true, firstName: true, lastName: true, vpa: true } }, payer: { select: { id: true, firstName: true, lastName: true, vpa: true } } }, orderBy: { createdAt: 'desc' } }); }
  private async moneyRequest(userId: string, id: string) { const item = await this.prisma.moneyRequest.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Money request not found'); if (item.requesterUserId !== userId && item.payerUserId !== userId) throw new ForbiddenException('Money request access denied'); return item; }
  private async expireMoneyRequests() { await this.prisma.moneyRequest.updateMany({ where: { status: 'PENDING', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } }); }
  async acceptMoneyRequest(userId: string, id: string, dto: AcceptMoneyRequestDto) {
    const item = await this.moneyRequest(userId, id); if (item.payerUserId !== userId) throw new ForbiddenException('Only the payer can accept this request');
    if (!['PENDING', 'ACCEPTED'].includes(item.status) || (item.status === 'PENDING' && item.expiresAt <= new Date())) throw new ConflictException('Money request is no longer payable');
    if (dto.sourceWalletId.trim() === item.walletId) throw new ConflictException('Money request settlement source conflicts with this idempotency boundary');
    let transfer;
    try { transfer = await this.wallets.transferWallet({ sourceWalletId: dto.sourceWalletId, destinationWalletId: item.walletId, amount: item.amount.toString(), currency: item.currency, description: item.note || 'Money request settlement', idempotencyKey: `money-request:${id}` }, userId); }
    catch (error) { if (error instanceof ForbiddenException) throw new ConflictException('Money request settlement source conflicts with this idempotency boundary'); throw error; }
    await this.ownedWallet(dto.sourceWalletId, userId, item.currency);
    const won = await this.prisma.moneyRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'ACCEPTED', settlementTransferId: transfer.id } });
    if (won.count === 1) await this.event('money.request.accepted', 'MONEY_REQUEST', id, [item.requesterUserId], { requestId: id });
    return this.prisma.moneyRequest.findUniqueOrThrow({ where: { id } });
  }
  async transitionMoneyRequest(userId: string, id: string, action: 'DECLINED' | 'CANCELLED') {
    const item = await this.moneyRequest(userId, id); if (item.status !== 'PENDING') throw new ConflictException('Money request is no longer pending');
    if (action === 'DECLINED' && item.payerUserId !== userId) throw new ForbiddenException('Only the payer can decline');
    if (action === 'CANCELLED' && item.requesterUserId !== userId) throw new ForbiddenException('Only the requester can cancel');
    const updated = await this.prisma.moneyRequest.update({ where: { id }, data: { status: action } });
    await this.event(`money.request.${action.toLowerCase()}`, 'MONEY_REQUEST', id, [action === 'DECLINED' ? item.requesterUserId : item.payerUserId], { requestId: id }); return updated;
  }

  async createSplit(userId: string, dto: CreateBillSplitDto) {
    const total = this.money(dto.totalAmount);
    const ids = dto.allocations.map((item) => item.participantUserId);
    const amounts = dto.allocations.map((item) => this.money(item.amount)); const sum = amounts.reduce((value, amount) => value.add(amount), new Decimal(0)); if (!sum.equals(total)) throw new BadRequestException('Allocations must equal the total amount exactly');
    if (dto.type === 'EQUAL' && amounts.some((amount) => !amount.equals(amounts[0]))) throw new BadRequestException('Equal split allocations must be equal');
    const currency = this.currency(dto.currency); const note = dto.note?.trim() || null; const dueAt = new Date(dto.dueAt);
    const replay = (existing: { creatorUserId: string; walletId: string; currency: string; totalAmount: Decimal; type: string; note: string | null; dueAt: Date; allocations: { participantUserId: string; amount: Decimal }[] }) => {
      if (existing.creatorUserId !== userId) throw new ConflictException('Idempotency key is already in use');
      const stored = [...existing.allocations].sort((a, b) => a.participantUserId.localeCompare(b.participantUserId)); const incoming = dto.allocations.map((item, index) => ({ participantUserId: item.participantUserId, amount: amounts[index] })).sort((a, b) => a.participantUserId.localeCompare(b.participantUserId));
      const allocationsMatch = stored.length === incoming.length && stored.every((item, index) => item.participantUserId === incoming[index].participantUserId && item.amount.eq(incoming[index].amount));
      if (existing.walletId !== dto.walletId || existing.currency !== currency || !existing.totalAmount.eq(total) || existing.type !== dto.type || existing.note !== note || existing.dueAt.getTime() !== dueAt.getTime() || !allocationsMatch) throw new ConflictException('Idempotency key was used for a different split request');
      return existing;
    };
    const existing = await this.prisma.billSplit.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { allocations: true } }); if (existing) return replay(existing);
    await this.ownedWallet(dto.walletId, userId, dto.currency);
    if (new Set(ids).size !== ids.length || ids.includes(userId)) throw new BadRequestException('Participants must be unique and cannot include the creator');
    const users = await this.prisma.user.count({ where: { id: { in: ids }, status: 'ACTIVE' } }); if (users !== ids.length) throw new BadRequestException('Every participant must be active');
    this.ensureFuture(dto.dueAt, 'Due date');
    try { const split = await this.prisma.billSplit.create({ data: { creatorUserId: userId, walletId: dto.walletId, currency, totalAmount: total, type: dto.type, note, dueAt, idempotencyKey: dto.idempotencyKey, allocations: { create: dto.allocations.map((item, index) => ({ participantUserId: item.participantUserId, amount: amounts[index] })) } }, include: { allocations: true } }); await this.event('split.created', 'BILL_SPLIT', split.id, ids, { splitId: split.id }); return split; }
    catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error; const winner = await this.prisma.billSplit.findUnique({ where: { idempotencyKey: dto.idempotencyKey }, include: { allocations: true } }); if (!winner) throw error; return replay(winner); }
  }
  async listSplits(userId: string) { await this.prisma.billSplit.updateMany({ where: { status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueAt: { lte: new Date() } }, data: { status: 'EXPIRED' } }); return this.prisma.billSplit.findMany({ where: { OR: [{ creatorUserId: userId }, { allocations: { some: { participantUserId: userId } } }] }, include: { allocations: true }, orderBy: { createdAt: 'desc' } }); }
  async payAllocation(userId: string, allocationId: string, dto: PaySplitAllocationDto) {
    const allocation = await this.prisma.splitAllocation.findUnique({ where: { id: allocationId }, include: { split: true } }); if (!allocation) throw new NotFoundException('Split allocation not found');
    if (allocation.participantUserId !== userId) throw new ForbiddenException('Only the participant can pay this allocation'); if (!['PENDING', 'PAID'].includes(allocation.status) || (allocation.status === 'PENDING' && (!['OPEN', 'PARTIALLY_PAID'].includes(allocation.split.status) || allocation.split.dueAt <= new Date()))) throw new ConflictException('Split is no longer payable');
    if (dto.sourceWalletId.trim() === allocation.split.walletId) throw new ConflictException('Split settlement source conflicts with this idempotency boundary');
    let transfer;
    try { transfer = await this.wallets.transferWallet({ sourceWalletId: dto.sourceWalletId, destinationWalletId: allocation.split.walletId, amount: allocation.amount.toString(), currency: allocation.split.currency, description: allocation.split.note || 'Split bill settlement', idempotencyKey: `split:${allocationId}` }, userId); }
    catch (error) { if (error instanceof ForbiddenException) throw new ConflictException('Split settlement source conflicts with this idempotency boundary'); throw error; }
    await this.ownedWallet(dto.sourceWalletId, userId, allocation.split.currency);
    if (allocation.status === 'PAID') return allocation;
    const won = await this.prisma.$transaction(async (tx) => { const paid = await tx.splitAllocation.updateMany({ where: { id: allocationId, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date(), settlementTransferId: transfer.id } }); if (paid.count === 0) return false; const remaining = await tx.splitAllocation.count({ where: { splitId: allocation.splitId, status: 'PENDING' } }); await tx.billSplit.update({ where: { id: allocation.splitId }, data: { status: remaining === 0 ? 'PAID' : 'PARTIALLY_PAID' } }); return true; });
    if (won) await this.event('split.allocation.paid', 'BILL_SPLIT', allocation.splitId, [allocation.split.creatorUserId], { splitId: allocation.splitId, allocationId });
    return this.prisma.splitAllocation.findUniqueOrThrow({ where: { id: allocationId } });
  }
  async cancelSplit(userId: string, id: string) { const split = await this.prisma.billSplit.findUnique({ where: { id } }); if (!split) throw new NotFoundException('Split not found'); if (split.creatorUserId !== userId) throw new ForbiddenException('Only the creator can cancel'); if (!['OPEN', 'PARTIALLY_PAID'].includes(split.status)) throw new ConflictException('Split cannot be cancelled'); return this.prisma.billSplit.update({ where: { id }, data: { status: 'CANCELLED', allocations: { updateMany: { where: { status: 'PENDING' }, data: { status: 'CANCELLED' } } } } }); }

  async listOffers(userId: string) { const now = new Date(); await this.prisma.offer.updateMany({ where: { status: 'ACTIVE', expiresAt: { lte: now } }, data: { status: 'EXPIRED' } }); const offers = await this.prisma.offer.findMany({ where: { status: { in: ['ACTIVE', 'EXPIRED'] } }, include: { claims: { where: { userId }, select: { id: true, status: true } } }, orderBy: { expiresAt: 'asc' } }); return offers.map((offer) => ({ ...offer, eligible: offer.status === 'ACTIVE' && offer.startsAt <= now && offer.expiresAt > now && offer.claims.length === 0 })); }
  async getOffer(userId: string, id: string) { const item = (await this.listOffers(userId)).find((offer) => offer.id === id); if (!item) throw new NotFoundException('Offer not found'); return item; }
  async claimOffer(userId: string, id: string) {
    const existing = await this.prisma.offerClaim.findUnique({ where: { offerId_userId: { offerId: id, userId } } }); if (existing) return existing;
    const offer = await this.prisma.offer.findUnique({ where: { id }, include: { _count: { select: { claims: true } } } }); const now = new Date(); if (!offer) throw new NotFoundException('Offer not found'); if (offer.status !== 'ACTIVE' || offer.startsAt > now || offer.expiresAt <= now) throw new ConflictException('Offer is not active'); if (offer.usageLimit !== null && offer._count.claims >= offer.usageLimit) throw new ConflictException('Offer usage limit reached');
    try { const claim = await this.prisma.offerClaim.create({ data: { offerId: id, userId, expiresAt: offer.expiresAt } }); await this.event('offer.claimed', 'OFFER', id, [userId], { offerId: id, claimId: claim.id }); return claim; }
    catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error; const winner = await this.prisma.offerClaim.findUnique({ where: { offerId_userId: { offerId: id, userId } } }); if (!winner) throw error; return winner; }
  }
  async adminOffers() { return this.prisma.offer.findMany({ include: { _count: { select: { claims: true } } }, orderBy: { createdAt: 'desc' } }); }
  private offerDates(startsAt: string, expiresAt: string) { const starts = new Date(startsAt); const expires = new Date(expiresAt); if (expires <= starts) throw new BadRequestException('Offer expiry must be after its start date'); return { startsAt: starts, expiresAt: expires }; }
  async createOffer(actor: Actor, dto: CreateOfferDto) { const dates = this.offerDates(dto.startsAt, dto.expiresAt); if (dto.status === 'ACTIVE' && dates.expiresAt <= new Date()) throw new BadRequestException('An expired offer cannot be activated'); const offer = await this.prisma.offer.create({ data: { ...dto, currency: this.currency(dto.currency), ...dates, eligibilityRules: dto.eligibilityRules as never } }); await this.audit(actor, 'CREATE_OFFER', 'OFFER', offer.id); return offer; }
  async updateOffer(actor: Actor, id: string, dto: UpdateOfferDto) { const current = await this.prisma.offer.findUnique({ where: { id } }); if (!current) throw new NotFoundException('Offer not found'); const dates = this.offerDates(dto.startsAt, dto.expiresAt); if (dto.status === 'ACTIVE' && dates.expiresAt <= new Date()) throw new BadRequestException('An expired offer cannot be activated'); const offer = await this.prisma.offer.update({ where: { id }, data: { ...dto, currency: this.currency(dto.currency), ...dates, eligibilityRules: dto.eligibilityRules as never } }); await this.audit(actor, 'UPDATE_OFFER', 'OFFER', id); return offer; }

  async createRecharge(userId: string, dto: CreateRechargeDto) {
    const operator = dto.operator.trim();
    const planId = dto.planId || null;
    const amount = this.money(dto.amount);
    const currency = this.currency(dto.currency);
    const replay = (existing: { userId: string; operator: string; mobileNumber: string; planId: string | null; amount: Decimal; currency: string }) => {
      if (existing.userId !== userId) throw new ConflictException('Idempotency key is already in use');
      if (existing.operator !== operator || existing.mobileNumber !== dto.mobileNumber || existing.planId !== planId || !existing.amount.eq(amount) || existing.currency !== currency) {
        throw new ConflictException('Idempotency key was used for a different recharge request');
      }
      return { ...existing, code: PROVIDER_NOT_CONFIGURED, message: 'Recharge provider is not configured.' };
    };
    const existing = await this.prisma.rechargeAttempt.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) return replay(existing);
    try {
      const item = await this.prisma.rechargeAttempt.create({ data: { user: { connect: { id: userId } }, operator, mobileNumber: dto.mobileNumber, planId, amount, currency, idempotencyKey: dto.idempotencyKey, failureCode: PROVIDER_NOT_CONFIGURED } });
      await this.event('recharge.status', 'RECHARGE_ATTEMPT', item.id, [userId], { attemptId: item.id, status: item.status });
      return { ...item, code: PROVIDER_NOT_CONFIGURED, message: 'Recharge provider is not configured.' };
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
      const winner = await this.prisma.rechargeAttempt.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (!winner) throw error;
      return replay(winner);
    }
  }
  async rechargeHistory(userId: string) { return this.prisma.rechargeAttempt.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  providerStatus() { return { recharge: PROVIDER_NOT_CONFIGURED, biller: PROVIDER_NOT_CONFIGURED, mandates: PROVIDER_NOT_CONFIGURED }; }
  rechargePlans() { return { code: PROVIDER_NOT_CONFIGURED, plans: [], message: 'Recharge provider is not configured.' }; }
  billers() { return { code: PROVIDER_NOT_CONFIGURED, billers: [], message: 'Biller provider is not configured.' }; }
  validateBill() { return { code: PROVIDER_NOT_CONFIGURED, bill: null, message: 'Biller provider is not configured.' }; }
  async createBillPayment(userId: string, dto: CreateBillPaymentDto) {
    const billerId = dto.billerId || null; const customerRef = dto.customerRef.trim(); const amount = this.money(dto.amount); const currency = this.currency(dto.currency);
    const replay = (existing: { userId: string; category: string; billerId: string | null; customerRef: string; amount: Decimal; currency: string }) => {
      if (existing.userId !== userId) throw new ConflictException('Idempotency key is already in use');
      if (existing.category !== dto.category || existing.billerId !== billerId || existing.customerRef !== customerRef || !existing.amount.eq(amount) || existing.currency !== currency) throw new ConflictException('Idempotency key was used for a different bill payment request');
      return { ...existing, code: PROVIDER_NOT_CONFIGURED, message: 'Bill payment provider is not configured.' };
    };
    const existing = await this.prisma.billPaymentAttempt.findUnique({ where: { idempotencyKey: dto.idempotencyKey } }); if (existing) return replay(existing);
    try { const item = await this.prisma.billPaymentAttempt.create({ data: { user: { connect: { id: userId } }, category: dto.category, billerId, customerRef, amount, currency, idempotencyKey: dto.idempotencyKey, failureCode: PROVIDER_NOT_CONFIGURED } }); await this.event('bill.payment.status', 'BILL_PAYMENT_ATTEMPT', item.id, [userId], { attemptId: item.id, status: item.status }); return { ...item, code: PROVIDER_NOT_CONFIGURED, message: 'Bill payment provider is not configured.' }; }
    catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error; const winner = await this.prisma.billPaymentAttempt.findUnique({ where: { idempotencyKey: dto.idempotencyKey } }); if (!winner) throw error; return replay(winner); }
  }
  async billHistory(userId: string) { return this.prisma.billPaymentAttempt.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }

  async listSavedBillers(userId: string) {
    return this.prisma.savedBiller.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createSavedBiller(userId: string, dto: CreateSavedBillerDto) {
    const billerId = dto.billerId.trim();
    const customerRef = dto.customerRef.trim();
    const nickname = dto.nickname?.trim() || null;

    if (!billerId || !customerRef) {
      throw new BadRequestException(
        'Biller and customer reference are required',
      );
    }

    return this.prisma.savedBiller.upsert({
      where: {
        userId_billerId_customerRef_category: {
          userId,
          billerId,
          customerRef,
          category: dto.category,
        },
      },
      create: {
        userId,
        billerId,
        category: dto.category,
        customerRef,
        nickname,
      },
      update: {
        nickname,
      },
    });
  }

  async deleteSavedBiller(userId: string, id: string) {
    const item = await this.prisma.savedBiller.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('Saved biller not found');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException(
        'Saved biller ownership is required',
      );
    }

    return this.prisma.savedBiller.delete({
      where: { id },
    });
  }
  async listBillReminders(userId: string) {
    return this.prisma.billReminder.findMany({
      where: { userId },
      orderBy: { remindAt: 'asc' },
    });
  }

  async createBillReminder(
    userId: string,
    dto: CreateBillReminderDto,
  ) {
    const savedBiller =
      await this.prisma.savedBiller.findUnique({
        where: {
          id: dto.savedBillerId,
        },
      });

    if (!savedBiller) {
      throw new NotFoundException(
        'Saved biller not found',
      );
    }

    if (savedBiller.userId !== userId) {
      throw new ForbiddenException(
        'Saved biller ownership is required',
      );
    }

    const remindAt =
      new Date(dto.remindAt);

    if (
      Number.isNaN(remindAt.getTime()) ||
      remindAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'Reminder must be scheduled in the future',
      );
    }

    const note =
      dto.note?.trim() || null;

    return this.prisma.billReminder.upsert({
      where: {
        userId_savedBillerId_remindAt: {
          userId,
          savedBillerId:
            savedBiller.id,
          remindAt,
        },
      },
      create: {
        userId,
        savedBillerId:
          savedBiller.id,
        remindAt,
        note,
      },
      update: {
        note,
      },
    });
  }

  async deleteBillReminder(
    userId: string,
    id: string,
  ) {
    const reminder =
      await this.prisma.billReminder.findUnique({
        where: { id },
      });

    if (!reminder) {
      throw new NotFoundException(
        'Bill reminder not found',
      );
    }

    if (reminder.userId !== userId) {
      throw new ForbiddenException(
        'Bill reminder ownership is required',
      );
    }

    return this.prisma.billReminder.delete({
      where: { id },
    });
  }
  async createMandate(userId: string, dto: CreateMandateDto) {
    if (!dto.consent) throw new BadRequestException('Explicit consent is required');
    const merchant = dto.merchant.trim(); const max = this.money(dto.maxAmount); const amount = dto.amount ? this.money(dto.amount) : null; if (amount?.gt(max)) throw new BadRequestException('Amount cannot exceed maximum amount');
    const currency = this.currency(dto.currency); const start = this.ensureFuture(dto.startAt, 'Start date'); const end = dto.endAt ? this.ensureFuture(dto.endAt, 'End date') : null; if (end && end <= start) throw new BadRequestException('End date must be after start date');
    const replay = (existing: { userId: string; merchant: string; amount: Decimal | null; maxAmount: Decimal; currency: string; frequency: string; startAt: Date; endAt: Date | null }) => {
      if (existing.userId !== userId) throw new ConflictException('Idempotency key is already in use');
      const amountMatches = existing.amount === null ? amount === null : amount !== null && existing.amount.eq(amount);
      if (existing.merchant !== merchant || !amountMatches || !existing.maxAmount.eq(max) || existing.currency !== currency || existing.frequency !== dto.frequency || existing.startAt.getTime() !== start.getTime() || existing.endAt?.getTime() !== end?.getTime()) throw new ConflictException('Idempotency key was used for a different mandate request');
      return { ...existing, code: PROVIDER_NOT_CONFIGURED, message: 'AutoPay provider is not configured; no debit will occur.' };
    };
    const existing = await this.prisma.mandate.findUnique({ where: { idempotencyKey: dto.idempotencyKey } }); if (existing) return replay(existing);
    try { const mandate = await this.prisma.mandate.create({ data: { userId, merchant, amount, maxAmount: max, currency, frequency: dto.frequency, startAt: start, endAt: end, consentAt: new Date(), idempotencyKey: dto.idempotencyKey } }); await this.event('mandate.created', 'MANDATE', mandate.id, [userId], { mandateId: mandate.id, status: mandate.status }); return { ...mandate, code: PROVIDER_NOT_CONFIGURED, message: 'AutoPay provider is not configured; no debit will occur.' }; }
    catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error; const winner = await this.prisma.mandate.findUnique({ where: { idempotencyKey: dto.idempotencyKey } }); if (!winner) throw error; return replay(winner); }
  }
  async mandates(userId: string) { return this.prisma.mandate.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  async mandate(userId: string, id: string) { const item = await this.prisma.mandate.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Mandate not found'); if (item.userId !== userId) throw new ForbiddenException('Mandate ownership is required'); return { ...item, providerState: item.providerMandateId ? item.status : PROVIDER_NOT_CONFIGURED }; }
  async mandateAction(userId: string, id: string, action: 'pause' | 'resume' | 'cancel' | 'authorize') { const item = await this.prisma.mandate.findUnique({ where: { id } }); if (!item) throw new NotFoundException('Mandate not found'); if (item.userId !== userId) throw new ForbiddenException('Mandate ownership is required'); if (action === 'authorize') return { ...item, code: PROVIDER_NOT_CONFIGURED, message: 'AutoPay provider is not configured; mandate cannot be activated.' }; const target = action === 'cancel' ? 'CANCELLED' : action === 'pause' ? 'PAUSED' : 'ACTIVE'; if (action === 'resume' && !item.providerMandateId) throw new ConflictException('A provider mandate is required before resuming'); if (action === 'pause' && item.status !== 'ACTIVE') throw new ConflictException('Only active mandates can be paused'); if (action === 'cancel' && item.status === 'CANCELLED') return item; const updated = await this.prisma.mandate.update({ where: { id }, data: { status: target } }); await this.event(`mandate.${action}`, 'MANDATE', id, [userId], { mandateId: id }); return updated; }

  async createCase(userId: string, dto: CreateSupportCaseDto) { if (dto.transactionId) { const transfer = await this.prisma.transfer.findUnique({ where: { id: dto.transactionId }, include: { sourceWallet: true, destinationWallet: true } }); if (!transfer) throw new NotFoundException('Transaction not found'); if (transfer.sourceWallet.userId !== userId && transfer.destinationWallet.userId !== userId) throw new ForbiddenException('Transaction ownership is required'); } const item = await this.prisma.supportCase.create({ data: { userId, transactionId: dto.transactionId || null, category: dto.category.trim(), description: dto.description.trim(), events: { create: { actorUserId: userId, toStatus: 'OPEN', note: 'Case opened' } } }, include: { events: true } }); await this.event('support.case.created', 'SUPPORT_CASE', item.id, [userId], { caseId: item.id }); return item; }
  async cases(userId: string) { return this.prisma.supportCase.findMany({ where: { userId }, include: { events: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }); }
  async caseDetails(userId: string, id: string, admin = false) { const item = await this.prisma.supportCase.findUnique({ where: { id }, include: { events: { orderBy: { createdAt: 'asc' } } } }); if (!item) throw new NotFoundException('Case not found'); if (!admin && item.userId !== userId) throw new ForbiddenException('Case ownership is required'); return item; }
  async adminCases() { return this.prisma.supportCase.findMany({ include: { user: { select: { id: true, email: true, firstName: true, lastName: true } }, events: true }, orderBy: { createdAt: 'desc' } }); }
  async adminMoneyRequests() { await this.expireMoneyRequests(); return this.prisma.moneyRequest.findMany({ include: { requester: { select: { id: true, email: true, firstName: true, lastName: true } }, payer: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } }); }
  async adminSplits() { return this.prisma.billSplit.findMany({ include: { creator: { select: { id: true, email: true, firstName: true, lastName: true } }, allocations: { include: { participant: { select: { id: true, email: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' } }); }
  async adminMandates() { return this.prisma.mandate.findMany({ include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' } }); }
  async adminProviderOperations() {
    const [rechargeAttempts, billAttempts] = await Promise.all([
      this.prisma.rechargeAttempt.findMany({ select: { id: true, userId: true, operator: true, mobileNumber: true, amount: true, currency: true, status: true, failureCode: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.billPaymentAttempt.findMany({ select: { id: true, userId: true, category: true, billerId: true, customerRef: true, amount: true, currency: true, status: true, failureCode: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    ]);
    return { providers: this.providerStatus(), rechargeAttempts, billAttempts };
  }
  async updateCase(actor: Actor, id: string, dto: UpdateSupportCaseDto) { const current = await this.caseDetails(actor.id, id, true); const transitions: Record<string, string[]> = { OPEN: ['OPEN', 'UNDER_REVIEW', 'REJECTED'], UNDER_REVIEW: ['UNDER_REVIEW', 'RESOLVED', 'REJECTED'], RESOLVED: ['RESOLVED', 'CLOSED', 'UNDER_REVIEW'], REJECTED: ['REJECTED', 'CLOSED', 'UNDER_REVIEW'], CLOSED: ['CLOSED'] }; if (!transitions[current.status]?.includes(dto.status)) throw new ConflictException(`Support case cannot transition from ${current.status} to ${dto.status}`); const resolution = dto.resolution?.trim() || null; if (['RESOLVED', 'REJECTED', 'CLOSED'].includes(dto.status) && !resolution && !current.resolution) throw new BadRequestException('A resolution is required before resolving, rejecting, or closing a case'); const closedAt = ['REJECTED', 'CLOSED'].includes(dto.status) ? new Date() : null; const updated = await this.prisma.supportCase.update({ where: { id }, data: { status: dto.status, priority: dto.priority, resolution: resolution ?? current.resolution, closedAt, events: { create: { actorUserId: actor.id, fromStatus: current.status, toStatus: dto.status, note: resolution } } } }); await this.audit(actor, 'UPDATE_SUPPORT_CASE', 'SUPPORT_CASE', id); await this.event('support.case.updated', 'SUPPORT_CASE', id, [current.userId], { caseId: id, status: dto.status }); return updated; }
  private async audit(actor: Actor, action: string, targetType: string, targetId: string) { await this.prisma.auditLog.create({ data: { actorUserId: actor.id, actorEmail: actor.email, action, targetType, targetId } }); }
}
