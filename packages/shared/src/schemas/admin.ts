import { z } from 'zod';

const id = z.string().uuid();

export const adminUsersQuery = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  cursor: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const patchUserStatusBody = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export const adminAiUsageQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  userId: id.optional(),
  workspaceId: id.optional(),
});

export const aiUsageTotalsSchema = z.object({
  requests: z.number().int().nonnegative(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
});

export const aiUsageRowSchema = z.object({
  userId: id.nullable(),
  userName: z.string().nullable(),
  workspaceId: id,
  workspaceName: z.string(),
  feature: z.enum(['ASK', 'SUMMARIZE', 'BREAKDOWN']),
  provider: z.string(),
  requests: z.number().int().nonnegative(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
});

export const aiUsageResponseSchema = z.object({
  totals: aiUsageTotalsSchema,
  rows: z.array(aiUsageRowSchema),
});

export const aiLimitsResponseSchema = z.object({
  userDailyLimit: z.number().int().positive(),
  workspaceDailyLimit: z.number().int().positive(),
  updatedAt: z.string().datetime().nullable(),
});

export const updateAiLimitsBody = z.object({
  userDailyLimit: z.number().int().positive(),
  workspaceDailyLimit: z.number().int().positive(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuery>;
export type PatchUserStatusBody = z.infer<typeof patchUserStatusBody>;
export type AdminAiUsageQuery = z.infer<typeof adminAiUsageQuery>;
export type AiUsageTotals = z.infer<typeof aiUsageTotalsSchema>;
export type AiUsageRow = z.infer<typeof aiUsageRowSchema>;
export type AiUsageResponse = z.infer<typeof aiUsageResponseSchema>;
export type AiLimitsResponse = z.infer<typeof aiLimitsResponseSchema>;
export type UpdateAiLimitsBody = z.infer<typeof updateAiLimitsBody>;
