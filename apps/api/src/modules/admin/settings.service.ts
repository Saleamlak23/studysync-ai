import { Prisma, type AIFeature } from '@prisma/client';
import {
  aiUsageResponseSchema,
  type AdminAiUsageQuery,
  type AiUsageRow,
  type UpdateAiLimitsBody,
} from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

const USER_LIMIT_KEY = 'ai.userDailyLimit';
const WORKSPACE_LIMIT_KEY = 'ai.workspaceDailyLimit';

function parseConfiguredLimit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function getAiUsage(query: AdminAiUsageQuery) {
  const where: Prisma.AIRequestLogWhereInput = {};

  if (query.userId) {
    where.userId = query.userId;
  }
  if (query.workspaceId) {
    where.workspaceId = query.workspaceId;
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = new Date(query.from);
    }
    if (query.to) {
      where.createdAt.lte = new Date(query.to);
    }
  }

  const logs = await prisma.aIRequestLog.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      workspace: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  let totalRequests = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;

  const groupMap = new Map<string, AiUsageRow>();

  for (const log of logs) {
    totalRequests += 1;
    totalTokensIn += log.tokensIn;
    totalTokensOut += log.tokensOut;

    const groupKey = `${log.userId ?? ''}:${log.workspaceId}:${log.feature}:${log.provider}`;
    let row = groupMap.get(groupKey);
    if (!row) {
      row = {
        userId: log.userId,
        userName: log.user?.name ?? null,
        workspaceId: log.workspaceId,
        workspaceName: log.workspace?.name ?? 'Unknown',
        feature: log.feature as AIFeature,
        provider: log.provider,
        requests: 0,
        tokensIn: 0,
        tokensOut: 0,
      };
      groupMap.set(groupKey, row);
    }
    row.requests += 1;
    row.tokensIn += log.tokensIn;
    row.tokensOut += log.tokensOut;
  }

  return aiUsageResponseSchema.parse({
    totals: {
      requests: totalRequests,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
    },
    rows: Array.from(groupMap.values()),
  });
}

export async function getAdminAiLimits() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: [USER_LIMIT_KEY, WORKSPACE_LIMIT_KEY] } },
    select: { key: true, value: true, updatedAt: true },
  });

  const values = new Map(settings.map((s) => [s.key, s.value]));
  let latestUpdate: Date | null = null;
  for (const s of settings) {
    if (!latestUpdate || s.updatedAt > latestUpdate) {
      latestUpdate = s.updatedAt;
    }
  }

  return {
    userDailyLimit: parseConfiguredLimit(values.get(USER_LIMIT_KEY), env.AI_USER_DAILY_LIMIT),
    workspaceDailyLimit: parseConfiguredLimit(values.get(WORKSPACE_LIMIT_KEY), env.AI_WORKSPACE_DAILY_LIMIT),
    updatedAt: latestUpdate ? latestUpdate.toISOString() : null,
  };
}

export async function updateAdminAiLimits(adminUserId: string, body: UpdateAiLimitsBody) {
  const [userSetting, workspaceSetting] = await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: USER_LIMIT_KEY },
      update: { value: body.userDailyLimit, updatedById: adminUserId },
      create: { key: USER_LIMIT_KEY, value: body.userDailyLimit, updatedById: adminUserId },
      select: { updatedAt: true },
    }),
    prisma.appSetting.upsert({
      where: { key: WORKSPACE_LIMIT_KEY },
      update: { value: body.workspaceDailyLimit, updatedById: adminUserId },
      create: { key: WORKSPACE_LIMIT_KEY, value: body.workspaceDailyLimit, updatedById: adminUserId },
      select: { updatedAt: true },
    }),
  ]);

  const latestUpdate =
    userSetting.updatedAt > workspaceSetting.updatedAt ? userSetting.updatedAt : workspaceSetting.updatedAt;

  return {
    userDailyLimit: body.userDailyLimit,
    workspaceDailyLimit: body.workspaceDailyLimit,
    updatedAt: latestUpdate.toISOString(),
  };
}
