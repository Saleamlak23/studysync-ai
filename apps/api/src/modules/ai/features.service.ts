import { Prisma, type AIFeature } from '@prisma/client';
import { breakdownItemsOutput, breakdownItem, type aiContextItem } from '@studysync/shared';
import type { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Errors, AppError } from '../../lib/errors.js';
import { between } from '../../lib/ordering.js';
import { emitToBoard } from '../../realtime/emit.js';
import { isIoInitialized } from '../../realtime/io.js';
import { buildSelectedContext, safeJson, wrapUntrusted } from './context.js';
import { askPrompt, breakdownPrompt, repairBreakdownPrompt, summarizePrompt } from './prompts.js';
import { assertAiConsent, executeAIRequest } from './ai.service.js';
import { enforceAiLimits } from './limits.service.js';
import type { AIProvider } from './providers/types.js';

type ContextItem = z.infer<typeof aiContextItem>;
type BreakdownItem = z.infer<typeof breakdownItem>;
type ProviderSet = { primary?: AIProvider; fallback?: AIProvider };

const DEFAULT_TEXT_NOTE = '\n\n[Some selected content was omitted because it exceeded the context limit.]';

function validatedText(text: string) {
  return text.trim().length > 0;
}

async function prepareAiRequest(userId: string, workspaceId: string) {
  await assertAiConsent(workspaceId);
  await enforceAiLimits(userId, workspaceId);
}

function withTruncationNote(text: string, truncated: boolean) {
  return `${text.trim()}${truncated ? DEFAULT_TEXT_NOTE : ''}`;
}

async function ensureListInWorkspace(workspaceId: string, listId: string) {
  const list = await prisma.list.findFirst({ where: { id: listId, board: { workspaceId } }, select: { id: true } });
  if (!list) throw Errors.notFound('List');
}

export async function askAI(
  userId: string,
  workspaceId: string,
  input: { question: string; context: ContextItem[]; history?: Array<{ role: 'user' | 'assistant'; content: string }> },
  providers?: ProviderSet,
) {
  await prepareAiRequest(userId, workspaceId);
  const context = await buildSelectedContext(workspaceId, input.context);
  const completion = await executeAIRequest({
    userId,
    workspaceId,
    feature: 'ASK' satisfies AIFeature,
    prompt: askPrompt(input.question, context.text, input.history),
    validateOutput: validatedText,
    repairPrompt: (text) => `${askPrompt(input.question, context.text, input.history)}\nThe previous answer was empty. Provide a useful answer. Previous output: ${wrapUntrusted(text)}`,
  }, providers);
  return { answer: withTruncationNote(completion.text, context.truncated), provider: completion.provider };
}

export async function summarizeAI(
  userId: string,
  workspaceId: string,
  target: ContextItem,
  providers?: ProviderSet,
) {
  await prepareAiRequest(userId, workspaceId);
  const context = await buildSelectedContext(workspaceId, [target]);
  const completion = await executeAIRequest({
    userId,
    workspaceId,
    feature: 'SUMMARIZE' satisfies AIFeature,
    prompt: summarizePrompt(context.text),
    validateOutput: validatedText,
    repairPrompt: (text) => `${summarizePrompt(context.text)}\nThe previous summary was empty. Provide a concise summary. Previous output: ${wrapUntrusted(text)}`,
  }, providers);
  return { summary: withTruncationNote(completion.text, context.truncated), provider: completion.provider };
}

export async function previewBreakdown(
  userId: string,
  workspaceId: string,
  input: { description: string; listId: string },
  providers?: ProviderSet,
) {
  await prepareAiRequest(userId, workspaceId);
  await ensureListInWorkspace(workspaceId, input.listId);
  const prompt = breakdownPrompt(input.description);
  const completion = await executeAIRequest({
    userId,
    workspaceId,
    feature: 'BREAKDOWN' satisfies AIFeature,
    prompt,
    validateOutput: (text) => breakdownItemsOutput.safeParse(safeJson(text)).success,
    repairPrompt: repairBreakdownPrompt,
  }, providers);
  const parsed = breakdownItemsOutput.safeParse(safeJson(completion.text));
  if (!parsed.success) throw new AppError(502, 'AI_BAD_OUTPUT', 'The AI returned an unusable answer');
  return { items: parsed.data.items, provider: completion.provider };
}

const cardRelations = {
  assignees: { select: { userId: true, user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
  labels: { include: { label: true } },
};

export async function confirmBreakdown(
  workspaceId: string,
  userId: string,
  input: { listId: string; items: BreakdownItem[] },
) {
  await assertAiConsent(workspaceId);
  const result = await prisma.$transaction(async (tx) => {
    const list = await tx.list.findFirst({
      where: { id: input.listId, board: { workspaceId } },
      select: { id: true, board: { select: { id: true } } },
    });
    if (!list) throw Errors.notFound('List');

    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Board" WHERE "id" = ${list.board.id} FOR UPDATE`);
    const last = await tx.card.findFirst({ where: { listId: list.id }, orderBy: { position: 'desc' }, select: { position: true } });
    let position = last?.position ?? null;
    const cards = [];
    for (const item of input.items) {
      position = between(position, null)!;
      cards.push(await tx.card.create({
        data: {
          listId: list.id,
          title: item.title,
          description: item.description,
          priority: item.priority,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          position,
          createdById: userId,
        },
        include: cardRelations,
      }));
    }
    return { cards, boardWorkspaceId: workspaceId };
  });

  if (isIoInitialized()) {
    for (const card of result.cards) emitToBoard(result.boardWorkspaceId, 'board:card_created', card);
  }
  return result.cards;
}
