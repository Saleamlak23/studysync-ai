import { createMessageBody, listMessagesQuery } from '@studysync/shared';
import type { MessageNewPayload } from '@studysync/shared';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { emitToChannel } from '../../realtime/emit.js';
import { isIoInitialized } from '../../realtime/io.js';
import { createNotifications, publishNotifications } from '../notifications/notifications.service.js';

const messageRelations = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  file: {
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploader: { select: { id: true, name: true, avatarUrl: true } },
    },
  },
} as const;
type MessageRecord = Prisma.MessageGetPayload<{ include: typeof messageRelations }>;

type MessageQuery = z.infer<typeof listMessagesQuery>;

function serializeMessage(message: MessageRecord): MessageNewPayload {
  return {
    id: message.id,
    channelId: message.channelId,
    author: message.author,
    content: message.content,
    file: message.file ? {
      ...message.file,
      createdAt: message.file.createdAt.toISOString(),
    } : null,
    createdAt: message.createdAt.toISOString(),
  };
}

export async function listMessages(channelId: string, input: MessageQuery) {
  const query = listMessagesQuery.parse(input);
  const limit = query.limit ?? 50;
  const cursorId = query.before ?? query.after;
  const cursor = cursorId
    ? await prisma.message.findFirst({
      where: { id: cursorId, channelId, deletedAt: null },
      select: { id: true, createdAt: true },
    })
    : null;

  if (cursorId && !cursor) {
    throw Errors.validation({ field: query.before ? 'before' : 'after', message: 'Cursor must identify a message in this channel' });
  }

  const direction = query.after ? 'after' : 'before';
  const filter = cursor
    ? direction === 'after'
      ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] }
      : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
    : {};
  const forward = direction === 'after';
  const rows = await prisma.message.findMany({
    where: { channelId, deletedAt: null, ...filter },
    orderBy: forward
      ? [{ createdAt: 'asc' }, { id: 'asc' }]
      : [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: messageRelations,
  });

  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const page = forward ? selected : selected.reverse();
  const nextCursor = hasMore
    ? forward ? page.at(-1)?.id ?? null : page[0]?.id ?? null
    : null;
  return { messages: page.map(serializeMessage), nextCursor };
}

export async function createMessage(channelId: string, userId: string, input: unknown) {
  const data = createMessageBody.parse(input);
  const message = await prisma.$transaction(async (tx) => {
    const channel = await tx.channel.findUnique({
      where: { id: channelId },
      select: { workspaceId: true, workspace: { select: { archivedAt: true } } },
    });
    if (!channel || channel.workspace.archivedAt) throw Errors.notFound('Channel');

    const membership = await tx.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
      select: { id: true },
    });
    if (!membership) throw Errors.notFound('Channel');

    if (data.mentionIds?.length) {
      const mentionMemberships = await tx.membership.count({
        where: { workspaceId: channel.workspaceId, userId: { in: data.mentionIds } },
      });
      if (mentionMemberships !== data.mentionIds.length) {
        throw Errors.validation({ field: 'mentionIds', message: 'Mentioned users must belong to the workspace' });
      }
    }

    if (data.fileId) {
      const file = await tx.file.findUnique({ where: { id: data.fileId }, select: { workspaceId: true } });
      if (!file || file.workspaceId !== channel.workspaceId) {
        throw Errors.validation({ field: 'fileId', message: 'File must belong to the channel workspace' });
      }
    }

    const created = await tx.message.create({
      data: { channelId, authorId: userId, content: data.content, fileId: data.fileId },
      include: messageRelations,
    });
    const notifications = await createNotifications(tx, (data.mentionIds ?? []).map((userId) => ({
      userId,
      workspaceId: channel.workspaceId,
      type: 'MENTION' as const,
      payload: { channelId, messageId: created.id },
    })));
    return { message: serializeMessage(created), notifications };
  });

  if (isIoInitialized()) emitToChannel(channelId, 'message:new', message.message satisfies MessageNewPayload);
  publishNotifications(message.notifications);
  return message.message;
}
