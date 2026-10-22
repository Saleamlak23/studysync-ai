import { Prisma, type UserStatus } from '@prisma/client';
import { type AdminUsersQuery } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { disconnectUser } from '../../realtime/emit.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  bio: true,
  systemRole: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers(query: AdminUsersQuery) {
  const where: Prisma.UserWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.q) {
    where.OR = [
      { name: { contains: query.q, mode: 'insensitive' } },
      { email: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  if (query.cursor) {
    const cursorUser = await prisma.user.findUnique({
      where: { id: query.cursor },
      select: { id: true, createdAt: true },
    });
    if (!cursorUser) {
      throw Errors.validation({ field: 'cursor', message: 'Cursor user not found' });
    }

    where.AND = [
      {
        OR: [
          { createdAt: { lt: cursorUser.createdAt } },
          { createdAt: cursorUser.createdAt, id: { lt: cursorUser.id } },
        ],
      },
    ];
  }

  return prisma.user.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
    select: userSelect,
  });
}

export async function updateUserStatus(userId: string, status: UserStatus) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.notFound('User');

  const updated = await prisma.$transaction(async (tx) => {
    if (status === 'SUSPENDED') {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return tx.user.update({
      where: { id: userId },
      data: { status },
      select: userSelect,
    });
  });

  if (status === 'SUSPENDED') {
    disconnectUser(userId);
  }

  return updated;
}
