import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { createApp } from '../../app.js';
import { createUser } from '../../tests/factories.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createSearchWorkspace() {
  const user = await createUser();
  const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: 'Password123!' });
  expect(login.status).toBe(200);
  const created = await request(app).post('/api/v1/workspaces').set(auth(login.body.accessToken)).send({ name: `Search ${crypto.randomUUID()}` });
  expect(created.status).toBe(201);
  return { userId: user.id, workspaceId: created.body.id as string, token: login.body.accessToken as string };
}

describe('workspace search', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-SRCH-01: finds cards, messages, and file names only in the requested workspace, with snippets', async () => {
    const owner = await createSearchWorkspace();
    const other = await createSearchWorkspace();
    const board = await prisma.board.findUniqueOrThrow({ where: { workspaceId: owner.workspaceId } });
    const list = await prisma.list.create({ data: { boardId: board.id, name: 'To do', position: 1024 } });
    const card = await prisma.card.create({ data: {
      listId: list.id, title: 'Orchid planning', description: 'Prepare the orchid laboratory report', position: 1024, createdById: owner.userId,
    } });
    const channel = await prisma.channel.findFirstOrThrow({ where: { workspaceId: owner.workspaceId } });
    const message = await prisma.message.create({ data: {
      channelId: channel.id, authorId: owner.userId, content: 'Discuss orchid research findings',
    } });
    const file = await prisma.file.create({ data: {
      workspaceId: owner.workspaceId, uploaderId: owner.userId, name: 'orchid-notes.txt', mimeType: 'text/plain', sizeBytes: 12,
    } });
    const otherBoard = await prisma.board.findUniqueOrThrow({ where: { workspaceId: other.workspaceId } });
    const otherList = await prisma.list.create({ data: { boardId: otherBoard.id, name: 'To do', position: 1024 } });
    const foreignCard = await prisma.card.create({ data: {
      listId: otherList.id, title: 'Orchid private plan', description: 'Private orchid details', position: 1024, createdById: other.userId,
    } });

    const result = await request(app).get(`/api/v1/workspaces/${owner.workspaceId}/search?q=orchid`)
      .set(auth(owner.token));
    expect(result.status).toBe(200);
    expect(result.body.cards.map((row: { id: string }) => row.id)).toEqual([card.id]);
    expect(result.body.cards[0].snippet).toContain('orchid');
    expect(result.body.cards[0].snippet).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(result.body.messages.map((row: { id: string }) => row.id)).toEqual([message.id]);
    expect(result.body.messages[0].snippet).toContain('orchid');
    expect(result.body.messages[0].snippet).not.toMatch(/<\/?[a-z][^>]*>/i);
    expect(result.body.files).toEqual([{ id: file.id, name: file.name }]);
    expect(JSON.stringify(result.body)).not.toContain(foreignCard.id);

    const onlyFiles = await request(app).get(`/api/v1/workspaces/${owner.workspaceId}/search?q=orchid&type=files&limit=1`)
      .set(auth(owner.token));
    expect(onlyFiles.status).toBe(200);
    expect(onlyFiles.body).toMatchObject({ cards: [], messages: [], files: [{ id: file.id }] });
  });

  it('TC-SRCH-01: rejects missing authentication, non-members, and queries shorter than two characters', async () => {
    const owner = await createSearchWorkspace();
    const outsider = await createSearchWorkspace();

    const unauthenticated = await request(app).get(`/api/v1/workspaces/${owner.workspaceId}/search?q=ab`);
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('UNAUTHENTICATED');

    const nonMember = await request(app).get(`/api/v1/workspaces/${owner.workspaceId}/search?q=ab`).set(auth(outsider.token));
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe('NOT_FOUND');

    const shortQuery = await request(app).get(`/api/v1/workspaces/${owner.workspaceId}/search?q=a`).set(auth(owner.token));
    expect(shortQuery.status).toBe(400);
    expect(shortQuery.body.error.code).toBe('VALIDATION_ERROR');
  });
});
