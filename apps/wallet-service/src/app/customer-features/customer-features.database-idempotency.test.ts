import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException, ForbiddenException } from '@nestjs/common';
// The workspace alias is intentionally mocked by Wallet Jest; this Node/tsx database test needs the real Prisma service.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { PrismaService } from '../../../../../libs/database/src/lib/prisma/prisma.service';
import { CreateBillPaymentDto, CreateBillSplitDto, CreateMandateDto, CreateMoneyRequestDto, CreateRechargeDto } from './customer-features.dto';
import { CustomerFeaturesService } from './customer-features.service';
import { WalletsService } from '../wallets/wallets.service';

const USER_A = '10000000-0000-4000-8000-000000000001';
const USER_B = '10000000-0000-4000-8000-000000000002';
const WALLET_A = '20000000-0000-4000-8000-000000000001';
const WALLET_B = '20000000-0000-4000-8000-000000000002';
const prisma = new PrismaService();
const wallets = new WalletsService(prisma, {} as never);
const service = new CustomerFeaturesService(prisma, wallets);
const base = (key: string): CreateRechargeDto => ({ operator: 'Operator A', mobileNumber: '+919876543210', planId: 'plan-a', amount: '249.00', currency: 'inr', idempotencyKey: key });

async function clean() {
  await prisma.outboxEvent.deleteMany({ where: { aggregateType: 'RECHARGE_ATTEMPT' } });
  await prisma.rechargeAttempt.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
}

async function snapshot() {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: USER_A, currency: 'INR' } } });
  return {
    attempts: await prisma.rechargeAttempt.count(), outbox: await prisma.outboxEvent.count({ where: { aggregateType: 'RECHARGE_ATTEMPT' } }),
    notifications: await prisma.notification.count(), transfers: await prisma.transfer.count(), ledgerEntries: await prisma.ledgerEntry.count(),
    balance: wallet.balance.toString(),
  };
}

function assertSingleEffect(before: Awaited<ReturnType<typeof snapshot>>, after: Awaited<ReturnType<typeof snapshot>>) {
  assert.equal(after.attempts - before.attempts, 1); assert.equal(after.outbox - before.outbox, 1);
  assert.equal(after.notifications - before.notifications, 0); assert.equal(after.transfers - before.transfers, 0);
  assert.equal(after.ledgerEntries - before.ledgerEntries, 0); assert.equal(after.balance, before.balance);
}


test('A: same user, key, and payload replays one RechargeAttempt', async () => {
  await clean(); const before = await snapshot(); const dto = base('recharge-a');
  const first = await service.createRecharge(USER_A, dto); const second = await service.createRecharge(USER_A, dto);
  assert.equal(second.id, first.id); assertSingleEffect(before, await snapshot());
});

test('B: same user and key with a different amount conflicts', async () => {
  await clean(); const before = await snapshot(); const dto = base('recharge-b'); await service.createRecharge(USER_A, dto);
  await assert.rejects(service.createRecharge(USER_A, { ...dto, amount: '499.00' }), ConflictException);
  const record = await prisma.rechargeAttempt.findUniqueOrThrow({ where: { idempotencyKey: dto.idempotencyKey } });
  assert.equal(record.amount.toString(), '249'); assertSingleEffect(before, await snapshot());
});

test('C: same user and key with a different operator conflicts', async () => {
  await clean(); const before = await snapshot(); const dto = base('recharge-c'); await service.createRecharge(USER_A, dto);
  await assert.rejects(service.createRecharge(USER_A, { ...dto, operator: 'Operator B' }), ConflictException); assertSingleEffect(before, await snapshot());
});

test('D: a different user cannot reuse the key', async () => {
  await clean(); const before = await snapshot(); const dto = base('recharge-d'); await service.createRecharge(USER_A, dto);
  await assert.rejects(service.createRecharge(USER_B, dto), ConflictException); assertSingleEffect(before, await snapshot());
});

test('E: concurrent identical requests produce one logical attempt', async () => {
  await clean(); const before = await snapshot(); const dto = base('recharge-e');
  const results = await Promise.all([service.createRecharge(USER_A, dto), service.createRecharge(USER_A, dto)]);
  assert.equal(results[0].id, results[1].id); assertSingleEffect(before, await snapshot());
});

