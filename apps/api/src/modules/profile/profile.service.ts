import { patchProfileBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, avatarUrl: true, bio: true, systemRole: true, status: true, createdAt: true, updatedAt: true } });
  if (!user) throw Errors.notFound('User');
  const memberships = await prisma.membership.findMany({ where: { userId, workspace: { archivedAt: null } }, include: { workspace: true } });
  return { user, workspaces: memberships.map(({ workspace, role, joinedAt }) => ({ ...workspace, role, joinedAt })) };
}
export async function updateProfile(userId: string, input: unknown) {
  const data = patchProfileBody.parse(input);
  return prisma.user.update({ where: { id: userId }, data, select: { id: true, name: true, email: true, avatarUrl: true, bio: true, systemRole: true, status: true, createdAt: true, updatedAt: true } });
}
