import { z } from 'zod';
const id = z.string().uuid();

export const aiContextItem = z.discriminatedUnion('type', [
  z.object({ type: z.literal('card'), id }),
  z.object({ type: z.literal('file'), id }),
  z.object({ type: z.literal('message_range'), channelId: id, fromId: id, toId: id }),
]);

export const aiConversationMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

export const aiAskBody = z.object({
  question: z.string().trim().min(1).max(10_000),
  context: z.array(aiContextItem).min(1),
  history: z.array(aiConversationMessage).max(10).optional(),
});

export const aiSummarizeBody = z.object({
  target: aiContextItem,
});

export const breakdownItem = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().datetime().optional(),
});

export const breakdownItemsOutput = z.object({ items: z.array(breakdownItem).min(3).max(8) });
export const breakdownOutput = breakdownItemsOutput.extend({ provider: z.string().min(1) });
export const breakdownBody = z.object({ description: z.string().trim().min(1).max(10000), listId: z.string().uuid() });
export const breakdownConfirmBody = z.object({ listId: z.string().uuid(), items: z.array(breakdownItem).min(1).max(50) });