test('F: concurrent incompatible requests accept one payload and reject the other', async () => {
  await clean(); const before = await snapshot(); const dto = base('recharge-f');
  const results = await Promise.allSettled([service.createRecharge(USER_A, dto), service.createRecharge(USER_A, { ...dto, amount: '499.00' })]);
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  const rejected = results.find(({ status }) => status === 'rejected');
  assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ConflictException);
  assertSingleEffect(before, await snapshot());
});

function creationMatrix<D>(name: string, prefix: string, aggregateType: string, cleanRecords: () => Promise<unknown>, countRecords: () => Promise<number>, make: (key: string) => D, different: (dto: D) => D, invoke: (userId: string, dto: D) => Promise<{ id: string }>) {
  const effects = async () => ({ records: await countRecords(), outbox: await prisma.outboxEvent.count({ where: { aggregateType } }), notifications: await prisma.notification.count(), transfers: await prisma.transfer.count(), ledger: await prisma.ledgerEntry.count() });
  const reset = async () => { await prisma.outboxEvent.deleteMany({ where: { aggregateType } }); await cleanRecords(); };
  const one = (before: Awaited<ReturnType<typeof effects>>, after: Awaited<ReturnType<typeof effects>>) => { assert.equal(after.records - before.records, 1); assert.equal(after.outbox - before.outbox, 1); assert.equal(after.notifications - before.notifications, 0); assert.equal(after.transfers - before.transfers, 0); assert.equal(after.ledger - before.ledger, 0); };
  test(`${name} 1: identical request replays`, async () => { await reset(); const before = await effects(); const dto = make(`${prefix}-1`); const a = await invoke(USER_A, dto); const b = await invoke(USER_A, dto); assert.equal(a.id, b.id); one(before, await effects()); });
  test(`${name} 2: different payload conflicts`, async () => { await reset(); const before = await effects(); const dto = make(`${prefix}-2`); await invoke(USER_A, dto); await assert.rejects(invoke(USER_A, different(dto)), ConflictException); one(before, await effects()); });
  test(`${name} 3: cross-user key reuse conflicts`, async () => { await reset(); const before = await effects(); const dto = make(`${prefix}-3`); await invoke(USER_A, dto); await assert.rejects(invoke(USER_B, dto), ConflictException); one(before, await effects()); });
  test(`${name} 4: concurrent identical requests converge`, async () => { await reset(); const before = await effects(); const dto = make(`${prefix}-4`); const [a, b] = await Promise.all([invoke(USER_A, dto), invoke(USER_A, dto)]); assert.equal(a.id, b.id); one(before, await effects()); });
  test(`${name} 5: concurrent different payloads accept one`, async () => { await reset(); const before = await effects(); const dto = make(`${prefix}-5`); const results = await Promise.allSettled([invoke(USER_A, dto), invoke(USER_A, different(dto))]); assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1); const rejected = results.find(({ status }) => status === 'rejected'); assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ConflictException); one(before, await effects()); });
  test(`${name} 6: completed operation retries without side effects`, async () => { await reset(); const dto = make(`${prefix}-6`); const a = await invoke(USER_A, dto); const beforeReplay = await effects(); const b = await invoke(USER_A, dto); assert.equal(a.id, b.id); assert.deepEqual(await effects(), beforeReplay); });
}

creationMatrix<CreateBillPaymentDto>('Bill Payment', 'bill', 'BILL_PAYMENT_ATTEMPT', () => prisma.billPaymentAttempt.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } }), () => prisma.billPaymentAttempt.count(), key => ({ category: 'ELECTRICITY', billerId: 'biller-a', customerRef: 'customer-a', amount: '500.00', currency: 'inr', idempotencyKey: key }), dto => ({ ...dto, customerRef: 'customer-b' }), (userId, dto) => service.createBillPayment(userId, dto));

