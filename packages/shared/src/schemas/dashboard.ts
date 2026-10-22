import { z } from 'zod';

const id = z.string().uuid();
const nullableDate = z.string().datetime().nullable();

export const dashboardCardSchema = z.object({
  id,
  listId: id,
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  dueDate: nullableDate,
  position: z.number(),
  createdById: id.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  assignees: z.array(z.object({
    userId: id,
    user: z.object({ id, name: z.string(), email: z.string().email(), avatarUrl: z.string().nullable() }),
  })),
  labels: z.array(z.object({ cardId: id, labelId: id, label: z.object({ id, workspaceId: id, name: z.string(), color: z.string() }) })),
  list: z.object({ id, name: z.string() }),
  workspace: z.object({ id, name: z.string() }),
});

export const personalDashboardSchema = z.object({
  assignedCards: z.array(dashboardCardSchema),
  upcomingDeadlines: z.array(dashboardCardSchema),
});

export type DashboardCard = z.infer<typeof dashboardCardSchema>;
export type PersonalDashboard = z.infer<typeof personalDashboardSchema>;
