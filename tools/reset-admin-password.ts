import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import {
  PrismaService,
} from '@payflow/database';

async function main(): Promise<void> {
  const prisma =
    new PrismaService();

  try {
    await prisma.$connect();

    const email =
      process.env.ADMIN_EMAIL?.trim();

    const newPassword =
      process.env.ADMIN_PASSWORD;

    if (!email) {
      throw new Error(
        'ADMIN_EMAIL environment variable is required',
      );
    }

    if (!newPassword) {
      throw new Error(
        'ADMIN_PASSWORD environment variable is required',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    const admin =
      await prisma.user.update({
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

    console.log(
      'Admin password reset successfully',
    );

    console.log(admin);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