const mandateStart = new Date(Date.now() + 86_400_000).toISOString();
const mandateEnd = new Date(Date.now() + 172_800_000).toISOString();
creationMatrix<CreateMandateDto>('AutoPay', 'mandate', 'MANDATE', () => prisma.mandate.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } }), () => prisma.mandate.count(), key => ({ merchant: 'Merchant A', amount: '100.00', maxAmount: '500.00', currency: 'inr', frequency: 'MONTHLY', startAt: mandateStart, endAt: mandateEnd, consent: true, idempotencyKey: key }), dto => ({ ...dto, merchant: 'Merchant B' }), (userId, dto) => service.createMandate(userId, dto));

const requestExpiry = new Date(Date.now() + 259_200_000).toISOString();
creationMatrix<CreateMoneyRequestDto>('Money Request Creation', 'request', 'MONEY_REQUEST', () => prisma.moneyRequest.deleteMany({ where: { requesterUserId: { in: [USER_A, USER_B] } } }), () => prisma.moneyRequest.count(), key => ({ payerUserId: USER_B, walletId: WALLET_A, currency: 'inr', amount: '125.00', note: 'Request A', expiresAt: requestExpiry, idempotencyKey: key }), dto => ({ ...dto, amount: '175.00' }), (userId, dto) => service.createMoneyRequest(userId, dto));

const splitDue = new Date(Date.now() + 259_200_000).toISOString();
creationMatrix<CreateBillSplitDto>('Split Creation', 'split', 'BILL_SPLIT', () => prisma.billSplit.deleteMany({ where: { creatorUserId: { in: [USER_A, USER_B] } } }), () => prisma.billSplit.count(), key => ({ walletId: WALLET_A, currency: 'inr', totalAmount: '200.00', type: 'EXACT', allocations: [{ participantUserId: USER_B, amount: '200.00' }], note: 'Split A', dueAt: splitDue, idempotencyKey: key }), dto => ({ ...dto, totalAmount: '250.00', allocations: [{ participantUserId: USER_B, amount: '250.00' }] }), (userId, dto) => service.createSplit(userId, dto));

const transferDto = (key: string) => ({ sourceWalletId: WALLET_A, destinationWalletId: WALLET_B, amount: '10.00', currency: 'inr', description: 'Matrix transfer', idempotencyKey: key });
async function resetTransfers() {
  await prisma.moneyRequest.updateMany({ data: { settlementTransferId: null } }); await prisma.splitAllocation.updateMany({ data: { settlementTransferId: null } });
  await prisma.ledgerEntry.deleteMany(); await prisma.outboxEvent.deleteMany({ where: { aggregateType: 'TRANSFER' } }); await prisma.transfer.deleteMany();
  await prisma.wallet.update({ where: { id: WALLET_A }, data: { balance: '10000.00', version: 0 } }); await prisma.wallet.update({ where: { id: WALLET_B }, data: { balance: '10000.00', version: 0 } });
}
async function transferState() { const [a, b] = await Promise.all([prisma.wallet.findUniqueOrThrow({ where: { id: WALLET_A } }), prisma.wallet.findUniqueOrThrow({ where: { id: WALLET_B } })]); return { transfers: await prisma.transfer.count(), ledger: await prisma.ledgerEntry.count(), outbox: await prisma.outboxEvent.count({ where: { aggregateType: 'TRANSFER' } }), notifications: await prisma.notification.count(), a: a.balance.toString(), b: b.balance.toString() }; }
function assertTransferState(state: Awaited<ReturnType<typeof transferState>>) { assert.equal(state.transfers, 1); assert.equal(state.ledger, 2); assert.equal(state.outbox, 1); assert.equal(state.notifications, 0); assert.equal(state.a, '9990'); assert.equal(state.b, '10010'); }
test('Wallet Transfer 1: identical request replays', async () => { await resetTransfers(); const dto = transferDto('transfer-1'); const a = await wallets.transferWallet(dto, USER_A); const b = await wallets.transferWallet(dto, USER_A); assert.equal(a.id, b.id); assertTransferState(await transferState()); });
test('Wallet Transfer 2: different payload conflicts', async () => { await resetTransfers(); const dto = transferDto('transfer-2'); await wallets.transferWallet(dto, USER_A); await assert.rejects(wallets.transferWallet({ ...dto, amount: '20.00' }, USER_A), ConflictException); assertTransferState(await transferState()); });
test('Wallet Transfer 3: cross-user key reuse is forbidden', async () => { await resetTransfers(); const dto = transferDto('transfer-3'); await wallets.transferWallet(dto, USER_A); await assert.rejects(wallets.transferWallet(dto, USER_B), ForbiddenException); assertTransferState(await transferState()); });
test('Wallet Transfer 4: concurrent identical requests converge', async () => { await resetTransfers(); const dto = transferDto('transfer-4'); const [a, b] = await Promise.all([wallets.transferWallet(dto, USER_A), wallets.transferWallet(dto, USER_A)]); assert.equal(a.id, b.id); assertTransferState(await transferState()); });
test('Wallet Transfer 5: concurrent different payloads accept one', async () => { await resetTransfers(); const dto = transferDto('transfer-5'); const results = await Promise.allSettled([wallets.transferWallet(dto, USER_A), wallets.transferWallet({ ...dto, amount: '20.00' }, USER_A)]); assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1); const rejected = results.find(({ status }) => status === 'rejected'); assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ConflictException); const state = await transferState(); assert.equal(state.transfers, 1); assert.equal(state.ledger, 2); assert.equal(state.outbox, 1); });
test('Wallet Transfer 6: completed retry adds no effects', async () => { await resetTransfers(); const dto = transferDto('transfer-6'); const a = await wallets.transferWallet(dto, USER_A); const before = await transferState(); const b = await wallets.transferWallet(dto, USER_A); assert.equal(a.id, b.id); assert.deepEqual(await transferState(), before); });

