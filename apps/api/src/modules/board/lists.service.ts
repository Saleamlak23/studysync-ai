import { createListBody, patchListBody, moveListBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { between, renumberPositions } from '../../lib/ordering.js';

export async function getListWorkspaceId(listId: string) {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    select: { board: { select: { workspaceId: true } } },
  });
  if (!list) throw Errors.notFound('List');
  return list.board.workspaceId;
}

export async function createList(workspaceId: string, input: unknown) {
  const { name } = createListBody.parse(input);
  return prisma.$transaction(async (tx) => {
    const board = await tx.board.findUnique({ where: { workspaceId }, select: { id: true } });
    if (!board) throw Errors.notFound('Board');
    const lastList = await tx.list.findFirst({
      where: { boardId: board.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return tx.list.create({
      data: { boardId: board.id, name, position: between(lastList?.position ?? null, null)! },
    });
  });
}

export async function renameList(listId: string, input: unknown) {
  const { name } = patchListBody.parse(input);
  const existing = await prisma.list.findUnique({ where: { id: listId }, select: { id: true } });
  if (!existing) throw Errors.notFound('List');
  return prisma.list.update({ where: { id: listId }, data: { name } });
}

export async function moveList(listId: string, input: unknown) {
  const { afterListId } = moveListBody.parse(input);
  return prisma.$transaction(async (tx) => {
    const list = await tx.list.findUnique({ where: { id: listId }, select: { id: true, boardId: true } });
    if (!list) throw Errors.notFound('List');

    const ordered = await tx.list.findMany({
      where: { boardId: list.boardId },
      orderBy: { position: 'asc' },
    });
    const remaining = ordered.filter((item) => item.id !== listId);
    let insertionIndex = 0;
    if (afterListId) {
      insertionIndex = remaining.findIndex((item) => item.id === afterListId) + 1;
      if (insertionIndex === 0) throw Errors.validation({ field: 'afterListId', message: 'List must be in the same board' });
    }

    const desired = [...remaining];
    desired.splice(insertionIndex, 0, ordered.find((item) => item.id === listId)!);
    const previousPosition = desired[insertionIndex - 1]?.position ?? null;
    const nextPosition = desired[insertionIndex + 1]?.position ?? null;
    const position = between(previousPosition, nextPosition);

    if (position === null) {
      const positions = renumberPositions(desired.map((item) => item.id));
      await Promise.all(positions.map(({ id, position: nextPositionValue }) =>
        tx.list.update({ where: { id }, data: { position: nextPositionValue } }),
      ));
      return tx.list.findUniqueOrThrow({ where: { id: listId } });
    }

    return tx.list.update({ where: { id: listId }, data: { position } });
  });
}

export async function deleteList(listId: string) {
  const existing = await prisma.list.findUnique({ where: { id: listId }, select: { id: true } });
  if (!existing) throw Errors.notFound('List');
  await prisma.list.delete({ where: { id: listId } });
}
