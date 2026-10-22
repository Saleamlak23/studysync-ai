import { Prisma } from '@prisma/client';
import { NOTIFICATION_NEW_EVENT } from '@studysync/shared';
import { prisma } from '../db/prisma.js';
import { emitToUser } from '../realtime/emit.js';

const HOURS_24_MS = 24 * 60 * 60 * 1000;

export async function runReminders(now = new Date()): Promise<void> {
  const soon = new Date(now.getTime() + HOURS_24_MS);
  const cards = await prisma.card.findMany({
    where: {
      dueDate: { gt: now, lte: soon },
      assignees: { some: {} },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      assignees: { select: { userId: true } },
      list: { select: { board: { select: { workspaceId: true } } } },
    },
  });

  for (const card of cards) {
    // A null dueDate cannot match the query above, but keep the guard for type safety.
    const dueDate = card.dueDate;
    if (!dueDate) continue;

    for (const assignee of card.assignees) {
      try {
        const notification = await prisma.$transaction(async (tx) => {
          await tx.reminder.create({
            data: {
              cardId: card.id,
              userId: assignee.userId,
              type: 'DUE_24H',
              dueAt: dueDate,
            },
          });

          return tx.notification.create({
            data: {
              userId: assignee.userId,
              workspaceId: card.list.board.workspaceId,
              type: 'DEADLINE',
              payload: {
                cardId: card.id,
                title: card.title,
                dueDate: dueDate.toISOString(),
              },
            },
          });
        });

        // The event must not escape until both rows have committed.
        emitToUser(assignee.userId, NOTIFICATION_NEW_EVENT, notification);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
  }
}
