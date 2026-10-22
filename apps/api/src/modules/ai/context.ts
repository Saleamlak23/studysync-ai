import { createRequire } from 'node:module';
import type { z } from 'zod';
import type { aiContextItem } from '@studysync/shared';
import { env } from '../../config/env.js';
import { AppError, Errors } from '../../lib/errors.js';
import { prisma } from '../../db/prisma.js';

const require = createRequire(import.meta.url);
const mammoth = require('mammoth') as {
  extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
};
const parsePdf = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<{ text: string }>;

export const AI_CONTEXT_CHAR_LIMIT = 12_000;
type ContextItem = z.infer<typeof aiContextItem>;

function sanitizeDelimiter(text: string) {
  return text.replace(/<\/user_content>/gi, '< /user_content>');
}

function orderedBefore(a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }) {
  return a.createdAt.getTime() < b.createdAt.getTime()
    || (a.createdAt.getTime() === b.createdAt.getTime() && a.id <= b.id);
}

async function extractFileText(mimeType: string, data: Uint8Array, sizeBytes: number) {
  if (sizeBytes > env.FILE_MAX_BYTES) throw new AppError(413, 'FILE_TOO_LARGE', 'File is too large to summarize');
  const buffer = Buffer.from(data);
  try {
    if (mimeType === 'text/plain') return buffer.toString('utf8');
    if (mimeType === 'application/pdf') return (await parsePdf(buffer)).text;
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return (await mammoth.extractRawText({ buffer })).value;
    }
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', 'File text could not be extracted');
  }
  throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'This file type cannot be summarized');
}

async function loadFileText(workspaceId: string, fileId: string) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, workspaceId },
    select: { id: true, name: true, mimeType: true, sizeBytes: true, blob: { select: { data: true } } },
  });
  if (!file) throw Errors.notFound('Context item');
  if (!file.blob) throw Errors.notFound('File content');
  const text = await extractFileText(file.mimeType, file.blob.data, file.sizeBytes);
  return `File: ${file.name}\n${text}`;
}

async function loadCardText(workspaceId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, list: { board: { workspaceId } } },
    select: {
      title: true,
      description: true,
      priority: true,
      dueDate: true,
      comments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { body: true } },
    },
  });
  if (!card) throw Errors.notFound('Context item');
  const comments = card.comments.map(({ body }) => body);
  return [
    `Card: ${card.title}`,
    card.description ? `Description: ${card.description}` : '',
    `Priority: ${card.priority}`,
    card.dueDate ? `Due date: ${card.dueDate.toISOString()}` : '',
    comments.length ? `Comments:\n${comments.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

async function loadMessageRangeText(workspaceId: string, channelId: string, fromId: string, toId: string) {
  const channel = await prisma.channel.findFirst({ where: { id: channelId, workspaceId }, select: { id: true } });
  if (!channel) throw Errors.notFound('Context item');

  const [from, to] = await Promise.all([
    prisma.message.findFirst({ where: { id: fromId, channelId, deletedAt: null }, select: { id: true, createdAt: true } }),
    prisma.message.findFirst({ where: { id: toId, channelId, deletedAt: null }, select: { id: true, createdAt: true } }),
  ]);
  if (!from || !to) throw Errors.notFound('Context item');
  if (!orderedBefore(from, to)) {
    throw Errors.validation({ field: 'target', message: 'Message range must start before it ends' });
  }

  const rows = await prisma.message.findMany({
    where: { channelId, deletedAt: null, createdAt: { gte: from.createdAt, lte: to.createdAt } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, createdAt: true, content: true, author: { select: { name: true } } },
  });
  const selected = rows.filter((row) => orderedBefore(from, row) && orderedBefore(row, to));
  return `Chat messages:\n${selected.map((row) => `${row.author?.name ?? 'Deleted user'}: ${row.content}`).join('\n')}`;
}

export async function loadContextItem(workspaceId: string, item: ContextItem) {
  switch (item.type) {
    case 'card': return loadCardText(workspaceId, item.id);
    case 'file': return loadFileText(workspaceId, item.id);
    case 'message_range': return loadMessageRangeText(workspaceId, item.channelId, item.fromId, item.toId);
  }
}

export async function buildSelectedContext(workspaceId: string, items: ContextItem[]) {
  const content = (await Promise.all(items.map((item) => loadContextItem(workspaceId, item)))).join('\n\n');
  const safeContent = sanitizeDelimiter(content);
  const truncated = safeContent.length > AI_CONTEXT_CHAR_LIMIT;
  return {
    text: truncated ? `${safeContent.slice(0, AI_CONTEXT_CHAR_LIMIT)}\n[Selected content truncated]` : safeContent,
    truncated,
  };
}

export function safeJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function wrapUntrusted(text: string) {
  return `<user_content>\n${sanitizeDelimiter(text)}\n</user_content>`;
}

