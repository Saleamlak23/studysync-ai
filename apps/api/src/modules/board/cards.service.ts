import type { Prisma } from '@prisma/client';
import { createCardBody, patchCardBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { between } from '../../lib/ordering.js';

const cardRelations = {
  assignees: {
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
  labels: { include: { label: true } },
};

export async function getCardWorkspaceId(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { list: { select: { board: { select: { workspaceId: true } } } } },
  });
  if (!card) throw Errors.notFound('Card');
  return card.list.board.workspaceId;
}

async function validateRelations(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  assigneeIds?: string[],
  labelIds?: string[],
) {
  if (assigneeIds) {
    const memberships = await tx.membership.count({ where: { workspaceId, userId: { in: assigneeIds } } });
    if (memberships !== assigneeIds.length) {
      throw Errors.validation({ field: 'assigneeIds', message: 'Assignees must belong to the workspace' });
    }
  }
  if (labelIds) {
    const labels = await tx.label.count({ where: { workspaceId, id: { in: labelIds } } });
    if (labels !== labelIds.length) {
      throw Errors.validation({ field: 'labelIds', message: 'Labels must belong to the workspace' });
    }
  }
}

export async function createCard(listId: string, userId: string, input: unknown) {
  const data = createCardBody.parse(input);
  return prisma.$transaction(async (tx) => {
    const list = await tx.list.findUnique({
      where: { id: listId },
      include: { board: { select: { workspaceId: true } } },
    });
    if (!list) throw Errors.notFound('List');

    const assigneeIds = data.assigneeIds ?? [];
    const labelIds = data.labelIds ?? [];
    await validateRelations(tx, list.board.workspaceId, assigneeIds, labelIds);

    const lastCard = await tx.card.findFirst({
      where: { listId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = between(lastCard?.position ?? null, null)!;

    return tx.card.create({
      data: {
        listId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate) : data.dueDate,
        position,
        createdById: userId,
        assignees: { create: assigneeIds.map((id) => ({ user: { connect: { id } } })) },
        labels: { create: labelIds.map((id) => ({ label: { connect: { id } } })) },
      },
      include: cardRelations,
    });
  });
}

export async function getCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: cardRelations });
  if (!card) throw Errors.notFound('Card');
  return card;
}

export async function updateCard(cardId: string, input: unknown) {
  const data = patchCardBody.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.card.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        list: { select: { board: { select: { workspaceId: true } } } },
        assignees: { select: { userId: true } },
      },
    });
    if (!existing) throw Errors.notFound('Card');

    await validateRelations(
      tx,
      existing.list.board.workspaceId,
      data.assigneeIds,
      data.labelIds,
    );

    if (data.assigneeIds) {
      const previousIds = new Set(existing.assignees.map(({ userId: id }) => id));
      const newlyAssignedIds = data.assigneeIds.filter((id) => !previousIds.has(id));
      // TODO(S09): create assignment notifications for newly added assignees.
      void newlyAssignedIds;
      await tx.cardAssignee.deleteMany({ where: { cardId } });
      if (data.assigneeIds.length > 0) {
        await tx.cardAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({ cardId, userId })),
        });
      }
    }
    if (data.labelIds) {
      await tx.cardLabel.deleteMany({ where: { cardId } });
      if (data.labelIds.length > 0) {
        await tx.cardLabel.createMany({ data: data.labelIds.map((labelId) => ({ cardId, labelId })) });
      }
    }

    return tx.card.update({
      where: { id: cardId },
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate === undefined ? undefined : data.dueDate === null ? null : new Date(data.dueDate),
      },
      include: cardRelations,
    });
  });
}

export async function deleteCard(cardId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  await prisma.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId }, select: { createdById: true } });
    if (!card) throw Errors.notFound('Card');
    if (role === 'MEMBER' && card.createdById !== userId) throw Errors.forbidden();
    await tx.card.delete({ where: { id: cardId } });
  });
}
