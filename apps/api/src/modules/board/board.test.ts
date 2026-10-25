import request from 'supertest';
import { createServer } from 'node:http';
// Reuse the already installed workspace Socket.io client for end-to-end protocol coverage.
import { io as connectSocket } from 'socket.io-client';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { initIo } from '../../realtime/io.js';

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

  it('TC-TASK-03: moves cards within and between lists with serialized unique positions', async () => {
    const owner = await register('Move Owner');
    const member = await register('Move Member');
    const outsider = await register('Move Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });
    const otherWorkspaceId = await createWorkspace(owner.token);
    const listA = await request(app).post(`/api/v1/workspaces/${workspaceId}/lists`).set(auth(owner.token)).send({ name: 'A' });
    const listB = await request(app).post(`/api/v1/workspaces/${workspaceId}/lists`).set(auth(owner.token)).send({ name: 'B' });
    const foreignList = await request(app).post(`/api/v1/workspaces/${otherWorkspaceId}/lists`).set(auth(owner.token)).send({ name: 'Foreign' });
    const create = async (listId: string, title: string) => request(app).post(`/api/v1/lists/${listId}/cards`).set(auth(member.token)).send({ title });
    const cards = await Promise.all(['One', 'Two', 'Three', 'Four'].map((title) => create(listA.body.id as string, title)));
    expect(cards.map((response) => response.status)).toEqual([201, 201, 201, 201]);
    const [one, two, three, four] = cards.map((response) => response.body as { id: string });

    const noAuth = await request(app).post(`/api/v1/cards/${one.id}/move`).send({ toListId: listB.body.id });
    expect(noAuth.status).toBe(401);
    const outsiderMove = await request(app).post(`/api/v1/cards/${one.id}/move`).set(auth(outsider.token)).send({ toListId: listB.body.id });
    expect(outsiderMove.status).toBe(404);
    const invalidTarget = await request(app).post(`/api/v1/cards/${one.id}/move`).set(auth(member.token)).send({ toListId: foreignList.body.id });
    expect(invalidTarget.status).toBe(400);
    const invalidNeighbor = await request(app).post(`/api/v1/cards/${one.id}/move`).set(auth(member.token)).send({ toListId: listB.body.id, afterCardId: two.id });
    expect(invalidNeighbor.status).toBe(400);
    const missingCard = await request(app).post(`/api/v1/cards/${crypto.randomUUID()}/move`).set(auth(member.token)).send({ toListId: listB.body.id });
    expect(missingCard.status).toBe(404);

    const movedToEnd = await request(app).post(`/api/v1/cards/${two.id}/move`).set(auth(member.token)).send({ toListId: listB.body.id });
    const movedToBeginning = await request(app).post(`/api/v1/cards/${three.id}/move`).set(auth(member.token)).send({ toListId: listB.body.id });
    expect(movedToEnd.status).toBe(200);
    expect(movedToBeginning.status).toBe(200);
    const movedWithinList = await request(app).post(`/api/v1/cards/${four.id}/move`).set(auth(member.token)).send({ toListId: listA.body.id });
    expect(movedWithinList.status).toBe(200);
    const concurrentlyMoved = await Promise.all([
      request(app).post(`/api/v1/cards/${one.id}/move`).set(auth(member.token)).send({ toListId: listB.body.id, afterCardId: three.id }),
      request(app).post(`/api/v1/cards/${four.id}/move`).set(auth(member.token)).send({ toListId: listB.body.id, afterCardId: three.id }),
    ]);
    expect(concurrentlyMoved.map((response) => response.status)).toEqual([200, 200]);
    const targetCards = await prisma.card.findMany({ where: { listId: listB.body.id as string }, orderBy: { position: 'asc' } });
    expect(new Set(targetCards.map(({ position }) => position)).size).toBe(targetCards.length);
    expect(targetCards.map(({ position }) => position)).toEqual([...targetCards.map(({ position }) => position)].sort((a, b) => a - b));

    const nearCards = [
      await create(listA.body.id as string, 'Near one'),
      await create(listA.body.id as string, 'Near two'),
      await create(listA.body.id as string, 'Near three'),
    ];
    const nearIds = nearCards.map((response) => response.body.id as string);
    await prisma.card.update({ where: { id: nearIds[0] }, data: { position: 10 } });
    await prisma.card.update({ where: { id: nearIds[1] }, data: { position: 10.0000001 } });
    const tinyGapMove = await request(app).post(`/api/v1/cards/${nearIds[2]}/move`).set(auth(member.token)).send({ toListId: listA.body.id, afterCardId: nearIds[0] });
    expect(tinyGapMove.status).toBe(200);
    const renumberedCards = await prisma.card.findMany({ where: { listId: listA.body.id as string }, orderBy: { position: 'asc' } });
    expect(new Set(renumberedCards.map(({ position }) => position)).size).toBe(renumberedCards.length);
    expect(renumberedCards.map(({ position }) => position)).toEqual([1024, 2048, 3072]);
  });

  it('TC-TASK-04: broadcasts committed board changes to members only', async () => {
    const owner = await register('Realtime Owner');
    const member = await register('Realtime Member');
    const outsider = await register('Realtime Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });
    const httpServer = createServer(app);
    const ioServer = initIo(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
    const url = `http://127.0.0.1:${address.port}`;
    const memberSocket = connectSocket(url, { auth: { token: member.token }, transports: ['websocket'] });
    const outsiderSocket = connectSocket(url, { auth: { token: outsider.token }, transports: ['websocket'] });
    const unauthorizedSocket = connectSocket(url, { auth: {}, transports: ['websocket'], reconnection: false });
    const waitForConnect = (socket: typeof memberSocket) => new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 1000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', (error: Error) => { clearTimeout(timer); reject(error); });
    });
    const waitForEvent = <T>(socket: typeof memberSocket, event: string) => new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 1000);
      socket.once(event, (payload: T) => { clearTimeout(timer); resolve(payload); });
    });
    try {
      await Promise.all([waitForConnect(memberSocket), waitForConnect(outsiderSocket)]);
      await expect(waitForConnect(unauthorizedSocket)).rejects.toBeTruthy();
      const joinMember = await new Promise<{ ok: boolean }>((resolve) => memberSocket.emit('workspace:join', { workspaceId }, resolve));
      const joinOutsider = await new Promise<{ ok: boolean }>((resolve) => outsiderSocket.emit('workspace:join', { workspaceId }, resolve));
      expect(joinMember.ok).toBe(true);
      expect(joinOutsider.ok).toBe(false);
      const outsiderEvents: string[] = [];
      for (const event of ['board:card_created', 'board:card_updated', 'board:card_moved', 'board:card_deleted', 'board:list_changed']) {
        outsiderSocket.on(event, () => outsiderEvents.push(event));
      }

      const listChanged = waitForEvent<{ lists: Array<{ id: string; name: string }> }>(memberSocket, 'board:list_changed');
      const list = await request(app).post(`/api/v1/workspaces/${workspaceId}/lists`).set(auth(owner.token)).send({ name: 'Realtime' });
      expect(list.status).toBe(201);
      expect((await listChanged).lists.map(({ id }) => id)).toContain(list.body.id);
      const updatedListChanged = waitForEvent<{ lists: Array<{ id: string; name: string }> }>(memberSocket, 'board:list_changed');
      const renamed = await request(app).patch(`/api/v1/lists/${list.body.id as string}`).set(auth(owner.token)).send({ name: 'Renamed' });
      expect(renamed.status).toBe(200);
      expect((await updatedListChanged).lists.find(({ id }) => id === list.body.id)?.name).toBe('Renamed');

      const cardCreatedEvent = waitForEvent<{ id: string; title: string }>(memberSocket, 'board:card_created');
      const created = await request(app).post(`/api/v1/lists/${list.body.id as string}/cards`).set(auth(member.token)).send({ title: 'Realtime card' });
      expect(created.status).toBe(201);
      expect((await cardCreatedEvent).id).toBe(created.body.id);
      const cardUpdatedEvent = waitForEvent<{ id: string; title: string }>(memberSocket, 'board:card_updated');
      const updated = await request(app).patch(`/api/v1/cards/${created.body.id as string}`).set(auth(member.token)).send({ title: 'Updated realtime card' });
      expect(updated.status).toBe(200);
      expect((await cardUpdatedEvent).title).toBe('Updated realtime card');
      const movedEvent = waitForEvent<{ cardId: string; fromListId: string; toListId: string; position: number }>(memberSocket, 'board:card_moved');
      const secondListChanged = waitForEvent(memberSocket, 'board:list_changed');
      const secondList = await request(app).post(`/api/v1/workspaces/${workspaceId}/lists`).set(auth(owner.token)).send({ name: 'Second' });
      await secondListChanged;
      const moved = await request(app).post(`/api/v1/cards/${created.body.id as string}/move`).set(auth(member.token)).send({ toListId: secondList.body.id });
      expect(moved.status).toBe(200);
      expect(await movedEvent).toMatchObject({ cardId: created.body.id, fromListId: list.body.id, toListId: secondList.body.id });
      const deletedEvent = waitForEvent<{ cardId: string; listId: string }>(memberSocket, 'board:card_deleted');
      const deleted = await request(app).delete(`/api/v1/cards/${created.body.id as string}`).set(auth(member.token));
      expect(deleted.status).toBe(204);
      expect(await deletedEvent).toEqual({ cardId: created.body.id, listId: secondList.body.id });
      const failedWriteEvent = waitForEvent(memberSocket, 'board:card_updated').then(() => true, () => false);
      const failedWrite = await request(app).patch(`/api/v1/cards/${created.body.id as string}`).set(auth(member.token)).send({ title: 'Must not emit' });
      expect(failedWrite.status).toBe(404);
      expect(await failedWriteEvent).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(outsiderEvents).toEqual([]);
    } finally {
      memberSocket.disconnect();
      outsiderSocket.disconnect();
      unauthorizedSocket.disconnect();
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
  });
});

