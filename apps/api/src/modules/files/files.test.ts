import request from 'supertest';
import type { Response as SuperagentResponse } from 'superagent';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const parseBuffer = (response: SuperagentResponse, callback: (error: Error | null, body?: Buffer) => void) => {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
};

async function register(name: string) {
  const email = `${name.toLowerCase().replaceAll(' ', '-')}-${crypto.randomUUID()}@example.test`;
  const response = await request(app).post('/api/v1/auth/register').send({ name, email, password: 'Password123!' });
  expect(response.status).toBe(201);
  return { id: response.body.user.id as string, token: response.body.accessToken as string };
}

async function createWorkspace(token: string) {
  const response = await request(app).post('/api/v1/workspaces').set(auth(token)).send({ name: `Files ${crypto.randomUUID()}` });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

function upload(workspaceId: string, token: string, data: Buffer, filename: string, contentType: string) {
  return request(app).post(`/api/v1/workspaces/${workspaceId}/files`).set(auth(token)).attach('file', data, { filename, contentType });
}

describe('files API', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-FILE-01: uploads allowed types and rejects missing, unsupported, oversized and over-cap files', async () => {
    const owner = await register('File Owner');
    const outsider = await register('File Outsider');
    const workspaceId = await createWorkspace(owner.token);

    const noAuth = await request(app).post(`/api/v1/workspaces/${workspaceId}/files`);
    expect(noAuth.status).toBe(401);
    const nonMember = await upload(workspaceId, outsider.token, Buffer.from('private'), 'private.txt', 'text/plain');
    expect(nonMember.status).toBe(404);
    const missingFile = await request(app).post(`/api/v1/workspaces/${workspaceId}/files`).set(auth(owner.token));
    expect(missingFile.status).toBe(400);

    const allowed = [
      ['notes.pdf', 'application/pdf'],
      ['notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['notes.txt', 'text/plain'],
      ['image.png', 'image/png'],
      ['image.jpg', 'image/jpeg'],
    ] as const;
    for (const [filename, contentType] of allowed) {
      const response = await upload(workspaceId, owner.token, Buffer.from(`contents:${filename}`), filename, contentType);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ workspaceId, name: filename, mimeType: contentType, uploaderId: owner.id });
    }

    const unsupported = await upload(workspaceId, owner.token, Buffer.from('bad'), 'script.exe', 'application/octet-stream');
    expect(unsupported.status).toBe(415);
    expect(unsupported.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');

    const tooLarge = await upload(workspaceId, owner.token, Buffer.alloc(5 * 1024 * 1024 + 1), 'large.txt', 'text/plain');
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.error.code).toBe('FILE_TOO_LARGE');

    await prisma.file.create({ data: {
      workspaceId,
      name: 'fills-storage.txt',
      mimeType: 'text/plain',
      sizeBytes: env.WORKSPACE_STORAGE_CAP_BYTES,
    } });
    const overCap = await upload(workspaceId, owner.token, Buffer.from('x'), 'over-cap.txt', 'text/plain');
    expect(overCap.status).toBe(413);
    expect(overCap.body.error.code).toBe('STORAGE_LIMIT_REACHED');
  });

  it('TC-FILE-02: streams exact file bytes only to workspace members', async () => {
    const owner = await register('Download Owner');
    const outsider = await register('Download Outsider');
    const workspaceId = await createWorkspace(owner.token);
    const bytes = Buffer.from('download these exact bytes\0\x01');
    const created = await upload(workspaceId, owner.token, bytes, 'download.txt', 'text/plain');
    expect(created.status).toBe(201);

    const noAuth = await request(app).get(`/api/v1/files/${created.body.id as string}`);
    expect(noAuth.status).toBe(401);
    const nonMember = await request(app).get(`/api/v1/files/${created.body.id as string}`).set(auth(outsider.token));
    expect(nonMember.status).toBe(404);
    const download = await request(app).get(`/api/v1/files/${created.body.id as string}`).set(auth(owner.token)).buffer(true).parse(parseBuffer);
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('text/plain');
    expect(download.headers['content-disposition']).toContain("filename*=UTF-8''download.txt");
    expect(download.body).toEqual(bytes);

    const missing = await request(app).get(`/api/v1/files/${crypto.randomUUID()}`).set(auth(owner.token));
    expect(missing.status).toBe(404);
  });

  it('TC-FILE-03: lists newest files first with uploader metadata and no bytes', async () => {
    const owner = await register('List Owner');
    const outsider = await register('List Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await upload(workspaceId, owner.token, Buffer.from('first'), 'first.txt', 'text/plain');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await upload(workspaceId, owner.token, Buffer.from('second'), 'second.txt', 'text/plain');

    const noAuth = await request(app).get(`/api/v1/workspaces/${workspaceId}/files`);
    expect(noAuth.status).toBe(401);
    const nonMember = await request(app).get(`/api/v1/workspaces/${workspaceId}/files`).set(auth(outsider.token));
    expect(nonMember.status).toBe(404);
    const listed = await request(app).get(`/api/v1/workspaces/${workspaceId}/files`).set(auth(owner.token));
    expect(listed.status).toBe(200);
    expect(listed.body.map((file: { name: string }) => file.name)).toEqual(['second.txt', 'first.txt']);
    expect(listed.body[0]).toMatchObject({ uploader: { id: owner.id }, sizeBytes: 6 });
    expect(listed.body[0].blob).toBeUndefined();
    expect(JSON.stringify(listed.body)).not.toContain('contents:');
    const olderPage = await request(app).get(`/api/v1/workspaces/${workspaceId}/files?cursor=${listed.body[0].id as string}`).set(auth(owner.token));
    expect(olderPage.status).toBe(200);
    expect(olderPage.body.map((file: { name: string }) => file.name)).toEqual(['first.txt']);
    const invalidCursor = await request(app).get(`/api/v1/workspaces/${workspaceId}/files?cursor=${crypto.randomUUID()}`).set(auth(owner.token));
    expect(invalidCursor.status).toBe(400);
  });

  it('TC-CHAT-04: attaches an uploaded file to a message and rejects a file from another workspace', async () => {
    const owner = await register('Attachment Owner');
    const otherOwner = await register('Other Attachment Owner');
    const workspaceId = await createWorkspace(owner.token);
    const otherWorkspaceId = await createWorkspace(otherOwner.token);
    const channel = await prisma.channel.findFirstOrThrow({ where: { workspaceId, name: 'general' } });
    const localFile = await upload(workspaceId, owner.token, Buffer.from('chat attachment'), 'chat.txt', 'text/plain');
    const foreignFile = await upload(otherWorkspaceId, otherOwner.token, Buffer.from('foreign'), 'foreign.txt', 'text/plain');

    const sent = await request(app).post(`/api/v1/channels/${channel.id}/messages`).set(auth(owner.token)).send({ content: 'See attachment', fileId: localFile.body.id as string });
    expect(sent.status).toBe(201);
    expect(sent.body.file).toMatchObject({ id: localFile.body.id, name: 'chat.txt', sizeBytes: 15 });
    expect(sent.body.file.blob).toBeUndefined();
    const foreign = await request(app).post(`/api/v1/channels/${channel.id}/messages`).set(auth(owner.token)).send({ content: 'Foreign attachment', fileId: foreignFile.body.id as string });
    expect(foreign.status).toBe(400);
  });
});
