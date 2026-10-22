import { PrismaClient, type WorkspaceRole } from '@prisma/client';
import { hashPassword } from '../apps/api/src/lib/password.js';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123!';

async function ensureUser(input: {
  name: string;
  email: string;
  systemRole?: 'USER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED';
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) return existing;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return prisma.user.create({ data: { ...input, passwordHash } });
}

async function ensureWorkspace(name: string, ownerId: string, description?: string) {
  const existing = await prisma.workspace.findFirst({
    where: { name, memberships: { some: { userId: ownerId, role: 'OWNER' } } },
  });
  if (existing) return existing;
  return prisma.workspace.create({
    data: {
      name,
      description,
      memberships: { create: { userId: ownerId, role: 'OWNER' } },
    },
  });
}

async function ensureMembership(userId: string, workspaceId: string, role: WorkspaceRole) {
  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (existing) return existing;
  return prisma.membership.create({ data: { userId, workspaceId, role } });
}

async function ensureBoardLists(workspaceId: string, names: string[]) {
  const board = await prisma.board.upsert({
    where: { workspaceId },
    update: {},
    create: { workspaceId },
  });
  const lists = [];
  for (const [index, name] of names.entries()) {
    const existing = await prisma.list.findFirst({ where: { boardId: board.id, name } });
    lists.push(existing ?? await prisma.list.create({
      data: { boardId: board.id, name, position: (index + 1) * 1024 },
    }));
  }
  return lists;
}

async function ensureChannel(workspaceId: string) {
  return prisma.channel.upsert({
    where: { workspaceId_name: { workspaceId, name: 'general' } },
    update: {},
    create: { workspaceId, name: 'general' },
  });
}

async function ensureCard(listId: string, title: string, position: number, createdById: string) {
  const existing = await prisma.card.findFirst({ where: { listId, title } });
  if (existing) return existing;
  return prisma.card.create({ data: { listId, title, position, createdById } });
}

async function ensureMessage(channelId: string, authorId: string, content: string) {
  const existing = await prisma.message.findFirst({ where: { channelId, authorId, content } });
  if (existing) return existing;
  return prisma.message.create({ data: { channelId, authorId, content } });
}

async function seedLargeWorkspace(ownerId: string) {
  const workspace = await ensureWorkspace('Large Demo Workspace', ownerId);
  const [list] = await ensureBoardLists(workspace.id, ['Backlog']);
  const channel = await ensureChannel(workspace.id);

  const existingCards = await prisma.card.findMany({
    where: { listId: list!.id, title: { startsWith: 'Demo task ' } },
    select: { title: true },
  });
  const cardTitles = new Set(existingCards.map(({ title }) => title));
  await prisma.card.createMany({
    data: Array.from({ length: 500 }, (_, index) => ({
      listId: list!.id,
      title: `Demo task ${index + 1}`,
      position: (index + 1) * 1024,
      createdById: ownerId,
    })).filter(({ title }) => !cardTitles.has(title)),
  });

  const existingMessages = await prisma.message.findMany({
    where: { channelId: channel.id, content: { startsWith: 'Demo message ' } },
    select: { content: true },
  });
  const messageContents = new Set(existingMessages.map(({ content }) => content));
  await prisma.message.createMany({
    data: Array.from({ length: 5000 }, (_, index) => ({
      channelId: channel.id,
      authorId: ownerId,
      content: `Demo message ${index + 1}`,
    })).filter(({ content }) => !messageContents.has(content)),
  });
}

async function main() {
  const [sysAdmin, owner, admin, member] = await Promise.all([
    ensureUser({ name: 'System Admin', email: 'sysadmin@studysync.test', systemRole: 'ADMIN' }),
    ensureUser({ name: 'Workspace Owner', email: 'owner@studysync.test' }),
    ensureUser({ name: 'Workspace Admin', email: 'admin@studysync.test' }),
    ensureUser({ name: 'Workspace Member', email: 'member@studysync.test' }),
  ]);
  await Promise.all([
    ensureUser({ name: 'Non Member', email: 'nonmember@studysync.test' }),
    ensureUser({ name: 'Suspended User', email: 'suspended@studysync.test', status: 'SUSPENDED' }),
  ]);

  const workspace = await ensureWorkspace('Study Group', owner.id, 'Sample collaborative workspace');
  await Promise.all([
    ensureMembership(admin.id, workspace.id, 'ADMIN'),
    ensureMembership(member.id, workspace.id, 'MEMBER'),
    ensureMembership(sysAdmin.id, workspace.id, 'MEMBER'),
  ]);
  const lists = await ensureBoardLists(workspace.id, ['To Do', 'In Progress', 'Done']);
  const channel = await ensureChannel(workspace.id);
  await Promise.all([
    ensureCard(lists[0]!.id, 'Review project requirements', 1024, owner.id),
    ensureCard(lists[0]!.id, 'Plan the first sprint', 2048, member.id),
    ensureCard(lists[0]!.id, 'Set up the repository', 3072, admin.id),
    ensureMessage(channel.id, owner.id, 'Welcome to the study group!'),
    ensureMessage(channel.id, member.id, 'I will review the requirements.'),
    ensureMessage(channel.id, admin.id, 'Sprint planning is ready.'),
  ]);

  await ensureWorkspace('Second Workspace', owner.id);
  if (process.env.SEED_LARGE_WORKSPACE === 'true') await seedLargeWorkspace(owner.id);
  console.info('Demo users and workspaces are seeded or already present. Existing data was preserved.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
