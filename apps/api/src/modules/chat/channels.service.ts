import { createChannelBody } from '@studysync/shared';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../lib/errors.js';

export async function getChannelWorkspaceId(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true },
  });
  if (!channel) throw Errors.notFound('Channel');
  return channel.workspaceId;
}

export function listChannels(workspaceId: string) {
  return prisma.channel.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

export async function createChannel(workspaceId: string, input: unknown) {
  const data = createChannelBody.parse(input);
  return prisma.channel.create({ data: { workspaceId, name: data.name } });
}

export async function deleteChannel(channelId: string) {
  await prisma.channel.delete({ where: { id: channelId } });
}
