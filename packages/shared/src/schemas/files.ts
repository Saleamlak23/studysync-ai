import { z } from 'zod';

export const workspaceFileSummarySchema = z.object({
  fileCount: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  limitBytes: z.number().int().nonnegative(),
});

export type WorkspaceFileSummary = z.infer<typeof workspaceFileSummarySchema>;
