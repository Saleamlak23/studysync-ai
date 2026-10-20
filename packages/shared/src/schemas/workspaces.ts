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
