import { z } from 'zod';
export const idParam = z.object({ id: z.string().uuid() });
export const pagination = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().optional() });
