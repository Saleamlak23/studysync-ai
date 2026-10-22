import { workspaceDashboardSchema } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';

/**
 * Returns workspace-level progress aggregates for the dashboard.
 *
 * Completion rule (confirmed in API spec § 12): a card is "completed" when it
 * sits in the last list of the board (highest position). All other cards are
 * "open". Overdue counts open cards whose dueDate is strictly before
 * requestedAt.
 *
 * Contributions counts each workspace member once per card in which they are
 * either the creator (createdById) or an assignee. A member who both created
 * and is assigned to the same card is counted once for that card.
 */
export async function getWorkspaceDashboard(
  workspaceId: string,
  requestedAt = new Date(),
) {
  // 1. Load the board with its lists in position order (asc = first → last).
  const board = await prisma.board.findUniqueOrThrow({
    where: { workspaceId },
    include: {
      lists: {
        orderBy: { position: 'asc' },
        include: {
          _count: { select: { cards: true } },
        },
      },
    },
  });

  const lists = board.lists;
  const lastListId = lists.length > 0 ? lists[lists.length - 1].id : null;

  // 2. Load every card in the workspace (via list → board → workspace path).
  const cards = await prisma.card.findMany({
    where: { list: { board: { workspaceId } } },
    select: {
      id: true,
      listId: true,
      dueDate: true,
      createdById: true,
      assignees: { select: { userId: true } },
    },
  });

  let overdue = 0;
  let completed = 0;
  let open = 0;

  // Accumulate contribution counts keyed by userId.
  const memberMap = new Map<string, number>();
  const tally = (uid: string | null) => {
    if (!uid) return;
    memberMap.set(uid, (memberMap.get(uid) ?? 0) + 1);
  };

  for (const card of cards) {
    const isDone = card.listId === lastListId;
    if (isDone) {
      completed++;
    } else {
      open++;
      // Overdue only applies to non-completed cards.
      if (card.dueDate !== null && card.dueDate < requestedAt) overdue++;
    }

    // Count creator + unique assignees per card (a member counted once per card).
    const seen = new Set<string>();
    if (card.createdById) seen.add(card.createdById);
    card.assignees.forEach((a) => seen.add(a.userId));
    seen.forEach((uid) => tally(uid));
  }

  // 3. Resolve display info for contributors found in the card scan.
  const contributorIds = [...memberMap.keys()];
  const users =
    contributorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: contributorIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];

  const contributions = users.map((u) => ({
    userId: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl,
    count: memberMap.get(u.id) ?? 0,
  }));

  const cardsPerList = lists.map((l) => ({
    listId: l.id,
    name: l.name,
    position: l.position,
    count: l._count.cards,
  }));

  return workspaceDashboardSchema.parse({
    cardsPerList,
    overdue,
    completed,
    open,
    contributions,
  });
}
