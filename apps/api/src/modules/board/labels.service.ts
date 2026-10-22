import { createLabelBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';

export async function listWorkspaceLabels(workspaceId: string) {
  return prisma.label.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
}

export async function createLabel(workspaceId: string, input: unknown) {
  const data = createLabelBody.parse(input);
  return prisma.label.create({ data: { workspaceId, ...data } });
}
