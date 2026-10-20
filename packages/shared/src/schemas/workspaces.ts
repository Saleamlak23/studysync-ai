import { z } from 'zod';

export const createWorkspaceBody = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().optional(),
});

export const patchWorkspaceBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const setWorkspaceAiConsentBody = z.object({ enabled: z.boolean() });

export const workspaceIdParams = z.object({ id: z.string().uuid() });

export const workspaceMemberParams = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
});

export const inviteIdParams = z.object({
  id: z.string().uuid(),
  inviteId: z.string().uuid(),
});

export const inviteCodeParams = z.object({ code: z.string().min(1).max(128) });

export const updateMemberRoleBody = z.object({ role: z.enum(['ADMIN', 'MEMBER']) });

export const createInviteBody = z.object({
  expiresAt: z.string().datetime().optional(),
}).refine((value) => !value.expiresAt || new Date(value.expiresAt).getTime() > Date.now());
