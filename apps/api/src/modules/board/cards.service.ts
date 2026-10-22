import type { Prisma } from '@prisma/client';
import { createCardBody, moveCardBody, patchCardBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { between, renumberPositions } from '../../lib/ordering.js';
import { emitToBoard } from '../../realtime/emit.js';
import { isIoInitialized } from '../../realtime/io.js';

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
  const result = await prisma.$transaction(async (tx) => {
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

    const card = await tx.card.create({
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
    return { card, workspaceId: list.board.workspaceId };
  });
  if (isIoInitialized()) emitToBoard(result.workspaceId, 'board:card_created', result.card);
  return result.card;
}

export async function getCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: cardRelations });
  if (!card) throw Errors.notFound('Card');
  return card;
}

export async function updateCard(cardId: string, input: unknown) {
  const data = patchCardBody.parse(input);
  const result = await prisma.$transaction(async (tx) => {
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

    const card = await tx.card.update({
      where: { id: cardId },
      data: {
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate === undefined ? undefined : data.dueDate === null ? null : new Date(data.dueDate),
      },
      include: cardRelations,
    });
    return { card, workspaceId: existing.list.board.workspaceId };
  });
  if (isIoInitialized()) emitToBoard(result.workspaceId, 'board:card_updated', result.card);
  return result.card;
}

export async function deleteCard(cardId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  const deleted = await prisma.$transaction(async (tx) => {
    const card = await tx.card.findUnique({
      where: { id: cardId },
      select: { createdById: true, listId: true, list: { select: { board: { select: { workspaceId: true } } } } },
    });
    if (!card) throw Errors.notFound('Card');
    if (role === 'MEMBER' && card.createdById !== userId) throw Errors.forbidden();
    await tx.card.delete({ where: { id: cardId } });
    return { listId: card.listId, workspaceId: card.list.board.workspaceId };
  });
  if (isIoInitialized()) emitToBoard(deleted.workspaceId, 'board:card_deleted', { cardId, listId: deleted.listId });
}

export async function moveCard(cardId: string, input: unknown) {
  const data = moveCardBody.parse(input);
  const initial = await prisma.card.findUnique({
    where: { id: cardId },
    select: { listId: true, list: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
  });
  if (!initial) throw Errors.notFound('Card');
  const target = await prisma.list.findUnique({
    where: { id: data.toListId },
    select: { boardId: true, board: { select: { workspaceId: true } } },
  });
  if (!target) throw Errors.validation({ field: 'toListId', message: 'Target list must be in the same workspace' });
  if (target.board.workspaceId !== initial.list.board.workspaceId) {
    throw Errors.validation({ field: 'toListId', message: 'Target list must be in the same workspace' });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Serialize every card move on this board, then reread state before selecting a position.
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Board" WHERE "id" = ${initial.list.boardId} FOR UPDATE`;
    const card = await tx.card.findUnique({
      where: { id: cardId },
      select: { id: true, listId: true, list: { select: { boardId: true } } },
    });
    const destination = await tx.list.findUnique({ where: { id: data.toListId }, select: { id: true, boardId: true } });
    if (!card) throw Errors.notFound('Card');
    if (!destination || destination.boardId !== card.list.boardId) {
      throw Errors.validation({ field: 'toListId', message: 'Target list must be in the same workspace' });
    }

    const siblings = await tx.card.findMany({
      where: { listId: destination.id, id: { not: cardId } },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    let insertionIndex = 0;
    if (data.afterCardId) {
      insertionIndex = siblings.findIndex(({ id }) => id === data.afterCardId) + 1;
      if (insertionIndex === 0) {
        throw Errors.validation({ field: 'afterCardId', message: 'Card must be in the target list' });
      }
    }
    const prev = siblings[insertionIndex - 1]?.position ?? null;
    const next = siblings[insertionIndex]?.position ?? null;
    let position = between(prev, next);
    let renumbered = false;
    if (position === null) {
      const orderedIds = [...siblings];
      orderedIds.splice(insertionIndex, 0, { id: cardId, position: 0 });
      const positions = renumberPositions(orderedIds.map(({ id }) => id));
      await Promise.all(positions.map(({ id, position: nextPosition }) =>
        tx.card.update({ where: { id }, data: { position: nextPosition } }),
      ));
      position = positions.find(({ id }) => id === cardId)!.position;
      renumbered = siblings.length > 0;
    }
    const moved = await tx.card.update({
      where: { id: cardId },
      data: { listId: destination.id, position },
      include: cardRelations,
    });
    return {
      card: moved,
      event: { cardId, fromListId: card.listId, toListId: destination.id, position, ...(renumbered ? { renumbered: true } : {}) },
      workspaceId: initial.list.board.workspaceId,
    };
  });
  if (isIoInitialized()) emitToBoard(result.workspaceId, 'board:card_moved', result.event);
  return result.card;
}
