import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@payflow/database';

async function createAdmin(): Promise<void> {
  const prisma = new PrismaService();

  try {
    await prisma.$connect();

    const email =
      process.env.ADMIN_EMAIL?.trim();

    const plainPassword =
      process.env.ADMIN_PASSWORD;

    if (!email) {
      throw new Error(
        'ADMIN_EMAIL environment variable is required',
      );
    }

    if (!plainPassword) {
      throw new Error(
        'ADMIN_PASSWORD environment variable is required',
      );
    }

    const passwordHash =
      await bcrypt.hash(
        plainPassword,
        12,
      );

    const admin =
      await prisma.user.upsert({
        where: {
          email,
        },

        update: {
          firstName: 'Payflow',
          lastName: 'Admin',
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },

        create: {
          email,
          firstName: 'Payflow',
          lastName: 'Admin',
          passwordHash,
          role: 'ADMIN',
          status: 'ACTIVE',
        },

        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      });

    console.log(
      'Admin account created or updated successfully',
    );

    console.log(admin);
  } catch (error) {
    console.error(
      'Unable to create admin account',
      error,
    );

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void createAdmin();
