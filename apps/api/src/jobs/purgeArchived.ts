import { prisma } from '../db/prisma.js';

const RECOVERY_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeArchived(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - RECOVERY_PERIOD_MS);
  await prisma.workspace.deleteMany({ where: { archivedAt: { lt: cutoff } } });
}