async function resetOffers() { await resetTransfers(); await prisma.outboxEvent.deleteMany({ where: { aggregateType: 'OFFER' } }); await prisma.offerClaim.deleteMany(); await prisma.offer.deleteMany(); }
async function offer(label: string) { return prisma.offer.create({ data: { id: `40000000-0000-4000-8000-${label.padStart(12, '0')}`, title: `Offer ${label}`, description: 'Matrix offer', merchant: 'Merchant', category: 'TEST', currency: 'INR', benefitDescription: 'Test benefit', status: 'ACTIVE', startsAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 86_400_000), usageLimit: null } }); }
async function offerState() { return { claims: await prisma.offerClaim.count(), outbox: await prisma.outboxEvent.count({ where: { aggregateType: 'OFFER' } }), notifications: await prisma.notification.count(), transfers: await prisma.transfer.count(), ledger: await prisma.ledgerEntry.count() }; }
test('Offer Claim 1: same user and offer replays', async () => { await resetOffers(); const item = await offer('1'); const a = await service.claimOffer(USER_A, item.id); const b = await service.claimOffer(USER_A, item.id); assert.equal(a.id, b.id); assert.deepEqual(await offerState(), { claims: 1, outbox: 1, notifications: 0, transfers: 0, ledger: 0 }); });
test('Offer Claim 2: a different offer is a distinct claim identity', async () => { await resetOffers(); const a = await offer('2'); const b = await offer('3'); await service.claimOffer(USER_A, a.id); await service.claimOffer(USER_A, b.id); assert.equal((await offerState()).claims, 2); });
test('Offer Claim 3: different users may claim the same unlimited offer', async () => { await resetOffers(); const item = await offer('4'); await service.claimOffer(USER_A, item.id); await service.claimOffer(USER_B, item.id); assert.equal((await offerState()).claims, 2); });
test('Offer Claim 4: concurrent identical claims converge', async () => { await resetOffers(); const item = await offer('5'); const [a, b] = await Promise.all([service.claimOffer(USER_A, item.id), service.claimOffer(USER_A, item.id)]); assert.equal(a.id, b.id); const state = await offerState(); assert.equal(state.claims, 1); assert.equal(state.outbox, 1); });
test('Offer Claim 5: concurrent different offers create distinct claims', async () => { await resetOffers(); const a = await offer('6'); const b = await offer('7'); const results = await Promise.all([service.claimOffer(USER_A, a.id), service.claimOffer(USER_A, b.id)]); assert.notEqual(results[0].id, results[1].id); assert.equal((await offerState()).claims, 2); });
test('Offer Claim 6: completed retry adds no effects', async () => { await resetOffers(); const item = await offer('8'); const a = await service.claimOffer(USER_A, item.id); const before = await offerState(); const b = await service.claimOffer(USER_A, item.id); assert.equal(a.id, b.id); assert.deepEqual(await offerState(), before); });

