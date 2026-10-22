import { prisma } from '../db/prisma.js';
import { hashPassword } from '../lib/password.js';
export async function createUser(overrides: { name?: string; email?: string; status?: 'ACTIVE' | 'SUSPENDED'; systemRole?: 'USER' | 'ADMIN' } = {}) {
  const email = overrides.email ?? `user-${crypto.randomUUID()}@example.test`;
  return prisma.user.create({
    data: {
      name: overrides.name ?? 'Test User',
      email,
      passwordHash: await hashPassword('Password123!'),
      status: overrides.status,
      systemRole: overrides.systemRole ?? 'USER',
    },
  });
}
