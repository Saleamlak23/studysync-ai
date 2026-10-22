import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { emitToUserMock, scheduleMock } = vi.hoisted(() => ({
  emitToUserMock: vi.fn(),
  scheduleMock: vi.fn(),
}));

vi.mock('../realtime/emit.js', () => ({ emitToUser: emitToUserMock }));
vi.mock('node-cron', () => ({ default: { schedule: scheduleMock } }));

import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';
import { purgeArchived } from './purgeArchived.js';
import { runReminders } from './reminders.js';
import { registerJobs } from './index.js';

const app = createApp();
const DAY_MS = 24 * 60 * 60 * 1000;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(name: string) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email: `${crypto.randomUUID()}@example.test`, password: 'Password123!' });
  expect(response.status).toBe(201);
  return { id: response.body.user.id as string, token: response.body.accessToken as string };
}

async function createWorkspace(token: string) {
  const response = await request(app)
    .post('/api/v1/workspaces')
    .set(auth(token))
    .send({ name: `Jobs ${crypto.randomUUID()}` });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

async function createCard(
  token: string,
  workspaceId: string,
  input: { title: string; dueDate: Date; assigneeIds?: string[] },
) {
  const board = await prisma.board.findUniqueOrThrow({ where: { workspaceId } });
  const list = await prisma.list.create({ data: { boardId: board.id, name: 'To do', position: 1024 } });
  const response = await request(app)
    .post(`/api/v1/lists/${list.id}/cards`)
    .set(auth(token))
    .send({
      title: input.title,
      dueDate: input.dueDate.toISOString(),
      ...(input.assigneeIds ? { assigneeIds: input.assigneeIds } : {}),
    });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

describe('scheduled jobs', () => {
  afterAll(async () => { await prisma.$disconnect(); });
  beforeEach(() => {
    emitToUserMock.mockReset();
    scheduleMock.mockReset();
  });

  it('TC-NOT-03: reminds each assignee once for due cards and skips later or unassigned cards', async () => {
    // Keep the fixture window isolated from rows left by earlier integration runs.
    const now = new Date('2099-10-22T10:00:00.000Z');
    const owner = await register('Reminder Owner');
    const assignee = await register('Reminder Assignee');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: assignee.id, workspaceId, role: 'MEMBER' } });

    const dueDate = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const assignedCardId = await createCard(owner.token, workspaceId, {
      title: 'Due tomorrow', dueDate, assigneeIds: [owner.id, assignee.id],
    });
    const unassignedCardId = await createCard(owner.token, workspaceId, {
      title: 'No assignee', dueDate,
    });
    const laterCardId = await createCard(owner.token, workspaceId, {
      title: 'Due in three days', dueDate: new Date(now.getTime() + 3 * DAY_MS), assigneeIds: [owner.id],
    });

    const emittedReads: Promise<unknown>[] = [];
    emitToUserMock.mockImplementation((_userId: string, _event: string, notification: { id: string }) => {
      emittedReads.push(prisma.notification.findUnique({ where: { id: notification.id } }));
    });

    await runReminders(now);
    await runReminders(now);

    expect(await prisma.reminder.count({ where: { cardId: assignedCardId } })).toBe(2);
    expect(await prisma.notification.count({ where: { payload: { path: ['cardId'], equals: assignedCardId } } })).toBe(2);
    expect(await prisma.reminder.count({ where: { cardId: unassignedCardId } })).toBe(0);
    expect(await prisma.reminder.count({ where: { cardId: laterCardId } })).toBe(0);
    expect(emitToUserMock).toHaveBeenCalledTimes(2);
    expect(await Promise.all(emittedReads)).toHaveLength(2);
    expect((await Promise.all(emittedReads)).every(Boolean)).toBe(true);
  });

  it('TC-NOT-03: rolls back a reminder and does not emit when its notification cannot be created', async () => {
    const now = new Date('2026-10-22T10:00:00.000Z');
    const owner = await register('Rollback Reminder Owner');
    const workspaceId = await createWorkspace(owner.token);
    const cardId = await createCard(owner.token, workspaceId, {
      title: 'Due tomorrow',
      dueDate: new Date(now.getTime() + 23 * 60 * 60 * 1000),
      assigneeIds: [owner.id],
    });
    const card = await prisma.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { assignees: true, list: { include: { board: true } } },
    });
    const invalidWorkspaceCard = {
      ...card,
      list: { ...card.list, board: { ...card.list.board, workspaceId: crypto.randomUUID() } },
    };
    const findCards = vi.spyOn(prisma.card, 'findMany').mockResolvedValue([invalidWorkspaceCard] as never);

    try {
      await expect(runReminders(now)).rejects.toThrow();
    } finally {
      findCards.mockRestore();
    }

    expect(await prisma.reminder.count({ where: { cardId } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: owner.id } })).toBe(0);
    expect(emitToUserMock).not.toHaveBeenCalled();
  });

  it('TC-WS-05: purges workspaces archived before the recovery cutoff and cascades their children', async () => {
    const now = new Date('2026-10-22T10:00:00.000Z');
    const owner = await register('Purge Workspace Owner');
    const expiredId = await createWorkspace(owner.token);
    const boundaryId = await createWorkspace(owner.token);
    const recentId = await createWorkspace(owner.token);
    const activeId = await createWorkspace(owner.token);
    const cutoff = new Date(now.getTime() - 30 * DAY_MS);

    await prisma.workspace.updateMany({ where: { id: expiredId }, data: { archivedAt: new Date(cutoff.getTime() - 1) } });
    await prisma.workspace.updateMany({ where: { id: boundaryId }, data: { archivedAt: cutoff } });
    await prisma.workspace.updateMany({ where: { id: recentId }, data: { archivedAt: new Date(cutoff.getTime() + 1) } });
    await prisma.notification.create({
      data: { userId: owner.id, workspaceId: expiredId, type: 'DEADLINE', payload: { cardId: crypto.randomUUID() } },
    });

    await purgeArchived(now);

    expect(await prisma.workspace.findUnique({ where: { id: expiredId } })).toBeNull();
    expect(await prisma.membership.count({ where: { workspaceId: expiredId } })).toBe(0);
    expect(await prisma.board.count({ where: { workspaceId: expiredId } })).toBe(0);
    expect(await prisma.channel.count({ where: { workspaceId: expiredId } })).toBe(0);
    expect(await prisma.notification.count({ where: { workspaceId: expiredId } })).toBe(0);
    expect(await prisma.workspace.findUnique({ where: { id: boundaryId } })).not.toBeNull();
    expect(await prisma.workspace.findUnique({ where: { id: recentId } })).not.toBeNull();
    expect(await prisma.workspace.findUnique({ where: { id: activeId } })).not.toBeNull();
  });

  it('registers reminders every 15 minutes and purge daily at 03:00', () => {
    registerJobs();

    expect(scheduleMock.mock.calls.map(([expression]) => expression)).toEqual([
      '*/15 * * * *',
      '0 3 * * *',
    ]);
    expect(scheduleMock.mock.calls.every(([, callback]) => typeof callback === 'function')).toBe(true);
  });
});
