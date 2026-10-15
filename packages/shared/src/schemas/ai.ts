import { z } from 'zod';
export const breakdownItem = z.object({ title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional() });
export const breakdownOutput = z.object({ items: z.array(breakdownItem).min(1).max(50), provider: z.string().min(1) });
export const breakdownBody = z.object({ description: z.string().trim().min(1).max(10000), listId: z.string().uuid() });
export const breakdownConfirmBody = z.object({ listId: z.string().uuid(), items: z.array(breakdownItem).min(1).max(50) });
