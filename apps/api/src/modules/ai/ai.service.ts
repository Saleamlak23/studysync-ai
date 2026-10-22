import type { AIFeature } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../lib/errors.js';
import { enforceAiLimits } from './limits.service.js';
import { routeAIRequest } from './providers/router.js';
import type { AIProvider } from './providers/types.js';

export type AIRequestInput = {
  userId: string;
  workspaceId: string;
  feature: AIFeature;
  prompt: string;
};

export async function assertAiConsent(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { aiEnabled: true },
  });
  if (!workspace?.aiEnabled) throw new AppError(403, 'AI_DISABLED', 'AI consent is not enabled for this workspace');
}

export async function executeAIRequest(
  input: AIRequestInput,
  providers?: { primary?: AIProvider; fallback?: AIProvider },
) {
  const startedAt = Date.now();
  let provider = 'none';
  let tokensIn = 0;
  let tokensOut = 0;
  let status: 'SUCCESS' | 'ERROR' = 'ERROR';
  try {
    await assertAiConsent(input.workspaceId);
    await enforceAiLimits(input.userId, input.workspaceId);
    const completion = await routeAIRequest(input.prompt, providers);
    provider = completion.provider;
    tokensIn = completion.tokensIn;
    tokensOut = completion.tokensOut;
    status = 'SUCCESS';
    return completion;
  } catch (error) {
    if (error instanceof AppError && error.code === 'AI_LIMIT_REACHED') provider = 'none';
    throw error;
  } finally {
    await prisma.aIRequestLog.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        feature: input.feature,
        provider,
        tokensIn,
        tokensOut,
        status,
        latencyMs: Date.now() - startedAt,
      },
    });
  }
}
