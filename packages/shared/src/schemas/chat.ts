import { z } from 'zod';

const id = z.string().uuid();
const userSummary = z.object({ id, name: z.string(), avatarUrl: z.string().nullable() });
const uniqueIds = z.array(id).refine((values) => new Set(values).size === values.length);

export const channelIdParams = z.object({ id });
export const createChannelBody = z.object({ name: z.string().trim().min(1) });
export const createMessageBody = z.object({
  content: z.string().trim().min(1),
  fileId: id.optional(),
  mentionIds: uniqueIds.optional(),
});
export const listMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: id.optional(),
  after: id.optional(),
}).refine((query) => !(query.before && query.after), {
  message: 'Use either before or after, not both',
});
export const channelRoomPayload = z.object({ channelId: id });

export const channelSchema = z.object({
  id,
  workspaceId: id,
  name: z.string(),
  createdAt: z.string().datetime(),
});

export const messageSchema = z.object({
  id,
  channelId: id,
  author: userSummary.nullable(),
  content: z.string(),
  file: z.object({
    id,
    name: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    uploader: userSummary.nullable(),
    createdAt: z.string().datetime(),
  }).nullable(),
  createdAt: z.string().datetime(),
});

export const messagesPageSchema = z.object({
  messages: z.array(messageSchema),
  nextCursor: id.nullable(),
});

export type Channel = z.infer<typeof channelSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessagesPage = z.infer<typeof messagesPageSchema>;
