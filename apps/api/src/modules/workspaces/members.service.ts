import { updateMemberRoleBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';

export async function listWorkspaceMembers(workspaceId: string) {
  const memberships = await prisma.membership.findMany({
    where: { workspaceId },
    select: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      role: true,
      joinedAt: true,
    },
    orderBy: { joinedAt: 'asc' },
  });
  return memberships;
}

export async function updateMemberRole(workspaceId: string, userId: string, input: unknown) {
  const { role } = updateMemberRoleBody.parse(input);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) throw Errors.notFound('Member');
    if (membership.role === 'OWNER') throw Errors.forbidden();

    return tx.membership.update({
      where: { userId_workspaceId: { userId, workspaceId } },
      data: { role },
      select: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        role: true,
        joinedAt: true,
      },
    });
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  actorId: string,
  actorRole: 'OWNER' | 'ADMIN' | 'MEMBER',
  targetUserId: string,
) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
    if (!target) throw Errors.notFound('Member');
    if (target.role === 'OWNER') throw Errors.forbidden();
    if (actorRole === 'MEMBER' && actorId !== targetUserId) throw Errors.forbidden();

    await tx.membership.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });
  });
}
