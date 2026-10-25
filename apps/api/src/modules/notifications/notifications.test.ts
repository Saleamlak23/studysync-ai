import request from 'supertest';
import { createServer } from 'node:http';
import { io as connectSocket } from 'socket.io-client';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { initIo } from '../../realtime/io.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(name: string) {
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${crypto.randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'Password123!' });
  expect(response.status).toBe(201);
  return { id: response.body.user.id as string, token: response.body.accessToken as string };
}

async function createWorkspace(token: string) {
  const response = await request(app).post('/api/v1/workspaces').set(auth(token)).send({ name: `Notifications ${crypto.randomUUID()}` });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

function waitForConnect(socket: ReturnType<typeof connectSocket>) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 1000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', (error: Error) => { clearTimeout(timer); reject(error); });
  });
}

function waitForNotifications(socket: ReturnType<typeof connectSocket>, count: number) {
  return new Promise<Array<{ id: string; type: string; workspaceId: string; payload: Record<string, unknown> }>>((resolve, reject) => {
    const notifications: Array<{ id: string; type: string; workspaceId: string; payload: Record<string, unknown> }> = [];
    const timer = setTimeout(() => {
      socket.off('notification:new', onNotification);
      reject(new Error('Timed out waiting for notification events'));
    }, 1500);
    const onNotification = (notification: typeof notifications[number]) => {
      notifications.push(notification);
      if (notifications.length === count) {
        clearTimeout(timer);
        socket.off('notification:new', onNotification);
        resolve(notifications);
      }
    };
    socket.on('notification:new', onNotification);
  });
}

