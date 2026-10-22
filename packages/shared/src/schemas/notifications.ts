import { z } from 'zod';

const id = z.string().uuid();

export const notificationIdParams = z.object({ id });

export const listNotificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: id.optional(),
  unread: z.preprocess(
    (value) => value === 'true' ? true : value === 'false' ? false : value,
    z.boolean().optional(),
  ),
});

export const notificationSchema = z.object({
  id,
  type: z.enum(['ASSIGNED', 'MENTION', 'DEADLINE']),
  workspaceId: id,
  payload: z.record(z.string(), z.unknown()),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof notificationSchema>;
