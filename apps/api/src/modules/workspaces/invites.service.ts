import { randomBytes } from 'node:crypto';
import { createInviteBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';

export async function createWorkspaceInvite(workspaceId: string, userId: string, input: unknown) {
  const { expiresAt } = createInviteBody.parse(input);
  const invite = await prisma.inviteLink.create({
    data: {
      workspaceId,
      createdById: userId,
      code: randomBytes(32).toString('base64url'),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true, code: true, expiresAt: true },
  });
  return invite;
}

export async function listWorkspaceInvites(workspaceId: string) {
  const now = new Date();
  return prisma.inviteLink.findMany({
    where: {
      workspaceId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true, code: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function revokeWorkspaceInvite(workspaceId: string, inviteId: string) {
  const result = await prisma.inviteLink.updateMany({
    where: { id: inviteId, workspaceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) throw Errors.notFound('Invite');
}

export async function joinWorkspaceByInvite(userId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.inviteLink.findUnique({
      where: { code },
      include: { workspace: true },
    });
    if (
      !invite ||
      invite.revokedAt ||
      (invite.expiresAt && invite.expiresAt <= new Date()) ||
      invite.workspace.archivedAt
    ) {
      throw Errors.notFound('Invite');
    }

    const membership = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: invite.workspaceId } },
    });
    if (membership) throw Errors.conflict('Already a member');

    await tx.membership.create({
      data: { userId, workspaceId: invite.workspaceId, role: 'MEMBER' },
    });
    return invite.workspace;
  });
}