describe('board comments and labels', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-TASK-05: creates and lists comments and labels, validates access, and limits comment deletion', async () => {
    const owner = await register('Comments Owner');
    const author = await register('Comments Author');
    const otherMember = await register('Comments Member');
    const outsider = await register('Comments Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.createMany({
      data: [
        { userId: author.id, workspaceId, role: 'MEMBER' },
        { userId: otherMember.id, workspaceId, role: 'MEMBER' },
      ],
    });
    const list = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/lists`)
      .set(auth(owner.token))
      .send({ name: 'Review' });
    const card = await request(app)
      .post(`/api/v1/lists/${list.body.id as string}/cards`)
      .set(auth(author.token))
      .send({ title: 'Review the draft' });
    expect(list.status).toBe(201);
    expect(card.status).toBe(201);

    const noCommentAuth = await request(app).get(`/api/v1/cards/${card.body.id as string}/comments`);
    expect(noCommentAuth.status).toBe(401);
    const outsiderComments = await request(app)
      .get(`/api/v1/cards/${card.body.id as string}/comments`)
      .set(auth(outsider.token));
    expect(outsiderComments.status).toBe(404);
    const invalidComment = await request(app)
      .post(`/api/v1/cards/${card.body.id as string}/comments`)
      .set(auth(author.token))
      .send({ body: '  ' });
    expect(invalidComment.status).toBe(400);
    const foreignMention = await request(app)
      .post(`/api/v1/cards/${card.body.id as string}/comments`)
      .set(auth(author.token))
      .send({ body: 'Please review', mentionIds: [outsider.id] });
    expect(foreignMention.status).toBe(400);

    const first = await request(app)
      .post(`/api/v1/cards/${card.body.id as string}/comments`)
      .set(auth(author.token))
      .send({ body: '  First note  ', mentionIds: [otherMember.id] });
    const second = await request(app)
      .post(`/api/v1/cards/${card.body.id as string}/comments`)
      .set(auth(otherMember.token))
      .send({ body: 'Second note' });
    expect(first.status).toBe(201);
    expect(first.body.body).toBe('First note');
    expect(first.body.author.id).toBe(author.id);
    expect(second.status).toBe(201);

    const comments = await request(app)
      .get(`/api/v1/cards/${card.body.id as string}/comments`)
      .set(auth(author.token));
    expect(comments.status).toBe(200);
    expect(comments.body.map((item: { id: string }) => item.id)).toEqual([first.body.id, second.body.id]);

    const otherMemberDelete = await request(app)
      .delete(`/api/v1/comments/${first.body.id as string}`)
      .set(auth(otherMember.token));
    expect(otherMemberDelete.status).toBe(403);
    const authorDelete = await request(app)
      .delete(`/api/v1/comments/${first.body.id as string}`)
      .set(auth(author.token));
    expect(authorDelete.status).toBe(204);
    const adminDelete = await request(app)
      .delete(`/api/v1/comments/${second.body.id as string}`)
      .set(auth(owner.token));
    expect(adminDelete.status).toBe(204);

    const noLabelAuth = await request(app).get(`/api/v1/workspaces/${workspaceId}/labels`);
    expect(noLabelAuth.status).toBe(401);
    const outsiderLabels = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/labels`)
      .set(auth(outsider.token));
    expect(outsiderLabels.status).toBe(404);
    const invalidLabel = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/labels`)
      .set(auth(author.token))
      .send({ name: '  ', color: 'green' });
    expect(invalidLabel.status).toBe(400);
    const createdLabel = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/labels`)
      .set(auth(author.token))
      .send({ name: '  Needs review  ', color: 'green' });
    expect(createdLabel.status).toBe(201);
    expect(createdLabel.body.name).toBe('Needs review');
    const duplicateLabel = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/labels`)
      .set(auth(owner.token))
      .send({ name: 'Needs review', color: 'red' });
    expect(duplicateLabel.status).toBe(409);
    const labels = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/labels`)
      .set(auth(otherMember.token));
    expect(labels.status).toBe(200);
    expect(labels.body.map((item: { id: string }) => item.id)).toContain(createdLabel.body.id);
  });
});
