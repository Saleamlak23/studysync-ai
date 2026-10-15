import { z } from 'zod';
export const moveCardBody = z.object({ toListId: z.string().uuid(), afterCardId: z.string().uuid().optional() });
