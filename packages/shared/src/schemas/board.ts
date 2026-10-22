import { z } from 'zod';
export const moveCardBody = z.object({ toListId: z.string().uuid(), afterCardId: z.string().uuid().optional() });

const id = z.string().uuid();
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const uniqueIds = z.array(id).refine((values) => new Set(values).size === values.length);

export const listIdParams = z.object({ id });
export const cardIdParams = z.object({ id });

export const createListBody = z.object({ name: z.string().trim().min(1) });
export const patchListBody = createListBody;
export const moveListBody = z.object({ afterListId: id.optional() });

export const createCardBody = z.object({
  title: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  priority: priority.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeIds: uniqueIds.optional(),
  labelIds: uniqueIds.optional(),
});

export const commentIdParams = z.object({ id });
export const createCommentBody = z.object({
  body: z.string().trim().min(1),
  mentionIds: uniqueIds.optional(),
});
export const createLabelBody = z.object({
  name: z.string().trim().min(1),
  color: z.string().trim().min(1),
});

export const patchCardBody = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  priority: priority.optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeIds: uniqueIds.optional(),
  labelIds: uniqueIds.optional(),
}).refine((value) => Object.keys(value).length > 0);
