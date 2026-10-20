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
    .set({ Authorization: `Bearer ${token}` })
    .send({ name: `Workspace ${crypto.randomUUID()}` });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('workspace members and invites', () => {
  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-WS-02: creates and lists invites, joins once, and rejects revoked or expired links', async () => {
    const owner = await register('Invite Owner');
    const admin = await register('Invite Admin');
    const member = await register('Invite Member');
    const outsider = await register('Invite Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: admin.id, workspaceId, role: 'ADMIN' } });
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });

    const unauthenticatedCreate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .send({});
    expect(unauthenticatedCreate.status).toBe(401);
    const memberCreate = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(member.token))
      .send({});
    expect(memberCreate.status).toBe(403);
    const invalidExpiry = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(owner.token))
      .send({ expiresAt: 'not-a-date' });
    expect(invalidExpiry.status).toBe(400);
    const pastExpiry = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(owner.token))
      .send({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(pastExpiry.status).toBe(400);

    const permanent = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(owner.token))
      .send({});
    expect(permanent.status).toBe(201);
    expect(permanent.body).toMatchObject({ id: expect.any(String), code: expect.any(String), expiresAt: null });

    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const expiring = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(admin.token))
      .send({ expiresAt: futureExpiry.toISOString() });
    expect(expiring.status).toBe(201);
    expect(new Date(expiring.body.expiresAt as string).getTime()).toBe(futureExpiry.getTime());

    const unauthenticatedList = await request(app).get(`/api/v1/workspaces/${workspaceId}/invites`);
    expect(unauthenticatedList.status).toBe(401);
    const outsiderList = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(outsider.token));
    expect(outsiderList.status).toBe(404);
    const memberList = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(member.token));
    expect(memberList.status).toBe(403);
    const activeList = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(owner.token));
    expect(activeList.status).toBe(200);
    expect(activeList.body).toHaveLength(2);

    const unauthenticatedJoin = await request(app).post(`/api/v1/invites/${permanent.body.code as string}/join`);
    expect(unauthenticatedJoin.status).toBe(401);
    const joined = await request(app)
      .post(`/api/v1/invites/${permanent.body.code as string}/join`)
      .set(auth(outsider.token));
    expect(joined.status).toBe(200);
    expect(joined.body.id).toBe(workspaceId);
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: outsider.id, workspaceId } },
    });
    expect(membership?.role).toBe('MEMBER');

    const duplicateJoin = await request(app)
      .post(`/api/v1/invites/${permanent.body.code as string}/join`)
      .set(auth(outsider.token));
    expect(duplicateJoin.status).toBe(409);

    const revoked = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(owner.token))
      .send({});
    expect(revoked.status).toBe(201);
    const unauthenticatedRevoke = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/invites/${revoked.body.id as string}`);
    expect(unauthenticatedRevoke.status).toBe(401);
    const memberRevoke = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/invites/${revoked.body.id as string}`)
      .set(auth(member.token));
    expect(memberRevoke.status).toBe(403);
    const revoke = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/invites/${revoked.body.id as string}`)
      .set(auth(admin.token));
    expect(revoke.status).toBe(204);
    const revokedJoin = await request(app)
      .post(`/api/v1/invites/${revoked.body.code as string}/join`)
      .set(auth(outsider.token));
    expect(revokedJoin.status).toBe(404);

    const expired = await request(app)
      .post(`/api/v1/workspaces/${workspaceId}/invites`)
      .set(auth(owner.token))
      .send({ expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    expect(expired.status).toBe(201);
    await prisma.inviteLink.update({
      where: { id: expired.body.id as string },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expiredJoin = await request(app)
      .post(`/api/v1/invites/${expired.body.code as string}/join`)
      .set(auth(outsider.token));
    expect(expiredJoin.status).toBe(404);
  });

  it('TC-WS-03: lets only Owners change eligible member roles', async () => {
    const owner = await register('Role Owner');
    const admin = await register('Role Admin');
    const member = await register('Role Member');
    const outsider = await register('Role Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: admin.id, workspaceId, role: 'ADMIN' } });
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });

    const unauthenticatedList = await request(app).get(`/api/v1/workspaces/${workspaceId}/members`);
    expect(unauthenticatedList.status).toBe(401);
    const outsiderList = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set(auth(outsider.token));
    expect(outsiderList.status).toBe(404);
    const members = await request(app)
      .get(`/api/v1/workspaces/${workspaceId}/members`)
      .set(auth(member.token));
    expect(members.status).toBe(200);
    expect(members.body).toHaveLength(3);
    expect(JSON.stringify(members.body)).not.toContain('passwordHash');

    const unauthenticatedChange = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .send({ role: 'ADMIN' });
    expect(unauthenticatedChange.status).toBe(401);
    const adminChange = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .set(auth(admin.token))
      .send({ role: 'ADMIN' });
    expect(adminChange.status).toBe(403);
    const outsiderChange = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .set(auth(outsider.token))
      .send({ role: 'ADMIN' });
    expect(outsiderChange.status).toBe(404);
    const invalidRole = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .set(auth(owner.token))
      .send({ role: 'OWNER' });
    expect(invalidRole.status).toBe(400);
    const ownerRoleChange = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${owner.id}`)
      .set(auth(owner.token))
      .send({ role: 'MEMBER' });
    expect(ownerRoleChange.status).toBe(403);

    const promoted = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .set(auth(owner.token))
      .send({ role: 'ADMIN' });
    expect(promoted.status).toBe(200);
    expect(promoted.body).toMatchObject({ user: { id: member.id }, role: 'ADMIN' });
    const demoted = await request(app)
      .patch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .set(auth(owner.token))
      .send({ role: 'MEMBER' });
    expect(demoted.status).toBe(200);
    expect(demoted.body.role).toBe('MEMBER');
  });

  it('TC-WS-04: lets Admins remove members, protects the Owner, and lets a Member leave', async () => {
    const owner = await register('Removal Owner');
    const admin = await register('Removal Admin');
    const member = await register('Removal Member');
    const other = await register('Removal Other');
    const outsider = await register('Removal Outsider');
    const workspaceId = await createWorkspace(owner.token);
    await prisma.membership.create({ data: { userId: admin.id, workspaceId, role: 'ADMIN' } });
    await prisma.membership.create({ data: { userId: member.id, workspaceId, role: 'MEMBER' } });
    await prisma.membership.create({ data: { userId: other.id, workspaceId, role: 'MEMBER' } });

    const unauthenticated = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${other.id}`);
    expect(unauthenticated.status).toBe(401);
    const outsiderRemoval = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${other.id}`)
      .set(auth(outsider.token));
    expect(outsiderRemoval.status).toBe(404);
    const memberRemoval = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${other.id}`)
      .set(auth(member.token));
    expect(memberRemoval.status).toBe(403);
    const ownerRemoval = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${owner.id}`)
      .set(auth(admin.token));
    expect(ownerRemoval.status).toBe(403);

    const removedByAdmin = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${other.id}`)
      .set(auth(admin.token));
    expect(removedByAdmin.status).toBe(204);
    expect(await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: other.id, workspaceId } },
    })).toBeNull();

    const leftByMember = await request(app)
      .delete(`/api/v1/workspaces/${workspaceId}/members/${member.id}`)
      .set(auth(member.token));
    expect(leftByMember.status).toBe(204);
    expect(await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: member.id, workspaceId } },
    })).toBeNull();
  });
});
