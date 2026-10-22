import type { NotificationType, Prisma } from '@prisma/client';
import { listNotificationsQuery, type Notification } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';
import { emitToUser } from '../../realtime/emit.js';
import { isIoInitialized } from '../../realtime/io.js';

type NotificationInput = {
  userId: string;
  workspaceId: string;
  type: NotificationType;
  payload: Prisma.InputJsonObject;
};

type NotificationRecord = {
  id: string;
  type: NotificationType;
  workspaceId: string;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
};

function serializeNotification(notification: NotificationRecord): Notification {
  return {
    id: notification.id,
    type: notification.type,
    workspaceId: notification.workspaceId,
    payload: notification.payload as Record<string, unknown>,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function createNotifications(tx: Prisma.TransactionClient, inputs: NotificationInput[]) {
  const created = [];
  for (const input of inputs) {
    const notification = await tx.notification.create({ data: input });
    created.push({ userId: input.userId, notification: serializeNotification(notification) });
  }
  return created;
}

export function publishNotifications(notifications: Awaited<ReturnType<typeof createNotifications>>) {
  if (!isIoInitialized()) return;
  for (const { userId, notification } of notifications) {
    emitToUser(userId, 'notification:new', notification);
  }
}

export async function listNotifications(userId: string, input: unknown) {
  const query = listNotificationsQuery.parse(input);
  const cursor = query.cursor
    ? await prisma.notification.findFirst({
      where: { id: query.cursor, userId },
      select: { id: true, createdAt: true },
    })
    : null;
  if (query.cursor && !cursor) {
    throw Errors.validation({ field: 'cursor', message: 'Cursor must identify one of your notifications' });
  }

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(query.unread === undefined ? {} : { readAt: query.unread ? null : { not: null } }),
    ...(cursor ? {
      OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ],
    } : {}),
  };
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  const hasMore = rows.length > query.limit;
  const page = rows.slice(0, query.limit);
  return {
    notifications: page.map(serializeNotification),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    unreadCount,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.$transaction(async (tx) => {
    const existing = await tx.notification.findFirst({ where: { id: notificationId, userId } });
    if (!existing) throw Errors.notFound('Notification');
    if (existing.readAt === null) {
      await tx.notification.updateMany({
        where: { id: notificationId, userId, readAt: null },
        data: { readAt: new Date() },
      });
    }
    return tx.notification.findFirst({ where: { id: notificationId, userId } });
  });
  if (!notification) throw Errors.notFound('Notification');
  return serializeNotification(notification);
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
