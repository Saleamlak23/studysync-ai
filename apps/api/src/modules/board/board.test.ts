import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();

async function register(name: string) {
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${crypto.randomUUID()}@example.test`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password: 'Password123!' });
  expect(response.status).toBe(201);
  return { id: response.body.user.id as string, token: response.body.accessToken as string };
}

async function createWorkspace(token: string) {
  const response = await request(app)
    .post('/api/v1/workspaces')
    .set(auth(token))
    .send({ name: `Board ${crypto.randomUUID()}` });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('board lists and cards', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-TASK-01: lets Admins manage lists and Members read boards only', async () => {
    const owner = await register('Board Owner');
    const admin = await register('Board Admin');
    const member = await register('Board Member');
    const outsider = await register('Board Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: admin.id, workspaceId, role: 'ADMIN' } });
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });

    const noBoardAuth = await request(app).get(`/api/v1/workspaces/${workspaceId}/board`);
    expect(noBoardAuth.status).toBe(401);
    const outsiderBoard = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/board`)
      .set(auth(outsider.token));
    expect(outsiderBoard.status).toBe(404);
    const board = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/board`)
      .set(auth(member.token));
    expect(board.status).toBe(200);
    expect(board.body.board.workspaceId).toBe(workspaceId);
    expect(board.body.lists).toEqual([]);

    const unauthenticatedCreate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .send({ name: 'Backlog' });
    expect(unauthenticatedCreate.status).toBe(401);
    const memberCreate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(member.token))
      .send({ name: 'Backlog' });
    expect(memberCreate.status).toBe(403);
    const outsiderCreate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(outsider.token))
      .send({ name: 'Backlog' });
    expect(outsiderCreate.status).toBe(404);
    const invalidCreate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(admin.token))
      .send({ name: '  ' });
    expect(invalidCreate.status).toBe(400);

    const first = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(admin.token))
      .send({ name: 'Backlog' });
    const second = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(admin.token))
      .send({ name: 'Doing' });
    const third = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(admin.token))
      .send({ name: 'Done' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(201);
    expect([first.body.position, second.body.position, third.body.position]).toEqual([1024, 2048, 3072]);

    const noRenameAuth = await request(app).patch(`/api/v1/lists/${second.body.id as string}`).send({ name: 'In progress' });
    expect(noRenameAuth.status).toBe(401);
    const memberRename = await request(app)
      .patch(`/api/v1/lists/${second.body.id as string}`)
      .set(auth(member.token))
      .send({ name: 'In progress' });
    expect(memberRename.status).toBe(403);
    const invalidRename = await request(app)
      .patch(`/api/v1/lists/${second.body.id as string}`)
      .set(auth(admin.token))
      .send({ name: '' });
    expect(invalidRename.status).toBe(400);
    const renamed = await request(app)
      .patch(`/api/v1/lists/${second.body.id as string}`)
      .set(auth(admin.token))
      .send({ name: 'In progress' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('In progress');

    const move = await request(app)
      .post(`/api/v1/lists/${third.body.id as string}/move`)
      .set(auth(admin.token))
      .send({ afterListId: first.body.id });
    expect(move.status).toBe(200);
    const orderedAfterMove = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/board`)
      .set(auth(owner.token));
    expect(orderedAfterMove.body.lists.map((list: { id: string }) => list.id)).toEqual([
      first.body.id,
      third.body.id,
      second.body.id,
    ]);

    const moveToStart = await request(app)
      .post(`/api/v1/lists/${second.body.id as string}/move`)
      .set(auth(owner.token))
      .send({});
    expect(moveToStart.status).toBe(200);
    const orderedAtStart = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/board`)
      .set(auth(owner.token));
    expect(orderedAtStart.body.lists.map((list: { id: string }) => list.id)).toEqual([
      second.body.id,
      first.body.id,
      third.body.id,
    ]);
    const memberMove = await request(app)
      .post(`/api/v1/lists/${third.body.id as string}/move`)
      .set(auth(member.token))
      .send({});
    expect(memberMove.status).toBe(403);

    const otherWorkspaceId = await createWorkspace(owner.token);
    const foreignList = await request(app)
      .post(`/api/v1/workspaces/${otherWorkspaceId}/lists`)
      .set(auth(owner.token))
      .send({ name: 'Foreign' });
    const crossBoardMove = await request(app)
      .post(`/api/v1/lists/${third.body.id as string}/move`)
      .set(auth(admin.token))
      .send({ afterListId: foreignList.body.id });
    expect(crossBoardMove.status).toBe(400);

    const unauthenticatedDelete = await request(app).delete(`/api/v1/lists/${third.body.id as string}`);
    expect(unauthenticatedDelete.status).toBe(401);
    const outsiderDelete = await request(app)
      .delete(`/api/v1/lists/${third.body.id as string}`)
      .set(auth(outsider.token));
    expect(outsiderDelete.status).toBe(404);
    const memberDelete = await request(app)
      .delete(`/api/v1/lists/${third.body.id as string}`)
      .set(auth(member.token));
    expect(memberDelete.status).toBe(403);
    const deleted = await request(app)
      .delete(`/api/v1/lists/${third.body.id as string}`)
      .set(auth(admin.token));
    expect(deleted.status).toBe(204);
  });

  it('TC-TASK-02: creates and edits cards with workspace assignees and labels, then enforces delete permissions', async () => {
    const owner = await register('Card Owner');
    const author = await register('Card Author');
    const otherMember = await register('Card Other Member');
    const outsider = await register('Card Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: author.id, workspaceId, role: 'MEMBER' } });
    await prisma.membership.create({ data: { userId: otherMember.id, workspaceId, role: 'MEMBER' } });

    const list = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(owner.token))
      .send({ name: 'Tasks' });
    expect(list.status).toBe(201);
    const label = await prisma.label.create({
      data: { workspaceId, name: 'Research', color: 'lagoon' },
    });

    const unauthenticatedCreate = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .send({ title: 'Read the brief' });
    expect(unauthenticatedCreate.status).toBe(401);
    const outsiderCreate = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .set(auth(outsider.token))
      .send({ title: 'Read the brief' });
    expect(outsiderCreate.status).toBe(404);
    const invalidCreate = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .set(auth(author.token))
      .send({ title: '  ' });
    expect(invalidCreate.status).toBe(400);
    const nonMemberAssignee = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .set(auth(author.token))
      .send({ title: 'Read the brief', assigneeIds: [outsider.id] });
    expect(nonMemberAssignee.status).toBe(400);

    const dueDate = '2026-11-01T12:00:00.000Z';
    const created = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .set(auth(author.token))
      .send({
        title: 'Read the brief',
        description: 'Extract requirements',
        priority: 'HIGH',
        dueDate,
        assigneeIds: [author.id],
        labelIds: [label.id],
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Read the brief',
      description: 'Extract requirements',
      priority: 'HIGH',
      dueDate,
    });
    expect(created.body.assignees.map((item: { userId: string }) => item.userId)).toEqual([author.id]);
    expect(created.body.labels.map((item: { labelId: string }) => item.labelId)).toEqual([label.id]);

    const noGetAuth = await request(app).get(`/api/v1/cards/${created.body.id as string}`);
    expect(noGetAuth.status).toBe(401);
    const outsiderGet = await request(app)
      .get(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(outsider.token));
    expect(outsiderGet.status).toBe(404);
    const fetched = await request(app)
      .get(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(author.token));
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);

    const emptyPatch = await request(app)
      .patch(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(author.token))
      .send({});
    expect(emptyPatch.status).toBe(400);
    const unauthenticatedPatch = await request(app)
      .patch(`/api/v1/cards/${created.body.id as string}`)
      .send({ title: 'Review the brief' });
    expect(unauthenticatedPatch.status).toBe(401);
    const outsiderPatch = await request(app)
      .patch(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(outsider.token))
      .send({ title: 'Review the brief' });
    expect(outsiderPatch.status).toBe(404);
    const invalidPriority = await request(app)
      .patch(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(author.token))
      .send({ priority: 'URGENT' });
    expect(invalidPriority.status).toBe(400);
    const invalidAssignee = await request(app)
      .patch(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(author.token))
      .send({ assigneeIds: [outsider.id] });
    expect(invalidAssignee.status).toBe(400);
    const updated = await request(app)
      .patch(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(author.token))
      .send({ title: 'Review the brief', assigneeIds: [author.id, otherMember.id], labelIds: [] });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('Review the brief');
    expect(updated.body.assignees.map((item: { userId: string }) => item.userId).sort()).toEqual([author.id, otherMember.id].sort());
    expect(updated.body.labels).toEqual([]);

    const secondCard = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .set(auth(author.token))
      .send({ title: 'Delete by admin' });
    expect(secondCard.status).toBe(201);
    const unauthenticatedDelete = await request(app).delete(`/api/v1/cards/${secondCard.body.id as string}`);
    expect(unauthenticatedDelete.status).toBe(401);
    const outsiderDelete = await request(app)
      .delete(`/api/v1/cards/${secondCard.body.id as string}`)
      .set(auth(outsider.token));
    expect(outsiderDelete.status).toBe(404);
    const otherDelete = await request(app)
      .delete(`/api/v1/cards/${secondCard.body.id as string}`)
      .set(auth(otherMember.token));
    expect(otherDelete.status).toBe(403);
    const authorDelete = await request(app)
      .delete(`/api/v1/cards/${created.body.id as string}`)
      .set(auth(author.token));
    expect(authorDelete.status).toBe(204);
    const ownerDelete = await request(app)
      .delete(`/api/v1/cards/${secondCard.body.id as string}`)
      .set(auth(owner.token));
    expect(ownerDelete.status).toBe(204);
  });
});
