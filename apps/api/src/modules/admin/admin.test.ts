import request from 'supertest';
import { createServer } from 'node:http';
import { io as connectSocket } from 'socket.io-client';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { createUser } from '../../tests/factories.js';
import { initIo } from '../../realtime/io.js';
import { env } from '../../config/env.js';
import { enforceAiLimits } from '../ai/limits.service.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createAdminAndLogin() {
  const admin = await createUser({
    name: 'Admin User',
    systemRole: 'ADMIN',
  });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: admin.email, password: 'Password123!' });
  expect(login.status).toBe(200);
  return { admin, token: login.body.accessToken as string };
}

async function createNormalUserAndLogin() {
  const user = await createUser({
    name: 'Normal User',
    systemRole: 'USER',
  });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Password123!' });
  expect(login.status).toBe(200);
  const cookieHeader = login.headers['set-cookie'];
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
  const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
  return { user, token: login.body.accessToken as string, refreshCookie };
}

describe('system admin module', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // TC-ADM-01: List, search, suspend and reactivate users
  // ------------------------------------------------------------------
  describe('TC-ADM-01: user management', () => {
    it('allows System Admin to list, search, suspend and reactivate users, and blocks non-admins', async () => {
      const { token: adminToken } = await createAdminAndLogin();
      const { user: normalUser, token: normalToken } = await createNormalUserAndLogin();

      // Non-admin receives 403 FORBIDDEN
      const forbiddenList = await request(app)
        .get('/api/v1/admin/users')
        .set(auth(normalToken));
      expect(forbiddenList.status).toBe(403);
      expect(forbiddenList.body.error.code).toBe('FORBIDDEN');

      const forbiddenPatch = await request(app)
        .patch(`/api/v1/admin/users/${normalUser.id}`)
        .set(auth(normalToken))
        .send({ status: 'SUSPENDED' });
      expect(forbiddenPatch.status).toBe(403);
      expect(forbiddenPatch.body.error.code).toBe('FORBIDDEN');

      // Unauthenticated receives 401 UNAUTHENTICATED
      const unauth = await request(app).get('/api/v1/admin/users');
      expect(unauth.status).toBe(401);
      expect(unauth.body.error.code).toBe('UNAUTHENTICATED');

      // Admin can list users
      const listRes = await request(app)
        .get('/api/v1/admin/users')
        .set(auth(adminToken));
      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.some((u: { id: string }) => u.id === normalUser.id)).toBe(true);

      // Admin can search by email or name
      const searchRes = await request(app)
        .get(`/api/v1/admin/users?q=${encodeURIComponent(normalUser.email)}`)
        .set(auth(adminToken));
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.length).toBe(1);
      expect(searchRes.body[0].id).toBe(normalUser.id);
      expect(searchRes.body[0].status).toBe('ACTIVE');

      // Admin can filter by status
      const activeRes = await request(app)
        .get('/api/v1/admin/users?status=ACTIVE')
        .set(auth(adminToken));
      expect(activeRes.status).toBe(200);
      expect(activeRes.body.every((u: { status: string }) => u.status === 'ACTIVE')).toBe(true);

      // Admin suspends user
      const suspendRes = await request(app)
        .patch(`/api/v1/admin/users/${normalUser.id}`)
        .set(auth(adminToken))
        .send({ status: 'SUSPENDED' });
      expect(suspendRes.status).toBe(200);
      expect(suspendRes.body.id).toBe(normalUser.id);
      expect(suspendRes.body.status).toBe('SUSPENDED');

      // Check user in DB is suspended
      const dbUserSuspended = await prisma.user.findUnique({ where: { id: normalUser.id } });
      expect(dbUserSuspended?.status).toBe('SUSPENDED');

      // Admin reactivates user
      const reactivateRes = await request(app)
        .patch(`/api/v1/admin/users/${normalUser.id}`)
        .set(auth(adminToken))
        .send({ status: 'ACTIVE' });
      expect(reactivateRes.status).toBe(200);
      expect(reactivateRes.body.status).toBe('ACTIVE');

      const dbUserActive = await prisma.user.findUnique({ where: { id: normalUser.id } });
      expect(dbUserActive?.status).toBe('ACTIVE');
    });

    it('rejects invalid inputs on user management (400, 404)', async () => {
      const { token: adminToken } = await createAdminAndLogin();

      // Non-existent user
      const nonExistentId = crypto.randomUUID();
      const notFoundRes = await request(app)
        .patch(`/api/v1/admin/users/${nonExistentId}`)
        .set(auth(adminToken))
        .send({ status: 'SUSPENDED' });
      expect(notFoundRes.status).toBe(404);
      expect(notFoundRes.body.error.code).toBe('NOT_FOUND');

      // Invalid status value
      const invalidStatusRes = await request(app)
        .patch(`/api/v1/admin/users/${nonExistentId}`)
        .set(auth(adminToken))
        .send({ status: 'INVALID_STATUS' });
      expect(invalidStatusRes.status).toBe(400);
      expect(invalidStatusRes.body.error.code).toBe('VALIDATION_ERROR');

      // Invalid UUID param
      const badUuidRes = await request(app)
        .patch('/api/v1/admin/users/not-a-uuid')
        .set(auth(adminToken))
        .send({ status: 'SUSPENDED' });
      expect(badUuidRes.status).toBe(400);
      expect(badUuidRes.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ------------------------------------------------------------------
  // TC-ADM-02: AI usage report and AI limits configuration
  // ------------------------------------------------------------------
  describe('TC-ADM-02: AI usage and limits', () => {
    it('reads and changes limits, rejects invalid values, and applies new limits immediately', async () => {
      const { token: adminToken } = await createAdminAndLogin();
      const { user: normalUser, token: normalToken } = await createNormalUserAndLogin();

      // Non-admin receives 403 FORBIDDEN
      const forbiddenLimitsGet = await request(app)
        .get('/api/v1/admin/ai-limits')
        .set(auth(normalToken));
      expect(forbiddenLimitsGet.status).toBe(403);

      const forbiddenLimitsPut = await request(app)
        .put('/api/v1/admin/ai-limits')
        .set(auth(normalToken))
        .send({ userDailyLimit: 10, workspaceDailyLimit: 20 });
      expect(forbiddenLimitsPut.status).toBe(403);

      // Clear existing appSettings for clean baseline
      await prisma.appSetting.deleteMany({
        where: { key: { in: ['ai.userDailyLimit', 'ai.workspaceDailyLimit'] } },
      });

      // Initial read: defaults returned with updatedAt: null
      const initialLimits = await request(app)
        .get('/api/v1/admin/ai-limits')
        .set(auth(adminToken));
      expect(initialLimits.status).toBe(200);
      expect(initialLimits.body.userDailyLimit).toBe(env.AI_USER_DAILY_LIMIT);
      expect(initialLimits.body.workspaceDailyLimit).toBe(env.AI_WORKSPACE_DAILY_LIMIT);
      expect(initialLimits.body.updatedAt).toBeNull();

      // PUT rejects invalid values (<= 0 or non-integer)
      const invalidPut1 = await request(app)
        .put('/api/v1/admin/ai-limits')
        .set(auth(adminToken))
        .send({ userDailyLimit: 0, workspaceDailyLimit: 10 });
      expect(invalidPut1.status).toBe(400);
      expect(invalidPut1.body.error.code).toBe('VALIDATION_ERROR');

      const invalidPut2 = await request(app)
        .put('/api/v1/admin/ai-limits')
        .set(auth(adminToken))
        .send({ userDailyLimit: 5, workspaceDailyLimit: -3 });
      expect(invalidPut2.status).toBe(400);

      // PUT valid new limits
      const updatedLimits = await request(app)
        .put('/api/v1/admin/ai-limits')
        .set(auth(adminToken))
        .send({ userDailyLimit: 2, workspaceDailyLimit: 15 });
      expect(updatedLimits.status).toBe(200);
      expect(updatedLimits.body.userDailyLimit).toBe(2);
      expect(updatedLimits.body.workspaceDailyLimit).toBe(15);
      expect(typeof updatedLimits.body.updatedAt).toBe('string');

      // GET returns the newly saved limits
      const recheckLimits = await request(app)
        .get('/api/v1/admin/ai-limits')
        .set(auth(adminToken));
      expect(recheckLimits.status).toBe(200);
      expect(recheckLimits.body.userDailyLimit).toBe(2);
      expect(recheckLimits.body.workspaceDailyLimit).toBe(15);
      expect(recheckLimits.body.updatedAt).toBe(updatedLimits.body.updatedAt);

      // Verify limits apply immediately to enforceAiLimits
      const ws = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(normalToken))
        .send({ name: `Limits WS ${crypto.randomUUID()}` });
      expect(ws.status).toBe(201);
      const workspaceId = ws.body.id as string;

      // Seed 2 requests for normalUser in this workspace
      await prisma.aIRequestLog.createMany({
        data: [
          {
            userId: normalUser.id,
            workspaceId,
            feature: 'ASK',
            provider: 'groq',
            tokensIn: 50,
            tokensOut: 100,
            status: 'SUCCESS',
            latencyMs: 300,
          },
          {
            userId: normalUser.id,
            workspaceId,
            feature: 'SUMMARIZE',
            provider: 'gemini',
            tokensIn: 100,
            tokensOut: 200,
            status: 'SUCCESS',
            latencyMs: 400,
          },
        ],
      });

      // 3rd request should fail limit check (limit = 2)
      await expect(enforceAiLimits(normalUser.id, workspaceId)).rejects.toMatchObject({
        status: 429,
        code: 'AI_LIMIT_REACHED',
      });

      // Now increase user limit to 5
      await request(app)
        .put('/api/v1/admin/ai-limits')
        .set(auth(adminToken))
        .send({ userDailyLimit: 5, workspaceDailyLimit: 15 });

      // Immediate retry succeeds without restart
      await expect(enforceAiLimits(normalUser.id, workspaceId)).resolves.toBeUndefined();
    });

    it('aggregates AI usage totals and rows grouped by user, workspace, feature, and provider with filters', async () => {
      const { token: adminToken } = await createAdminAndLogin();
      const { user: userA, token: tokenA } = await createNormalUserAndLogin();
      const { user: userB, token: tokenB } = await createNormalUserAndLogin();

      const wsA = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(tokenA))
        .send({ name: `Usage WS A ${crypto.randomUUID()}` });
      const wsB = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(tokenB))
        .send({ name: `Usage WS B ${crypto.randomUUID()}` });

      const wsAId = wsA.body.id as string;
      const wsBId = wsB.body.id as string;

      // Seed logs
      await prisma.aIRequestLog.createMany({
        data: [
          {
            userId: userA.id,
            workspaceId: wsAId,
            feature: 'ASK',
            provider: 'groq',
            tokensIn: 100,
            tokensOut: 200,
            status: 'SUCCESS',
            latencyMs: 150,
          },
          {
            userId: userA.id,
            workspaceId: wsAId,
            feature: 'ASK',
            provider: 'groq',
            tokensIn: 50,
            tokensOut: 150,
            status: 'SUCCESS',
            latencyMs: 120,
          },
          {
            userId: userB.id,
            workspaceId: wsBId,
            feature: 'BREAKDOWN',
            provider: 'gemini',
            tokensIn: 300,
            tokensOut: 600,
            status: 'SUCCESS',
            latencyMs: 450,
          },
        ],
      });

      // Query usage for workspace A
      const usageA = await request(app)
        .get(`/api/v1/admin/ai-usage?workspaceId=${wsAId}`)
        .set(auth(adminToken));
      expect(usageA.status).toBe(200);
      expect(usageA.body.totals.requests).toBe(2);
      expect(usageA.body.totals.tokensIn).toBe(150);
      expect(usageA.body.totals.tokensOut).toBe(350);
      expect(usageA.body.rows.length).toBe(1);
      expect(usageA.body.rows[0]).toMatchObject({
        userId: userA.id,
        workspaceId: wsAId,
        feature: 'ASK',
        provider: 'groq',
        requests: 2,
        tokensIn: 150,
        tokensOut: 350,
      });

      // Query usage for user B
      const usageB = await request(app)
        .get(`/api/v1/admin/ai-usage?userId=${userB.id}`)
        .set(auth(adminToken));
      expect(usageB.status).toBe(200);
      expect(usageB.body.totals.requests).toBe(1);
      expect(usageB.body.totals.tokensIn).toBe(300);
      expect(usageB.body.totals.tokensOut).toBe(600);
      expect(usageB.body.rows[0]).toMatchObject({
        userId: userB.id,
        workspaceId: wsBId,
        feature: 'BREAKDOWN',
        provider: 'gemini',
        requests: 1,
      });
    });
  });

  // ------------------------------------------------------------------
  // TC-AUTH-05: Suspend a signed-in user; verify login 403, refresh 401, socket disconnected
  // ------------------------------------------------------------------
  describe('TC-AUTH-05: suspension effects on auth and sockets', () => {
    it('revokes refresh tokens, rejects login with 403, rejects refresh with 401, and disconnects open sockets', async () => {
      const { token: adminToken } = await createAdminAndLogin();
      const { user, token: userToken, refreshCookie } = await createNormalUserAndLogin();
      expect(refreshCookie).toBeDefined();

      // Spin up socket server with initIo
      const httpServer = createServer(app);
      const ioServer = initIo(httpServer);
      await new Promise<void>((resolve) => httpServer.listen(0, resolve));
      const address = httpServer.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');

      // Connect socket with active user token
      const socket = connectSocket(`http://127.0.0.1:${address.port}`, {
        auth: { token: userToken },
        transports: ['websocket'],
      });

      const waitForConnect = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 2000);
        socket.once('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        socket.once('connect_error', (err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      await waitForConnect;
      expect(socket.connected).toBe(true);

      // Listen for socket disconnect
      const waitForDisconnect = new Promise<string>((resolve) => {
        socket.once('disconnect', (reason: string) => {
          resolve(reason);
        });
      });

      try {
        // System Admin suspends the user
        const suspendRes = await request(app)
          .patch(`/api/v1/admin/users/${user.id}`)
          .set(auth(adminToken))
          .send({ status: 'SUSPENDED' });
        expect(suspendRes.status).toBe(200);

        // 1. Socket must be forcibly disconnected
        const disconnectReason = await waitForDisconnect;
        expect(disconnectReason).toBe('io server disconnect');
        expect(socket.connected).toBe(false);

        // 2. Try login while suspended -> 403 ACCOUNT_SUSPENDED
        const loginAttempt = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: user.email, password: 'Password123!' });
        expect(loginAttempt.status).toBe(403);
        expect(loginAttempt.body.error.code).toBe('ACCOUNT_SUSPENDED');

        // 3. Try refresh with previous refresh token cookie -> 401 UNAUTHENTICATED
        const refreshAttempt = await request(app)
          .post('/api/v1/auth/refresh')
          .set('Cookie', [refreshCookie!]);
        expect(refreshAttempt.status).toBe(401);
        expect(refreshAttempt.body.error.code).toBe('UNAUTHENTICATED');

        // 4. Try connecting a new socket while suspended -> rejected
        const blockedSocket = connectSocket(`http://127.0.0.1:${address.port}`, {
          auth: { token: userToken },
          transports: ['websocket'],
        });

        const connectError = await new Promise<Error>((resolve) => {
          blockedSocket.once('connect_error', (err: Error) => resolve(err));
        });
        expect(connectError.message).toBe('Unauthorized');
        blockedSocket.disconnect();
      } finally {
        socket.disconnect();
        await new Promise<void>((resolve) => ioServer.close(() => resolve()));
      }
    });
  });
});
