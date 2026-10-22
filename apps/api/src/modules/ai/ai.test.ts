import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../lib/errors.js';
import { env } from '../../config/env.js';
import { createApp } from '../../app.js';
import { createUser } from '../../tests/factories.js';
import { executeAIRequest } from './ai.service.js';
import { getAiLimits, utcDayBounds } from './limits.service.js';
import { routeAIRequest } from './providers/router.js';
import { MockAIProvider } from '../../tests/mocks/aiProvider.js';

const app = createApp();
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createAiFixture() {
  const user = await createUser();
  const registered = await request(app).post('/api/v1/auth/login').send({
    email: user.email,
    password: 'Password123!',
  });
  expect(registered.status).toBe(200);
  const workspaceResponse = await request(app)
    .post('/api/v1/workspaces')
    .set(auth(registered.body.accessToken as string))
    .send({ name: `AI workspace ${crypto.randomUUID()}` });
  expect(workspaceResponse.status).toBe(201);
  return {
    userId: user.id,
    workspaceId: workspaceResponse.body.id as string,
    token: registered.body.accessToken as string,
  };
}

const requestInput = (userId: string, workspaceId: string) => ({
  userId,
  workspaceId,
  feature: 'ASK' as const,
  prompt: 'Private prompt content that must not be logged',
});

describe('AI provider and request services', () => {
  beforeEach(async () => {
    await prisma.appSetting.deleteMany({ where: { key: { in: ['ai.userDailyLimit', 'ai.workspaceDailyLimit'] } } });
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('TC-AI-05: retries the primary once, falls back, and reports unavailable when both providers fail', async () => {
    const primary = new MockAIProvider('groq', 'error');
    const fallback = new MockAIProvider('gemini');
    const routed = await routeAIRequest('hello', { primary, fallback }, 20);
    expect(routed).toMatchObject({ provider: 'gemini', text: 'Mock response' });
    expect(primary.calls).toBe(2);
    expect(fallback.calls).toBe(1);

    const failingPrimary = new MockAIProvider('groq', 'timeout');
    const failingFallback = new MockAIProvider('gemini', 'error');
    await expect(routeAIRequest('hello', { primary: failingPrimary, fallback: failingFallback }, 5))
      .rejects.toMatchObject({ status: 502, code: 'AI_UNAVAILABLE' });
    expect(failingPrimary.calls).toBe(2);
    expect(failingFallback.calls).toBe(1);
  });

  it('TC-AI-06: blocks disabled workspace consent before a provider call and permits enabled consent', async () => {
    const { userId, workspaceId } = await createAiFixture();
    const primary = new MockAIProvider('groq');
    const fallback = new MockAIProvider('gemini');

    await expect(executeAIRequest(requestInput(userId, workspaceId), { primary, fallback }))
      .rejects.toMatchObject({ status: 403, code: 'AI_DISABLED' });
    expect(primary.calls).toBe(0);
    expect(fallback.calls).toBe(0);
    const deniedLog = await prisma.aIRequestLog.findFirstOrThrow({ where: { userId, workspaceId } });
    expect(deniedLog).toMatchObject({ provider: 'none', status: 'ERROR' });

    await prisma.workspace.update({ where: { id: workspaceId }, data: { aiEnabled: true } });
    const result = await executeAIRequest(requestInput(userId, workspaceId), { primary, fallback });
    expect(result.provider).toBe('groq');
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(0);
  });

  it('TC-AI-07: enforces user and workspace limits, honors AppSetting, and stores metadata only', async () => {
    const owner = await createAiFixture();
    const secondUser = await createUser();
    await prisma.membership.create({
      data: { userId: secondUser.id, workspaceId: owner.workspaceId, role: 'MEMBER' },
    });
    await prisma.workspace.update({ where: { id: owner.workspaceId }, data: { aiEnabled: true } });
    await prisma.appSetting.createMany({ data: [
      { key: 'ai.userDailyLimit', value: 1 },
      { key: 'ai.workspaceDailyLimit', value: 5 },
    ] });
    await prisma.aIRequestLog.create({
      data: { userId: owner.userId, workspaceId: owner.workspaceId, feature: 'ASK', provider: 'groq', status: 'SUCCESS', latencyMs: 1 },
    });
    const limitProvider = new MockAIProvider('groq');
    const userLimitError = await executeAIRequest(requestInput(owner.userId, owner.workspaceId), { primary: limitProvider })
      .catch((error: unknown) => error);
    expect(userLimitError).toBeInstanceOf(AppError);
    expect(userLimitError).toMatchObject({ status: 429, code: 'AI_LIMIT_REACHED', details: { resetAt: expect.any(String) } });
    expect(limitProvider.calls).toBe(0);

    await prisma.appSetting.update({ where: { key: 'ai.userDailyLimit' }, data: { value: 10 } });
    await prisma.appSetting.update({ where: { key: 'ai.workspaceDailyLimit' }, data: { value: 1 } });
    const workspaceLimitError = await executeAIRequest(requestInput(secondUser.id, owner.workspaceId), { primary: limitProvider })
      .catch((error: unknown) => error);
    expect(workspaceLimitError).toMatchObject({ status: 429, code: 'AI_LIMIT_REACHED' });
    expect(limitProvider.calls).toBe(0);

    await prisma.appSetting.update({ where: { key: 'ai.workspaceDailyLimit' }, data: { value: 10 } });
    const allowed = await executeAIRequest(requestInput(secondUser.id, owner.workspaceId), { primary: limitProvider });
    expect(allowed.provider).toBe('groq');
    expect(limitProvider.calls).toBe(1);
    const logs = await prisma.aIRequestLog.findMany({
      where: { workspaceId: owner.workspaceId },
      select: { userId: true, workspaceId: true, feature: true, provider: true, tokensIn: true, tokensOut: true, status: true, latencyMs: true, createdAt: true },
    });
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs[0]).not.toHaveProperty('prompt');
    expect(logs[0]).not.toHaveProperty('content');
  });

  it('TC-AI-07: uses configured defaults and resets daily quotas at UTC midnight', async () => {
    expect(await getAiLimits()).toEqual({
      userDailyLimit: env.AI_USER_DAILY_LIMIT,
      workspaceDailyLimit: env.AI_WORKSPACE_DAILY_LIMIT,
    });
    expect(utcDayBounds(new Date('2026-10-22T14:30:00.000Z'))).toEqual({
      start: new Date('2026-10-22T00:00:00.000Z'),
      resetAt: new Date('2026-10-23T00:00:00.000Z'),
    });
  });
});
