import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';

const USER_LIMIT_KEY = 'ai.userDailyLimit';
const WORKSPACE_LIMIT_KEY = 'ai.workspaceDailyLimit';

function configuredLimit(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function getAiLimits() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { in: [USER_LIMIT_KEY, WORKSPACE_LIMIT_KEY] } },
    select: { key: true, value: true },
  });
  const values = new Map(settings.map(({ key, value }) => [key, value]));
  return {
    userDailyLimit: configuredLimit(values.get(USER_LIMIT_KEY), env.AI_USER_DAILY_LIMIT),
    workspaceDailyLimit: configuredLimit(values.get(WORKSPACE_LIMIT_KEY), env.AI_WORKSPACE_DAILY_LIMIT),
  };
}

export function utcDayBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const resetAt = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, resetAt };
}

export async function enforceAiLimits(userId: string, workspaceId: string, now = new Date()) {
  const { start, resetAt } = utcDayBounds(now);
  const [{ userDailyLimit, workspaceDailyLimit }, userCount, workspaceCount] = await Promise.all([
    getAiLimits(),
    prisma.aIRequestLog.count({ where: { userId, createdAt: { gte: start } } }),
    prisma.aIRequestLog.count({ where: { workspaceId, createdAt: { gte: start } } }),
  ]);
  if (userCount >= userDailyLimit || workspaceCount >= workspaceDailyLimit) {
    throw new AppError(429, 'AI_LIMIT_REACHED', 'Daily AI request limit reached', { resetAt: resetAt.toISOString() });
  }
}
