import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';

const cardRelations = {
  assignees: {
    select: {
      userId: true,
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  },
  labels: { include: { label: true } },
};

export async function getBoard(workspaceId: string) {
  const board = await prisma.board.findUnique({
    where: { workspaceId },
    include: {
      lists: {
        orderBy: { position: 'asc' },
        include: {
          cards: { orderBy: { position: 'asc' }, include: cardRelations },
        },
      },
    },
  });
  if (!board) throw Errors.notFound('Board');

  const { lists, ...boardDetails } = board;
  return { board: boardDetails, lists };
}
