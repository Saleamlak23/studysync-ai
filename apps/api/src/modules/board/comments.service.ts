import { createCommentBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';

export async function getCommentWorkspaceId(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { card: { select: { list: { select: { board: { select: { workspaceId: true } } } } } } },
  });
  if (!comment) throw Errors.notFound('Comment');
  return comment.card.list.board.workspaceId;
}

export async function listCardComments(cardId: string) {
  return prisma.comment.findMany({
    where: { cardId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function createComment(cardId: string, authorId: string, workspaceId: string, input: unknown) {
  const data = createCommentBody.parse(input);
  const mentionIds = data.mentionIds ?? [];

  if (mentionIds.length > 0) {
    const memberCount = await prisma.membership.count({
      where: { workspaceId, userId: { in: mentionIds } },
    });
    if (memberCount !== mentionIds.length) {
      throw Errors.validation({ field: 'mentionIds', message: 'Mentioned users must belong to the workspace' });
    }
  }

  // TODO(S09): create mention notifications for these workspace members.
  return prisma.comment.create({
    data: { cardId, authorId, body: data.body },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function deleteComment(commentId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
  if (!comment) throw Errors.notFound('Comment');
  if (role === 'MEMBER' && comment.authorId !== userId) throw Errors.forbidden();
  await prisma.comment.delete({ where: { id: commentId } });
}
