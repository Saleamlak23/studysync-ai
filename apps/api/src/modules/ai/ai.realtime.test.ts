import request from 'supertest';
import { createServer } from 'node:http';
import { io as connectSocket } from '../../../../web/node_modules/socket.io-client/build/esm/index.js';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { createUser } from '../../tests/factories.js';
import { MockAIProvider } from '../../tests/mocks/aiProvider.js';
import { initIo } from '../../realtime/io.js';

const app = createApp({ aiProviders: { primary: new MockAIProvider('groq') } });
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('AI breakdown realtime', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-AI-04: broadcasts every confirmed card after it is committed', async () => {
    const user = await createUser();
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Password123!' });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;
    const workspace = await request(app).post('/api/v1/workspaces').set(auth(token)).send({ name: `AI realtime ${crypto.randomUUID()}` });
    expect(workspace.status).toBe(201);
    const workspaceId = workspace.body.id as string;
    await prisma.workspace.update({ where: { id: workspaceId }, data: { aiEnabled: true } });
    const board = await prisma.board.findUniqueOrThrow({ where: { workspaceId }, select: { id: true } });
    const list = await prisma.list.create({ data: { boardId: board.id, name: 'To do', position: 1024 } });

    const httpServer = createServer(app);
    const ioServer = initIo(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
    const socket = connectSocket(`http://127.0.0.1:${address.port}`, { auth: { token }, transports: ['websocket'] });
    const waitForConnect = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 1000);
      socket.once('connect', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', (error: Error) => { clearTimeout(timer); reject(error); });
    });
    try {
      await waitForConnect;
      const joined = await new Promise<{ ok: boolean }>((resolve) => socket.emit('workspace:join', { workspaceId }, resolve));
      expect(joined.ok).toBe(true);
      const event = new Promise<{ id: string; title: string }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timed out waiting for board:card_created')), 1000);
        socket.once('board:card_created', (payload: { id: string; title: string }) => { clearTimeout(timer); resolve(payload); });
      });
      const response = await request(app).post(`/api/v1/workspaces/${workspaceId}/ai/breakdown/confirm`).set(auth(token))
        .send({ listId: list.id, items: [{ title: 'Committed task' }, { title: 'Second committed task' }] });
      expect(response.status).toBe(201);
      const created = await event;
      expect(created.title).toBe('Committed task');
      expect(await prisma.card.findUnique({ where: { id: created.id }, select: { title: true } })).toEqual({ title: 'Committed task' });
    } finally {
      socket.disconnect();
      await new Promise<void>((resolve) => ioServer.close(() => resolve()));
    }
  });
});
