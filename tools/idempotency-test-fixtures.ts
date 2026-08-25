import { PrismaService } from '../libs/database/src/lib/prisma/prisma.service';

const prisma = new PrismaService();
const users = [
  { id: '10000000-0000-4000-8000-000000000001', email: 'idempotency-user-a@example.test', vpa: 'idempotency-a@payflow', firstName: 'UserA', role: 'USER' as const },
  { id: '10000000-0000-4000-8000-000000000002', email: 'idempotency-user-b@example.test', vpa: 'idempotency-b@payflow', firstName: 'UserB', role: 'USER' as const },
  { id: '10000000-0000-4000-8000-000000000003', email: 'idempotency-admin@example.test', vpa: 'idempotency-admin@payflow', firstName: 'Admin', role: 'ADMIN' as const },
];

async function main() {
await prisma.$connect();
try {
  for (const user of users) {
    await prisma.user.upsert({ where: { id: user.id }, update: user, create: user });
  }
  for (const [index, user] of users.slice(0, 2).entries()) {
    const wallet = await prisma.wallet.upsert({
      where: { userId_currency: { userId: user.id, currency: 'INR' } },
      update: { balance: '10000.00', status: 'ACTIVE' },
      create: { id: `20000000-0000-4000-8000-00000000000${index + 1}`, userId: user.id, currency: 'INR', balance: '10000.00', status: 'ACTIVE' },
    });
    await prisma.ledgerAccount.upsert({ where: { walletId: wallet.id }, update: { status: 'ACTIVE' }, create: { id: `30000000-0000-4000-8000-00000000000${index + 1}`, walletId: wallet.id, code: `IDEMPOTENCY_WALLET_${index + 1}`, name: `Idempotency Wallet ${index + 1}`, type: 'CUSTOMER', currency: 'INR', status: 'ACTIVE' } });
  }
  const userCount = await prisma.user.count({ where: { id: { in: users.map(({ id }) => id) } } });
  const walletCount = await prisma.wallet.count({ where: { userId: { in: users.slice(0, 2).map(({ id }) => id) }, currency: 'INR' } });
  console.log(`FIXTURE_USERS=${userCount}`);
  console.log(`FIXTURE_INR_WALLETS=${walletCount}`);
  const baselines = {
    users: await prisma.user.count(), wallets: await prisma.wallet.count(), transfers: await prisma.transfer.count(),
    ledgerEntries: await prisma.ledgerEntry.count(), rechargeAttempts: await prisma.rechargeAttempt.count(),
    billAttempts: await prisma.billPaymentAttempt.count(), mandates: await prisma.mandate.count(),
    offerClaims: await prisma.offerClaim.count(), moneyRequests: await prisma.moneyRequest.count(),
    splits: await prisma.billSplit.count(), splitAllocations: await prisma.splitAllocation.count(),
    outboxEvents: await prisma.outboxEvent.count(), notifications: await prisma.notification.count(),
  };
  for (const [name, count] of Object.entries(baselines)) console.log(`BASELINE_${name}=${count}`);
  const outboxGroups = await prisma.outboxEvent.groupBy({ by: ['aggregateType', 'eventType'], _count: true });
  for (const row of outboxGroups) console.log(`BASELINE_OUTBOX_GROUP=${row.aggregateType}|${row.eventType}|${row._count}`);
} finally {
  await prisma.$disconnect();
}
}

void main();
