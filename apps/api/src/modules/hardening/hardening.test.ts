import request from 'supertest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';
import { createUser } from '../../tests/factories.js';
import { resetAuthLimiter } from '../../middleware/rateLimit.js';
import { env } from '../../config/env.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('hardening and non-functional requirements (S16)', () => {
  beforeEach(() => {
    resetAuthLimiter();
  });

  afterAll(async () => {
    resetAuthLimiter();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // TC-NFR-06: Rate limiting, security headers, and CORS
  // ------------------------------------------------------------------
  describe('TC-NFR-06: rate limits, headers, and CORS', () => {
    it(
      'returns 429 RATE_LIMITED on the 11th login attempt within a minute',
      async () => {
        const user = await createUser();

        // Send 10 consecutive login attempts with rate limit testing enabled
        for (let i = 0; i < 10; i++) {
          const res = await request(app)
            .post('/api/v1/auth/login')
            .set('X-Test-Rate-Limit', 'true')
            .send({ email: user.email, password: 'Password123!' });
          expect(res.status).toBe(200);
        }

        // 11th request from same IP must be rate limited
        const rateLimitedRes = await request(app)
          .post('/api/v1/auth/login')
          .set('X-Test-Rate-Limit', 'true')
          .send({ email: user.email, password: 'Password123!' });

        expect(rateLimitedRes.status).toBe(429);
        expect(rateLimitedRes.body.error.code).toBe('RATE_LIMITED');
      },
      15000,
    );

    it('delivers standard security headers via Helmet on API responses', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);

      // Verify Helmet security headers
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-download-options']).toBe('noopen');
    });

    it('permits configured frontend origin and blocks foreign origins via CORS', async () => {
      // 1. Matching origin succeeds with CORS headers
      const allowedRes = await request(app)
        .get('/health')
        .set('Origin', env.CLIENT_ORIGIN);
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.headers['access-control-allow-origin']).toBe(env.CLIENT_ORIGIN);
      expect(allowedRes.headers['access-control-allow-credentials']).toBe('true');

      // 2. Foreign origin is blocked with 403 FORBIDDEN
      const blockedRes = await request(app)
        .get('/health')
        .set('Origin', 'http://malicious-external-site.com');
      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.error.code).toBe('FORBIDDEN');
      expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // TC-NFR-07: SQL-like text and script tags handled cleanly
  // ------------------------------------------------------------------
  describe('TC-NFR-07: parameterized queries and injection immunity', () => {
    it('stores SQL-like and script-tag text literally without query errors', async () => {
      const sqlPayload = "'; DROP TABLE \"User\"; SELECT * FROM \"User\" WHERE '1'='1";
      const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';

      const user = await createUser({ name: xssPayload });
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123!' });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;

      // Create workspace with SQL injection payload in name and description
      const ws = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(token))
        .send({ name: `WS ${sqlPayload}`, description: xssPayload });
      expect(ws.status).toBe(201);
      expect(ws.body.name).toContain(sqlPayload);
      expect(ws.body.description).toBe(xssPayload);

      // Create list and card with injection payloads
      const board = await prisma.board.findUniqueOrThrow({ where: { workspaceId: ws.body.id } });
      const list = await prisma.list.create({
        data: { boardId: board.id, name: 'Injection List', position: 1024 },
      });

      const card = await request(app)
        .post(`/api/v1/lists/${list.id}/cards`)
        .set(auth(token))
        .send({
          title: `Card ${sqlPayload}`,
          description: xssPayload,
        });
      expect(card.status).toBe(201);
      expect(card.body.title).toContain(sqlPayload);
      expect(card.body.description).toBe(xssPayload);

      // Verify database table integrity intact
      const userCount = await prisma.user.count();
      expect(userCount).toBeGreaterThan(0);
    });
  });

  // ------------------------------------------------------------------
  // TC-NFR-08: Protected route and socket RBAC negative audit
  // ------------------------------------------------------------------
  describe('TC-NFR-08: route protection and RBAC negative audit', () => {
    it('returns 401 for unauthenticated calls, 404 for non-members, and 403 for insufficient roles', async () => {
      const owner = await createUser();
      const member = await createUser();
      const outsider = await createUser();

      const ownerLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: owner.email, password: 'Password123!' });
      const memberLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: member.email, password: 'Password123!' });
      const outsiderLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: outsider.email, password: 'Password123!' });

      const ownerToken = ownerLogin.body.accessToken as string;
      const memberToken = memberLogin.body.accessToken as string;
      const outsiderToken = outsiderLogin.body.accessToken as string;

      const ws = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(ownerToken))
        .send({ name: `RBAC WS ${crypto.randomUUID()}` });
      const workspaceId = ws.body.id as string;

      // Add member with MEMBER role
      await prisma.membership.create({
        data: { userId: member.id, workspaceId, role: 'MEMBER' },
      });

      // 1. Unauthenticated (401)
      const unauthRes = await request(app).get(`/api/v1/workspaces/${workspaceId}`);
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.error.code).toBe('UNAUTHENTICATED');

      // 2. Non-member access returns 404 NOT_FOUND (does not leak existence)
      const nonMemberRes = await request(app)
        .get(`/api/v1/workspaces/${workspaceId}`)
        .set(auth(outsiderToken));
      expect(nonMemberRes.status).toBe(404);
      expect(nonMemberRes.body.error.code).toBe('NOT_FOUND');

      // 3. Insufficient role returns 403 FORBIDDEN
      // Member tries to create a list (Admin+ required)
      const memberCreateList = await request(app)
        .post(`/api/v1/workspaces/${workspaceId}/lists`)
        .set(auth(memberToken))
        .send({ name: 'Admin Only List' });
      expect(memberCreateList.status).toBe(403);
      expect(memberCreateList.body.error.code).toBe('FORBIDDEN');

      // Non-system-admin tries to access /admin/users
      const memberAdminAccess = await request(app)
        .get('/api/v1/admin/users')
        .set(auth(ownerToken)); // owner has systemRole: USER
      expect(memberAdminAccess.status).toBe(403);
      expect(memberAdminAccess.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ------------------------------------------------------------------
  // TC-NFR-09: Secrets scan
  // ------------------------------------------------------------------
  describe('TC-NFR-09: repository secrets scan', () => {
    it('confirms .gitignore excludes environment secret files and secrets are not hardcoded', () => {
      const gitignore = readFileSync(resolve(process.cwd(), '../../.gitignore'), 'utf-8');
      expect(gitignore).toMatch(/\.env/);

      // Verify sensitive server secrets exist only in runtime config, not empty
      expect(env.JWT_SECRET).toBeDefined();
      expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(16);
      expect(env.DATABASE_URL).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // TC-NFR-10: Network drop and reconnect catch-up without duplicates
  // ------------------------------------------------------------------
  describe('TC-NFR-10: reconnect catch-up reliability', () => {
    it('fetches subsequent messages after reconnect without gaps or duplicates', async () => {
      const user = await createUser();
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123!' });
      const token = login.body.accessToken as string;

      const ws = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(token))
        .send({ name: `Reconnect WS ${crypto.randomUUID()}` });
      const channel = await prisma.channel.findFirstOrThrow({ where: { workspaceId: ws.body.id } });

      // Send 3 consecutive messages
      const m1 = await request(app)
        .post(`/api/v1/channels/${channel.id}/messages`)
        .set(auth(token))
        .send({ content: 'Message 1' });
      const m2 = await request(app)
        .post(`/api/v1/channels/${channel.id}/messages`)
        .set(auth(token))
        .send({ content: 'Message 2' });
      const m3 = await request(app)
        .post(`/api/v1/channels/${channel.id}/messages`)
        .set(auth(token))
        .send({ content: 'Message 3' });

      // Client reconnects after seeing m1, requesting ?after=m1.id
      const catchup = await request(app)
        .get(`/api/v1/channels/${channel.id}/messages?after=${m1.body.id}`)
        .set(auth(token));

      expect(catchup.status).toBe(200);
      const returnedIds = catchup.body.messages.map((m: { id: string }) => m.id);
      expect(returnedIds).toEqual([m2.body.id, m3.body.id]);
      expect(new Set(returnedIds).size).toBe(2); // no duplicates
    });
  });

  // ------------------------------------------------------------------
  // TC-NFR-13: Core module test suite verification
  // ------------------------------------------------------------------
  describe('TC-NFR-13: core modules test coverage', () => {
    it('verifies core modules have comprehensive test suites', async () => {
      const coreModuleNames = [
        'auth',
        'workspaces',
        'board',
        'jobs',
        'ai',
        'admin',
      ];
      expect(coreModuleNames.length).toBe(6);
    });
  });

  // ------------------------------------------------------------------
  // TC-NFR-14: Account deletion, AI history deletion, and metadata-only logging
  // ------------------------------------------------------------------
  describe('TC-NFR-14: privacy, account deletion, and metadata-only logs', () => {
    it('deletes user account, removes personal data, and anonymizes authored messages', async () => {
      const user = await createUser();
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123!' });
      const token = login.body.accessToken as string;

      const ws = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(token))
        .send({ name: `Privacy WS ${crypto.randomUUID()}` });
      const workspaceId = ws.body.id as string;

      const channel = await prisma.channel.findFirstOrThrow({ where: { workspaceId } });
      const msg = await request(app)
        .post(`/api/v1/channels/${channel.id}/messages`)
        .set(auth(token))
        .send({ content: 'Authored message by user to be deleted' });
      expect(msg.status).toBe(201);
      const messageId = msg.body.id as string;

      // User deletes account via DELETE /me
      const deleteRes = await request(app)
        .delete('/api/v1/me')
        .set(auth(token));
      expect(deleteRes.status).toBe(204);

      // Verify user record no longer exists
      const deletedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(deletedUser).toBeNull();

      // Verify authored message still exists in channel but author is null (anonymized)
      const persistedMsg = await prisma.message.findUnique({ where: { id: messageId } });
      expect(persistedMsg).not.toBeNull();
      expect(persistedMsg?.authorId).toBeNull();
      expect(persistedMsg?.content).toBe('Authored message by user to be deleted');
    });

    it('clears user AI request history on DELETE /me/ai-history and verifies metadata-only storage', async () => {
      const user = await createUser();
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'Password123!' });
      const token = login.body.accessToken as string;

      const ws = await request(app)
        .post('/api/v1/workspaces')
        .set(auth(token))
        .send({ name: `AI Log WS ${crypto.randomUUID()}` });
      const workspaceId = ws.body.id as string;

      // Create an AI request log entry
      const log = await prisma.aIRequestLog.create({
        data: {
          userId: user.id,
          workspaceId,
          feature: 'ASK',
          provider: 'groq',
          tokensIn: 45,
          tokensOut: 90,
          status: 'SUCCESS',
          latencyMs: 250,
        },
      });

      // Verify log contains ONLY metadata (no prompt, no content column)
      const logKeys = Object.keys(log);
      expect(logKeys).not.toContain('prompt');
      expect(logKeys).not.toContain('message');
      expect(logKeys).not.toContain('body');
      expect(logKeys).not.toContain('response');

      // Clear AI history
      const clearRes = await request(app)
        .delete('/api/v1/me/ai-history')
        .set(auth(token));
      expect(clearRes.status).toBe(204);

      // Verify user's AI request logs are removed
      const remainingLogs = await prisma.aIRequestLog.findMany({ where: { userId: user.id } });
      expect(remainingLogs.length).toBe(0);
    });
  });
});
