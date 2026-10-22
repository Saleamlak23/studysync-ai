import { emitToBoard } from '../../realtime/emit.js';
import { isIoInitialized } from '../../realtime/io.js';
import { prisma } from '../../db/prisma.js';

export async function emitBoardListChanged(workspaceId: string) {
  if (!isIoInitialized()) return;
  const board = await prisma.board.findUnique({
    where: { workspaceId },
    select: { id: true, lists: { orderBy: { position: 'asc' }, select: { id: true, name: true, position: true } } },
  });
  if (board) emitToBoard(workspaceId, 'board:list_changed', { lists: board.lists });
}
