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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('workspaces API', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-WS-01: creates workspace with owner, board and general channel; validates input and membership access', async () => {
    const owner = await register('Workspace Owner');
    const outsider = await register('Workspace Outsider');

    const missingAuth = await request(app).post('/api/v1/workspaces').send({ name: 'Study team' });
    expect(missingAuth.status).toBe(401);

    const invalid = await request(app)
      .post('/api/v1/workspaces')
      .set(auth(owner.token))
      .send({ name: '   ' });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/v1/workspaces')
      .set(auth(owner.token))
      .send({ name: '  Study team  ', description: 'Group project' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Study team', description: 'Group project', aiEnabled: false });

    const [membership, board, general] = await Promise.all([
      prisma.membership.findUnique({ where: { userId_workspaceId: { userId: owner.id, workspaceId: created.body.id as string } } }),
      prisma.board.findUnique({ where: { workspaceId: created.body.id as string } }),
      prisma.channel.findFirst({ where: { workspaceId: created.body.id as string, name: 'general' } }),
    ]);
    expect(membership?.role).toBe('OWNER');
    expect(board).not.toBeNull();
    expect(general).not.toBeNull();

    const missingListAuth = await request(app).get('/api/v1/workspaces');
    expect(missingListAuth.status).toBe(401);
    const ownerList = await request(app).get('/api/v1/workspaces').set(auth(owner.token));
    expect(ownerList.body).toHaveLength(1);
    expect(ownerList.body[0]).toMatchObject({ id: created.body.id, myRole: 'OWNER' });

    const missingGetAuth = await request(app).get(`/api/v1/workspaces/${created.body.id as string}`);
    expect(missingGetAuth.status).toBe(401);
    const ownerGet = await request(app)
      .get(`/api/v1/workspaces/${created.body.id as string}`)
      .set(auth(owner.token));
    expect(ownerGet.status).toBe(200);
    expect(ownerGet.body.myRole).toBe('OWNER');

    const outsiderGet = await request(app)
      .get(`/api/v1/workspaces/${created.body.id as string}`)
      .set(auth(outsider.token));
    expect(outsiderGet.status).toBe(404);

    const missingPatchAuth = await request(app)
      .patch(`/api/v1/workspaces/${created.body.id as string}`)
      .send({ name: 'Renamed' });
    expect(missingPatchAuth.status).toBe(401);
    const outsiderPatch = await request(app)
      .patch(`/api/v1/workspaces/${created.body.id as string}`)
      .set(auth(outsider.token))
      .send({ name: 'Renamed' });
    expect(outsiderPatch.status).toBe(404);
    const invalidPatch = await request(app)
      .patch(`/api/v1/workspaces/${created.body.id as string}`)
      .set(auth(owner.token))
      .send({ name: '' });
    expect(invalidPatch.status).toBe(400);
    const updated = await request(app)
      .patch(`/api/v1/workspaces/${created.body.id as string}`)
      .set(auth(owner.token))
      .send({ name: 'Renamed study team' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed study team');
  });

  it('TC-WS-05: archives from lists, restores within 30 days, and rejects unauthorized or expired restore', async () => {
    const owner = await register('Archive Owner');
    const admin = await register('Archive Admin');
    const outsider = await register('Archive Outsider');
    const created = await request(app)
      .post('/api/v1/workspaces')
      .set(auth(owner.token))
      .send({ name: 'Archive test' });
    const workspaceId = created.body.id as string;

    await prisma.membership.create({ data: { userId: admin.id, workspaceId, role: 'ADMIN' } });

    const noToken = await request(app).post(`/api/v1/workspaces/${workspaceId}/archive`);
    expect(noToken.status).toBe(401);
    const adminArchive = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/archive`)
      .set(auth(admin.token));
    expect(adminArchive.status).toBe(403);

    const archived = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/archive`)
      .set(auth(owner.token));
    expect(archived.status).toBe(200);
    expect(archived.body.archivedAt).toBeTruthy();
    expect((await request(app).get('/api/v1/workspaces').set(auth(owner.token))).body).toEqual([]);

    const outsiderRestore = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/restore`)
      .set(auth(outsider.token));
    expect(outsiderRestore.status).toBe(404);
    const adminRestore = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/restore`)
      .set(auth(admin.token));
    expect(adminRestore.status).toBe(403);

    const restored = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/restore`)
      .set(auth(owner.token));
    expect(restored.status).toBe(200);
    expect(restored.body.archivedAt).toBeNull();

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { archivedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
    });
    const expiredRestore = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/restore`)
      .set(auth(owner.token));
    expect(expiredRestore.status).toBe(404);
  });

  it('TC-WS-06: records the Owner consent and rejects Admin or invalid consent changes', async () => {
    const owner = await register('Consent Owner');
    const admin = await register('Consent Admin');
    const created = await request(app)
      .post('/api/v1/workspaces')
      .set(auth(owner.token))
      .send({ name: 'Consent test' });
    const workspaceId = created.body.id as string;
    await prisma.membership.create({ data: { userId: admin.id, workspaceId, role: 'ADMIN' } });

    const noToken = await request(app).put(`/api/v1/workspaces/${workspaceId}/ai-consent`).send({ enabled: true });
    expect(noToken.status).toBe(401);
    const invalid = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/ai-consent`)
      .set(auth(owner.token))
      .send({ enabled: 'yes' });
    expect(invalid.status).toBe(400);
    const adminChange = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/ai-consent`)
      .set(auth(admin.token))
      .send({ enabled: true });
    expect(adminChange.status).toBe(403);

    const enabled = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/ai-consent`)
      .set(auth(owner.token))
      .send({ enabled: true });
    expect(enabled.status).toBe(200);
    expect(enabled.body).toMatchObject({ aiEnabled: true });
    expect(enabled.body.aiConsentAt).toBeTruthy();
    const consent = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    expect(consent?.aiConsentById).toBe(owner.id);

    const disabled = await request(app)
      .put(`/api/v1/workspaces/${workspaceId}/ai-consent`)
      .set(auth(owner.token))
      .send({ enabled: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.aiEnabled).toBe(false);
  });
});
