import { z } from 'zod';
export const registerBody = z.object({ name: z.string().trim().min(1).max(80), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(8).max(128) });
export const loginBody = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) });
export const patchProfileBody = z.object({ name: z.string().trim().min(1).max(80).optional(), bio: z.string().max(500).nullable().optional(), avatarUrl: z.string().url().nullable().optional() }).refine((value) => Object.keys(value).length > 0);
