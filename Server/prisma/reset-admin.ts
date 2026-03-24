import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const TARGET_USERNAME = 'admin';

function randomPassword(length = 28): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*()-_=+';
  const bytes = randomBytes(length * 2);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function main() {
  const password = randomPassword(30);
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { username: TARGET_USERNAME },
    create: {
      username: TARGET_USERNAME,
      passwordHash,
      role: UserRole.SUPERADMIN,
      country: 'US',
    },
    update: {
      passwordHash,
      role: UserRole.SUPERADMIN,
    },
    select: { id: true, username: true, role: true },
  });

  const cleanup = await prisma.user.deleteMany({
    where: {
      role: { in: [UserRole.ADMIN, UserRole.SUPERADMIN] },
      NOT: { id: admin.id },
    },
  });

  console.log('========================================');
  console.log('Admin account reset complete');
  console.log('username:', TARGET_USERNAME);
  console.log('password:', password);
  console.log('role:', admin.role);
  console.log('removed_other_admin_accounts:', cleanup.count);
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('reset-admin failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
