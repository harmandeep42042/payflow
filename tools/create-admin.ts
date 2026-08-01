import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../libs/database/src';

async function createAdmin(): Promise<void> {
  const prisma = new PrismaService();

  try {
    await prisma.$connect();

    const email = 'admin@payflow.com';
    const plainPassword = 'Admin@123';

    const passwordHash = await bcrypt.hash(
      plainPassword,
      12,
    );

    const admin = await prisma.user.upsert({
      where: {
        email,
      },

      update: {
        firstName: 'Super',
        lastName: 'Admin',
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },

      create: {
        email,
        firstName: 'Super',
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

    console.log('Admin account is ready:');
    console.log(admin);

    console.log('\nDevelopment login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${plainPassword}`);
  } catch (error) {
    console.error('Unable to create admin:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void createAdmin();