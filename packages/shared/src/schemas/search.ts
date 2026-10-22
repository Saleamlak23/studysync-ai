import { z } from 'zod';

export const searchQuery = z.object({
  q: z.string().trim().min(2),
  type: z.enum(['cards', 'messages', 'files']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const searchResult = z.object({
  cards: z.array(z.object({ id: z.string().uuid(), title: z.string(), snippet: z.string() })),
  messages: z.array(z.object({ id: z.string().uuid(), snippet: z.string() })),
  files: z.array(z.object({ id: z.string().uuid(), name: z.string() })),
});

export type SearchQuery = z.infer<typeof searchQuery>;
export type SearchResult = z.infer<typeof searchResult>;