async function resetSettlementData() { await prisma.moneyRequest.updateMany({ data: { settlementTransferId: null } }); await prisma.splitAllocation.updateMany({ data: { settlementTransferId: null } }); await prisma.ledgerEntry.deleteMany(); await prisma.outboxEvent.deleteMany({ where: { aggregateType: { in: ['TRANSFER', 'MONEY_REQUEST', 'BILL_SPLIT'] } } }); await prisma.transfer.deleteMany(); await prisma.moneyRequest.deleteMany(); await prisma.billSplit.deleteMany(); await prisma.wallet.update({ where: { id: WALLET_A }, data: { balance: '10000.00', version: 0 } }); await prisma.wallet.update({ where: { id: WALLET_B }, data: { balance: '10000.00', version: 0 } }); }
async function prepareRequest(label: string) { await resetSettlementData(); return prisma.moneyRequest.create({ data: { id: `50000000-0000-4000-8000-${label.padStart(12, '0')}`, requesterUserId: USER_A, payerUserId: USER_B, walletId: WALLET_A, currency: 'INR', amount: '20.00', note: 'Settlement', expiresAt: new Date(Date.now() + 86_400_000), idempotencyKey: `prepared-request-${label}` } }); }
async function settlementState() { const [a, b] = await Promise.all([prisma.wallet.findUniqueOrThrow({ where: { id: WALLET_A } }), prisma.wallet.findUniqueOrThrow({ where: { id: WALLET_B } })]); return { transfers: await prisma.transfer.count(), ledger: await prisma.ledgerEntry.count(), transferOutbox: await prisma.outboxEvent.count({ where: { aggregateType: 'TRANSFER' } }), notifications: await prisma.notification.count(), a: a.balance.toString(), b: b.balance.toString() }; }
function assertSettlement(state: Awaited<ReturnType<typeof settlementState>>) { assert.equal(state.transfers, 1); assert.equal(state.ledger, 2); assert.equal(state.transferOutbox, 1); assert.equal(state.notifications, 0); assert.equal(state.a, '10020'); assert.equal(state.b, '9980'); }
test('Money Request Settlement 1: identical retry settles once', async () => { const item = await prepareRequest('1'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'settle-1' }; const a = await service.acceptMoneyRequest(USER_B, item.id, dto); const b = await service.acceptMoneyRequest(USER_B, item.id, dto); assert.equal(a.id, b.id); assertSettlement(await settlementState()); assert.equal(await prisma.outboxEvent.count({ where: { eventType: 'money.request.accepted' } }), 1); });
test('Money Request Settlement 2: incompatible source conflicts', async () => { const item = await prepareRequest('2'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'settle-2' }; await service.acceptMoneyRequest(USER_B, item.id, dto); await assert.rejects(service.acceptMoneyRequest(USER_B, item.id, { ...dto, sourceWalletId: WALLET_A }), ConflictException); assertSettlement(await settlementState()); });
test('Money Request Settlement 3: unrelated identity is rejected', async () => { const item = await prepareRequest('3'); await assert.rejects(service.acceptMoneyRequest(USER_A, item.id, { sourceWalletId: WALLET_A, idempotencyKey: 'settle-3' }), ForbiddenException); assert.equal((await settlementState()).transfers, 0); });
test('Money Request Settlement 4: concurrent identical requests settle once', async () => { const item = await prepareRequest('4'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'settle-4' }; await Promise.all([service.acceptMoneyRequest(USER_B, item.id, dto), service.acceptMoneyRequest(USER_B, item.id, dto)]); assertSettlement(await settlementState()); assert.equal(await prisma.outboxEvent.count({ where: { eventType: 'money.request.accepted' } }), 1); });
test('Money Request Settlement 5: concurrent incompatible source conflicts without duplicate settlement', async () => { const item = await prepareRequest('5'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'settle-5' }; const results = await Promise.allSettled([service.acceptMoneyRequest(USER_B, item.id, dto), service.acceptMoneyRequest(USER_B, item.id, { ...dto, sourceWalletId: WALLET_A })]); assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1); const rejected = results.find(({ status }) => status === 'rejected'); assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ConflictException); assertSettlement(await settlementState()); });
test('Money Request Settlement 6: completed retry adds no effects', async () => { const item = await prepareRequest('6'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'settle-6' }; await service.acceptMoneyRequest(USER_B, item.id, dto); const before = await settlementState(); await service.acceptMoneyRequest(USER_B, item.id, dto); assert.deepEqual(await settlementState(), before); });

