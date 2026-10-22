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

const dashboardCardRelations = {
  assignees: {
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
  labels: { include: { label: true } },
  list: {
    select: {
      id: true,
      name: true,
      board: { select: { workspace: { select: { id: true, name: true } } } },
    },
  },
} as const;

export async function getPersonalDashboard(userId: string, requestedAt = new Date()) {
  const assignedCards = await prisma.card.findMany({
    where: {
      assignees: { some: { userId } },
      list: { board: { workspace: { archivedAt: null, memberships: { some: { userId } } } } },
    },
    include: dashboardCardRelations,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  const withContext = assignedCards.map(({ list, ...card }) => ({
    ...card,
    list: { id: list.id, name: list.name },
    workspace: list.board.workspace,
  }));

  return {
    assignedCards: withContext,
    upcomingDeadlines: withContext
      .filter((card) => card.dueDate !== null && card.dueDate >= requestedAt)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()),
  };
}
