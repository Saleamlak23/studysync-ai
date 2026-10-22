import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();

async function register(name: string) {
  const email = `profile-${crypto.randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'Password123!' });
  expect(response.status).toBe(201);
  return { id: response.body.user.id as string, token: response.body.accessToken as string };
}

async function dashboardWorkspace(userId: string, name: string, archivedAt: Date | null = null) {
  return prisma.workspace.create({
    data: {
      name,
      archivedAt,
      memberships: { create: { userId, role: 'OWNER' } },
      board: { create: {} },
      channels: { create: { name: 'general' } },
    },
    include: { board: true },
  });
}

async function dashboardCard(userId: string, listId: string, title: string, dueDate: Date | null, position: number) {
  return prisma.card.create({
    data: {
      listId, title, dueDate, position,
      assignees: { create: { userId } },
    },
  });
}

describe('profile API', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-PROF-01: updates profile, rejects invalid input, and requires authentication', async () => {
    const email = `profile-${crypto.randomUUID()}@example.test`;
    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Profile User', email, password: 'Password123!' });

    expect(registration.status).toBe(201);

    const missingAuth = await request(app).get('/api/v1/me');
    expect(missingAuth.status).toBe(401);

    const invalid = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${registration.body.accessToken as string}`)
      .send({ name: '' });
    expect(invalid.status).toBe(400);

    const updated = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${registration.body.accessToken as string}`)
      .send({ name: 'Updated Name', bio: 'A short profile' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: 'Updated Name', bio: 'A short profile', email });
    expect(updated.body.passwordHash).toBeUndefined();
  });

  it('TC-PROF-02: returns assigned cards across active workspaces and upcoming deadlines soonest first', async () => {
    const user = await register('Dashboard User');
    const other = await register('Other User');
    const [workspaceA, workspaceB, archivedWorkspace, removedWorkspace] = await Promise.all([
      dashboardWorkspace(user.id, 'Dashboard A'),
      dashboardWorkspace(user.id, 'Dashboard B'),
      dashboardWorkspace(user.id, 'Archived Dashboard', new Date()),
      dashboardWorkspace(user.id, 'Removed Membership Dashboard'),
    ]);
    const [listA, listB, archivedList, removedList] = await Promise.all([
      prisma.list.create({ data: { boardId: workspaceA.board!.id, name: 'Doing', position: 1024 } }),
      prisma.list.create({ data: { boardId: workspaceB.board!.id, name: 'Next', position: 1024 } }),
      prisma.list.create({ data: { boardId: archivedWorkspace.board!.id, name: 'Hidden', position: 1024 } }),
      prisma.list.create({ data: { boardId: removedWorkspace.board!.id, name: 'Removed', position: 1024 } }),
    ]);
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const later = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const overdue = new Date(Date.now() - 60 * 60 * 1000);
    const [soonCard, laterCard, overdueCard, undatedCard] = await Promise.all([
      dashboardCard(user.id, listA.id, 'Soon', soon, 1024),
      dashboardCard(user.id, listB.id, 'Later', later, 1024),
      dashboardCard(user.id, listA.id, 'Overdue', overdue, 2048),
      dashboardCard(user.id, listB.id, 'Undated', null, 2048),
    ]);
    const otherCard = await dashboardCard(other.id, listA.id, 'Not assigned to requester', later, 3072);
    const archivedCard = await dashboardCard(user.id, archivedList.id, 'Archived workspace card', later, 1024);
    const removedCard = await dashboardCard(user.id, removedList.id, 'Former member card', later, 1024);
    await prisma.membership.delete({ where: { userId_workspaceId: { userId: user.id, workspaceId: removedWorkspace.id } } });

    const noAuth = await request(app).get('/api/v1/me/dashboard');
    expect(noAuth.status).toBe(401);
    const response = await request(app).get('/api/v1/me/dashboard').set('Authorization', `Bearer ${user.token}`);
    expect(response.status).toBe(200);
    expect(response.body.assignedCards.map((card: { id: string }) => card.id)).toEqual(
      expect.arrayContaining([soonCard.id, laterCard.id, overdueCard.id, undatedCard.id]),
    );
    expect(response.body.assignedCards).toHaveLength(4);
    expect(response.body.assignedCards.map((card: { id: string }) => card.id)).not.toEqual(
      expect.arrayContaining([otherCard.id, archivedCard.id, removedCard.id]),
    );
    expect(response.body.assignedCards.find((card: { id: string }) => card.id === soonCard.id)).toMatchObject({
      title: 'Soon', list: { id: listA.id, name: 'Doing' }, workspace: { id: workspaceA.id, name: 'Dashboard A' },
    });
    expect(response.body.upcomingDeadlines.map((card: { id: string }) => card.id)).toEqual([soonCard.id, laterCard.id]);

    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const suspended = await request(app).get('/api/v1/me/dashboard').set('Authorization', `Bearer ${user.token}`);
    expect(suspended.status).toBe(403);
    expect(suspended.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});
