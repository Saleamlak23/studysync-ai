import { prisma } from '../db/prisma.js';
import { hashPassword } from '../lib/password.js';
export async function createUser(overrides: { email?: string; status?: 'ACTIVE' | 'SUSPENDED' } = {}) {
  const email = overrides.email ?? `user-${crypto.randomUUID()}@example.test`;
  return prisma.user.create({ data: { name: 'Test User', email, passwordHash: await hashPassword('Password123!'), status: overrides.status } });
}
