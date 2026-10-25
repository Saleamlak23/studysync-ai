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
  const response = await request(app).post('/api/v1/workspaces').set(auth(token)).send({ name: `Chat ${crypto.randomUUID()}` });
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

function waitForEvent<T>(socket: ReturnType<typeof connectSocket>, event: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 1000);
    socket.once(event, (payload: T) => { clearTimeout(timer); resolve(payload); });
  });
}

function socketAck(socket: ReturnType<typeof connectSocket>, event: string, payload: unknown) {
  return new Promise<{ ok: boolean }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement`)), 1000);
    socket.emit(event, payload, (result: { ok: boolean }) => { clearTimeout(timer); resolve(result); });
  });
}

describe('chat API', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-CHAT-01: lists and manages channels with workspace membership and Admin permissions', async () => {
    const owner = await register('Channel Owner');
    const member = await register('Channel Member');
    const outsider = await register('Channel Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });

    const noAuth = await request(app).get(`/api/v1/workspaces/${workspaceId}/channels`);
    expect(noAuth.status).toBe(401);
    const outsiderList = await request(app).get(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(outsider.token));
    expect(outsiderList.status).toBe(404);
    const listed = await request(app).get(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(member.token));
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ name: 'general', workspaceId });

    const noCreateAuth = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).send({ name: 'Planning' });
    expect(noCreateAuth.status).toBe(401);
    const outsiderCreate = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(outsider.token)).send({ name: 'Planning' });
    expect(outsiderCreate.status).toBe(404);
    const memberCreate = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(member.token)).send({ name: 'Planning' });
    expect(memberCreate.status).toBe(403);
    const invalid = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(owner.token)).send({ name: '  ' });
    expect(invalid.status).toBe(400);

    const created = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(owner.token)).send({ name: ' Planning ' });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe('Planning');
    const duplicate = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(owner.token)).send({ name: 'Planning' });
    expect(duplicate.status).toBe(409);

    const noDeleteAuth = await request(app).delete(`/api/v1/channels/${created.body.id as string}`);
    expect(noDeleteAuth.status).toBe(401);
    const outsiderDelete = await request(app).delete(`/api/v1/channels/${created.body.id as string}`).set(auth(outsider.token));
    expect(outsiderDelete.status).toBe(404);
    const memberDelete = await request(app).delete(`/api/v1/channels/${created.body.id as string}`).set(auth(member.token));
    expect(memberDelete.status).toBe(403);
    const deleted = await request(app).delete(`/api/v1/channels/${created.body.id as string}`).set(auth(owner.token));
    expect(deleted.status).toBe(204);
    const missing = await request(app).delete(`/api/v1/channels/${created.body.id as string}`).set(auth(owner.token));
    expect(missing.status).toBe(404);
  });

  it('TC-CHAT-03: accepts workspace-member mentions and rejects mentions outside the workspace', async () => {
    const owner = await register('Mention Owner');
    const member = await register('Mention Member');
    const outsider = await register('Mention Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });
    const channel = await prisma.channel.create({ data: { workspaceId, name: 'Mentions' } });

    const valid = await request(app).post(`/api/v1/channels/${channel.id}/messages`).set(auth(member.token)).send({ content: 'Please review', mentionIds: [owner.id] });
    expect(valid.status).toBe(201);
    expect(valid.body.content).toBe('Please review');
    const foreignMention = await request(app).post(`/api/v1/channels/${channel.id}/messages`).set(auth(member.token)).send({ content: 'Please review', mentionIds: [outsider.id] });
    expect(foreignMention.status).toBe(400);
  });

  it('TC-CHAT-02: persists messages and broadcasts only to authorized channel members after commit', async () => {
    const owner = await register('Message Owner');
    const member = await register('Message Member');
    const mentionedMember = await register('Mentioned Member');
    const outsider = await register('Message Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.createMany({ data: [
      { userId: member.id, workspaceId, role: 'MEMBER' },
      { userId: mentionedMember.id, workspaceId, role: 'MEMBER' },
    ] });
    const channelResponse = await request(app).post(`/api/v1/workspaces/${workspaceId}/channels`).set(auth(owner.token)).send({ name: 'Live chat' });
    expect(channelResponse.status).toBe(201);
    const channelId = channelResponse.body.id as string;
    const ownFile = await prisma.file.create({
      data: { workspaceId, uploaderId: owner.id, name: 'notes.txt', mimeType: 'text/plain', sizeBytes: 10 },
    });
    const foreignWorkspaceId = await createWorkspace(owner.token);
    const foreignFile = await prisma.file.create({
      data: { workspaceId: foreignWorkspaceId, uploaderId: owner.id, name: 'foreign.txt', mimeType: 'text/plain', sizeBytes: 10 },
    });

    const httpServer = createServer(app);
    const ioServer = initIo(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
    const url = `http://127.0.0.1:${address.port}`;
    const memberSocket = connectSocket(url, { auth: { token: member.token }, transports: ['websocket'] });
    const outsiderSocket = connectSocket(url, { auth: { token: outsider.token }, transports: ['websocket'] });
    const unauthorizedSocket = connectSocket(url, { auth: {}, transports: ['websocket'], reconnection: false });
    try {
      await Promise.all([waitForConnect(memberSocket), waitForConnect(outsiderSocket)]);
      await expect(waitForConnect(unauthorizedSocket)).rejects.toBeTruthy();
      expect(await socketAck(memberSocket, 'channel:join', { channelId })).toEqual({ ok: true });
      expect(await socketAck(outsiderSocket, 'channel:join', { channelId })).toEqual({ ok: false });
      expect(await socketAck(outsiderSocket, 'channel:join', { channelId: 'invalid' })).toEqual({ ok: false });

      const memberEvents: Array<{ id: string; content: string }> = [];
      const outsiderEvents: Array<{ id: string }> = [];
      memberSocket.on('message:new', (message: { id: string; content: string }) => memberEvents.push(message));
      outsiderSocket.on('message:new', (message: { id: string }) => outsiderEvents.push(message));
      const eventReceived = waitForEvent<{ id: string; content: string; file: unknown }>(memberSocket, 'message:new');
      const sent = await request(app).post(`/api/v1/channels/${channelId}/messages`).set(auth(member.token)).send({
        content: '  Hello team  ', mentionIds: [mentionedMember.id],
      });
      expect(sent.status).toBe(201);
      expect(sent.body.content).toBe('Hello team');
      const event = await eventReceived;
      expect(event).toMatchObject({ id: sent.body.id, content: 'Hello team', file: null });
      expect(await prisma.message.findUnique({ where: { id: sent.body.id as string } })).not.toBeNull();

      const fileEventReceived = waitForEvent<{ file: { id: string; name: string } }>(memberSocket, 'message:new');
      const fileMessage = await request(app).post(`/api/v1/channels/${channelId}/messages`).set(auth(member.token)).send({ content: 'See notes', fileId: ownFile.id });
      expect(fileMessage.status).toBe(201);
      expect(fileMessage.body.file).toMatchObject({ id: ownFile.id, name: 'notes.txt', sizeBytes: 10 });
      expect(fileMessage.body.file.blob).toBeUndefined();
      expect((await fileEventReceived).file.id).toBe(ownFile.id);

      const noAuth = await request(app).post(`/api/v1/channels/${channelId}/messages`).send({ content: 'No token' });
      expect(noAuth.status).toBe(401);
      const outsiderPost = await request(app).post(`/api/v1/channels/${channelId}/messages`).set(auth(outsider.token)).send({ content: 'Outsider' });
      expect(outsiderPost.status).toBe(404);
      const empty = await request(app).post(`/api/v1/channels/${channelId}/messages`).set(auth(member.token)).send({ content: '  ' });
      expect(empty.status).toBe(400);
      const foreignFileWrite = await request(app).post(`/api/v1/channels/${channelId}/messages`).set(auth(member.token)).send({ content: 'Attachment', fileId: foreignFile.id });
      expect(foreignFileWrite.status).toBe(400);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(memberEvents).toHaveLength(2);
      expect(outsiderEvents).toEqual([]);
    } finally {
      memberSocket.disconnect();
      outsiderSocket.disconnect();
      unauthorizedSocket.disconnect();
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
  });

  it('TC-CHAT-05: pages message history and reconnect catch-up without gaps or duplicates', async () => {
    const owner = await register('History Owner');
    const workspaceId = await createWorkspace(owner.token);
    const channel = await prisma.channel.create({ data: { workspaceId, name: 'History' } });
    const base = Date.now() - 10_000;
    const messages = await Promise.all([0, 1, 2].map((offset) => prisma.message.create({
      data: { channelId: channel.id, authorId: owner.id, content: `Message ${offset + 1}`, createdAt: new Date(base + offset * 1000) },
    })));
    const otherChannel = await prisma.channel.create({ data: { workspaceId, name: 'Other history' } });
    const otherChannelMessage = await prisma.message.create({ data: { channelId: otherChannel.id, authorId: owner.id, content: 'Other channel' } });
    const token = owner.token;

    const noAuth = await request(app).get(`/api/v1/channels/${channel.id}/messages`);
    expect(noAuth.status).toBe(401);
    const outsider = await register('History Outsider');
    const noMembership = await request(app).get(`/api/v1/channels/${channel.id}/messages`).set(auth(outsider.token));
    expect(noMembership.status).toBe(404);
    const invalidBoth = await request(app).get(`/api/v1/channels/${channel.id}/messages?before=${messages[1]!.id}&after=${messages[0]!.id}`).set(auth(token));
    expect(invalidBoth.status).toBe(400);
    const invalidLimit = await request(app).get(`/api/v1/channels/${channel.id}/messages?limit=101`).set(auth(token));
    expect(invalidLimit.status).toBe(400);
    const wrongChannelCursor = await request(app).get(`/api/v1/channels/${channel.id}/messages?before=${otherChannelMessage.id}`).set(auth(token));
    expect(wrongChannelCursor.status).toBe(400);

    const initial = await request(app).get(`/api/v1/channels/${channel.id}/messages?limit=2`).set(auth(token));
    expect(initial.status).toBe(200);
    expect(initial.body.messages.map((message: { id: string }) => message.id)).toEqual([messages[1]!.id, messages[2]!.id]);
    expect(initial.body.nextCursor).toBe(messages[1]!.id);

    const previous = await request(app).get(`/api/v1/channels/${channel.id}/messages?limit=2&before=${initial.body.nextCursor as string}`).set(auth(token));
    expect(previous.body.messages.map((message: { id: string }) => message.id)).toEqual([messages[0]!.id]);
    expect(previous.body.nextCursor).toBeNull();

    const catchup = await request(app).get(`/api/v1/channels/${channel.id}/messages?limit=1&after=${messages[0]!.id}`).set(auth(token));
    expect(catchup.body.messages.map((message: { id: string }) => message.id)).toEqual([messages[1]!.id]);
    expect(catchup.body.nextCursor).toBe(messages[1]!.id);
    const finalCatchup = await request(app).get(`/api/v1/channels/${channel.id}/messages?limit=1&after=${catchup.body.nextCursor as string}`).set(auth(token));
    expect(finalCatchup.body.messages.map((message: { id: string }) => message.id)).toEqual([messages[2]!.id]);
    expect(finalCatchup.body.nextCursor).toBeNull();
  });
});
