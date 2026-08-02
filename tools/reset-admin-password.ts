import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../libs/database/src';

async function main(): Promise<void> {
  const prisma = new PrismaService();

  try {
    await prisma.$connect();

    const email = 'admin@payflow.com';
    const newPassword = 'Admin@123';
    const passwordHash = await bcrypt.hash(
      newPassword,
      12,
    );

    const admin = await prisma.user.update({
      where: {
        email,
      },
      data: {
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    });

    console.log('Admin password reset successfully');
    console.log(admin);
    console.log(`Password: ${newPassword}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
