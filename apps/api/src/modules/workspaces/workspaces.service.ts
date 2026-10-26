import {
  createWorkspaceBody,
  patchWorkspaceBody,
  setWorkspaceAiConsentBody,
} from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';

export async function createWorkspace(userId: string, input: unknown) {
  const data = createWorkspaceBody.parse(input);
  return prisma.$transaction(async (tx) => {
    const workspace = await tx.workspace.create({
      data: {
        name: data.name,
        description: data.description,
        memberships: { create: { userId, role: 'OWNER' } },
        board: { create: {} },
        channels: { create: { name: 'general' } },
      },
    });
    return workspace;
  });
}

export async function listWorkspaces(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId, workspace: { archivedAt: null } },
    include: {
      workspace: {
        include: {
          _count: { select: { memberships: true } },
          board: {
            select: {
              lists: { select: { position: true, _count: { select: { cards: true } } } },
            },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });
  return memberships.map(({ workspace, role }) => {
    const { board, _count, ...workspaceData } = workspace;
    const lists = board?.lists ?? [];
    const lastListPosition = lists.reduce((last, list) => Math.max(last, list.position), Number.NEGATIVE_INFINITY);
    const openCardCount = lists
      .filter((list) => list.position < lastListPosition)
      .reduce((total, list) => total + list._count.cards, 0);

    return {
      ...workspaceData,
      myRole: role,
      memberCount: _count.memberships,
      openCardCount,
    };
  });
}

export async function getWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: true },
  });
  if (!membership || membership.workspace.archivedAt) throw Errors.notFound('Workspace');
  return { ...membership.workspace, myRole: membership.role };
}

export async function updateWorkspace(workspaceId: string, input: unknown) {
  const data = patchWorkspaceBody.parse(input);
  return prisma.workspace.update({ where: { id: workspaceId }, data });
}

export async function archiveWorkspace(workspaceId: string) {
  return prisma.workspace.update({ where: { id: workspaceId }, data: { archivedAt: new Date() } });
}

export async function restoreWorkspace(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    include: { workspace: { select: { archivedAt: true } } },
  });
  if (!membership) throw Errors.notFound('Workspace');
  if (membership.role !== 'OWNER') throw Errors.forbidden();

  const { archivedAt } = membership.workspace;
  if (!archivedAt || archivedAt.getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) {
    throw Errors.notFound('Workspace');
  }

  return prisma.workspace.update({ where: { id: workspaceId }, data: { archivedAt: null } });
}

export async function setWorkspaceAiConsent(userId: string, workspaceId: string, input: unknown) {
  const { enabled } = setWorkspaceAiConsentBody.parse(input);
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      aiEnabled: enabled,
      ...(enabled ? { aiConsentById: userId, aiConsentAt: new Date() } : {}),
    },
    select: { aiEnabled: true, aiConsentAt: true },
  });
}