describe('notifications API', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-NOT-01: creates assignment and mention notifications, lists them, and delivers them live', async () => {
    const owner = await register('Notification Owner');
    const recipient = await register('Notification Recipient');
    const outsider = await register('Notification Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: recipient.id, workspaceId, role: 'MEMBER' } });
    const board = await prisma.board.findUniqueOrThrow({ where: { workspaceId } });
    const list = await prisma.list.create({ data: { boardId: board.id, name: 'To do', position: 1024 } });
    const cardResponse = await request(app).post(`/api/v1/lists/${list.id}/cards`).set(auth(owner.token)).send({ title: 'Review the plan' });
    expect(cardResponse.status).toBe(201);
    const cardId = cardResponse.body.id as string;
    const channel = await prisma.channel.findFirstOrThrow({ where: { workspaceId } });

    const httpServer = createServer(app);
    const ioServer = initIo(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
    const url = `http://127.0.0.1:${address.port}`;
    const recipientSocket = connectSocket(url, { auth: { token: recipient.token }, transports: ['websocket'] });
    const outsiderSocket = connectSocket(url, { auth: { token: outsider.token }, transports: ['websocket'] });
    const received = waitForNotifications(recipientSocket, 3);
    const outsiderEvents: unknown[] = [];
    outsiderSocket.on('notification:new', (notification: unknown) => outsiderEvents.push(notification));
    try {
      await Promise.all([waitForConnect(recipientSocket), waitForConnect(outsiderSocket)]);

      const assigned = await request(app).patch(`/api/v1/cards/${cardId}`).set(auth(owner.token)).send({ assigneeIds: [recipient.id] });
      expect(assigned.status).toBe(200);
      const comment = await request(app).post(`/api/v1/cards/${cardId}/comments`).set(auth(owner.token)).send({ body: 'Please review this', mentionIds: [recipient.id] });
      expect(comment.status).toBe(201);
      const message = await request(app).post(`/api/v1/channels/${channel.id}/messages`).set(auth(owner.token)).send({ content: 'Please review this too', mentionIds: [recipient.id] });
      expect(message.status).toBe(201);

      const events = await received;
      expect(events.map(({ type }) => type).sort()).toEqual(['ASSIGNED', 'MENTION', 'MENTION']);
      expect(events.every(({ workspaceId: eventWorkspaceId }) => eventWorkspaceId === workspaceId)).toBe(true);
      expect(events.find(({ type }) => type === 'ASSIGNED')?.payload).toEqual({ cardId });
      expect(events.find(({ payload }) => payload.messageId === message.body.id)?.type).toBe('MENTION');
      expect(await prisma.notification.count({ where: { userId: recipient.id, workspaceId } })).toBe(3);
      expect((await request(app).patch(`/api/v1/cards/${cardId}`).set(auth(owner.token)).send({ assigneeIds: [recipient.id] })).status).toBe(200);
      expect(await prisma.notification.count({ where: { userId: recipient.id, workspaceId } })).toBe(3);

      const noAuth = await request(app).get('/api/v1/notifications');
      expect(noAuth.status).toBe(401);
      const firstPage = await request(app).get('/api/v1/notifications?limit=2&unread=true').set(auth(recipient.token));
      expect(firstPage.status).toBe(200);
      expect(firstPage.body.notifications).toHaveLength(2);
      expect(firstPage.body.nextCursor).toBeTruthy();
      expect(firstPage.body.unreadCount).toBe(3);
      const secondPage = await request(app).get(`/api/v1/notifications?limit=2&cursor=${firstPage.body.nextCursor as string}`).set(auth(recipient.token));
      expect(secondPage.status).toBe(200);
      expect(secondPage.body.notifications).toHaveLength(1);
      expect([...firstPage.body.notifications, ...secondPage.body.notifications].map((item: { id: string }) => item.id)).toHaveLength(3);
      expect(outsiderEvents).toEqual([]);

      const foreignRead = await request(app).post(`/api/v1/notifications/${events[0]!.id}/read`).set(auth(outsider.token));
      expect(foreignRead.status).toBe(404);
    } finally {
      recipientSocket.disconnect();
      outsiderSocket.disconnect();
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
  });

  it('TC-NOT-02: marks notifications read and keeps notification access scoped to the owner', async () => {
    const user = await register('Read Notification User');
    const otherUser = await register('Other Notification User');
    const workspaceId = await createWorkspace(user.token);
    const [first, second] = await Promise.all([1, 2].map((index) => prisma.notification.create({
      data: {
        userId: user.id,
        workspaceId,
        type: 'ASSIGNED',
        payload: { cardId: crypto.randomUUID(), index },
      },
    })));

    const noAuth = await request(app).get('/api/v1/notifications');
    expect(noAuth.status).toBe(401);
    expect((await request(app).post(`/api/v1/notifications/${first.id}/read`)).status).toBe(401);
    expect((await request(app).post('/api/v1/notifications/read-all')).status).toBe(401);
    const invalidQuery = await request(app).get('/api/v1/notifications?unread=sometimes').set(auth(user.token));
    expect(invalidQuery.status).toBe(400);
    expect((await request(app).get('/api/v1/notifications?limit=101').set(auth(user.token))).status).toBe(400);
    expect((await request(app).post('/api/v1/notifications/not-a-uuid/read').set(auth(user.token))).status).toBe(400);
    const otherUserList = await request(app).get('/api/v1/notifications').set(auth(otherUser.token));
    expect(otherUserList.status).toBe(200);
    expect(otherUserList.body.notifications).toEqual([]);
    expect(otherUserList.body.unreadCount).toBe(0);
    expect((await request(app).get(`/api/v1/notifications?cursor=${first.id}`).set(auth(otherUser.token))).status).toBe(400);

    const marked = await request(app).post(`/api/v1/notifications/${first.id}/read`).set(auth(user.token));
    expect(marked.status).toBe(200);
    expect(marked.body.readAt).toBeTruthy();
    const unread = await request(app).get('/api/v1/notifications?unread=true').set(auth(user.token));
    expect(unread.status).toBe(200);
    expect(unread.body.unreadCount).toBe(1);

    const foreignRead = await request(app).post(`/api/v1/notifications/${second.id}/read`).set(auth(otherUser.token));
    expect(foreignRead.status).toBe(404);
    const readAll = await request(app).post('/api/v1/notifications/read-all').set(auth(user.token));
    expect(readAll.status).toBe(204);
    const afterReadAll = await request(app).get('/api/v1/notifications').set(auth(user.token));
    expect(afterReadAll.body.unreadCount).toBe(0);
    expect(afterReadAll.body.notifications.every((notification: { readAt: string | null }) => notification.readAt !== null)).toBe(true);
  });
});