async function prepareAllocation(label: string) { await resetSettlementData(); const split = await prisma.billSplit.create({ data: { id: `60000000-0000-4000-8000-${label.padStart(12, '0')}`, creatorUserId: USER_A, walletId: WALLET_A, currency: 'INR', totalAmount: '20.00', type: 'EXACT', note: 'Split settlement', dueAt: new Date(Date.now() + 86_400_000), idempotencyKey: `prepared-split-${label}`, allocations: { create: { id: `70000000-0000-4000-8000-${label.padStart(12, '0')}`, participantUserId: USER_B, amount: '20.00' } } }, include: { allocations: true } }); return split.allocations[0]; }
test('Split Settlement 1: identical retry settles once', async () => { const item = await prepareAllocation('1'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'split-settle-1' }; const a = await service.payAllocation(USER_B, item.id, dto); const b = await service.payAllocation(USER_B, item.id, dto); assert.equal(a.id, b.id); assertSettlement(await settlementState()); assert.equal(await prisma.outboxEvent.count({ where: { eventType: 'split.allocation.paid' } }), 1); });
test('Split Settlement 2: incompatible source conflicts', async () => { const item = await prepareAllocation('2'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'split-settle-2' }; await service.payAllocation(USER_B, item.id, dto); await assert.rejects(service.payAllocation(USER_B, item.id, { ...dto, sourceWalletId: WALLET_A }), ConflictException); assertSettlement(await settlementState()); });
test('Split Settlement 3: unrelated identity is rejected', async () => { const item = await prepareAllocation('3'); await assert.rejects(service.payAllocation(USER_A, item.id, { sourceWalletId: WALLET_A, idempotencyKey: 'split-settle-3' }), ForbiddenException); assert.equal((await settlementState()).transfers, 0); });
test('Split Settlement 4: concurrent identical requests settle once', async () => { const item = await prepareAllocation('4'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'split-settle-4' }; await Promise.all([service.payAllocation(USER_B, item.id, dto), service.payAllocation(USER_B, item.id, dto)]); assertSettlement(await settlementState()); assert.equal(await prisma.outboxEvent.count({ where: { eventType: 'split.allocation.paid' } }), 1); });
test('Split Settlement 5: concurrent incompatible source conflicts without duplicate settlement', async () => { const item = await prepareAllocation('5'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'split-settle-5' }; const results = await Promise.allSettled([service.payAllocation(USER_B, item.id, dto), service.payAllocation(USER_B, item.id, { ...dto, sourceWalletId: WALLET_A })]); assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1); const rejected = results.find(({ status }) => status === 'rejected'); assert.ok(rejected && rejected.status === 'rejected' && rejected.reason instanceof ConflictException); assertSettlement(await settlementState()); });
test('Split Settlement 6: completed retry adds no effects', async () => { const item = await prepareAllocation('6'); const dto = { sourceWalletId: WALLET_B, idempotencyKey: 'split-settle-6' }; await service.payAllocation(USER_B, item.id, dto); const before = await settlementState(); await service.payAllocation(USER_B, item.id, dto); assert.deepEqual(await settlementState(), before); });

test.after(async () => {
  await resetSettlementData(); await resetOffers(); await clean();
  await prisma.outboxEvent.deleteMany({ where: { aggregateType: { in: ['BILL_PAYMENT_ATTEMPT', 'MANDATE'] } } });
  await prisma.billPaymentAttempt.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await prisma.mandate.deleteMany({ where: { userId: { in: [USER_A, USER_B] } } });
  await prisma.$disconnect();
});
