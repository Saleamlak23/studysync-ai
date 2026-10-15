import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction([
    prisma.message.deleteMany(), prisma.channel.deleteMany(), prisma.cardAssignee.deleteMany(), prisma.comment.deleteMany(),
    prisma.cardLabel.deleteMany(), prisma.card.deleteMany(), prisma.list.deleteMany(), prisma.board.deleteMany(),
    prisma.membership.deleteMany(), prisma.workspace.deleteMany(), prisma.refreshToken.deleteMany(), prisma.user.deleteMany(),
  ]);
  const passwordHash = await bcrypt.hash('Password123!', 12);
  const [sysAdmin, owner, admin, member, , suspended] = await Promise.all([
    prisma.user.create({ data: { name: 'System Admin', email: 'sysadmin@studysync.test', passwordHash, systemRole: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Workspace Owner', email: 'owner@studysync.test', passwordHash } }),
    prisma.user.create({ data: { name: 'Workspace Admin', email: 'admin@studysync.test', passwordHash } }),
    prisma.user.create({ data: { name: 'Workspace Member', email: 'member@studysync.test', passwordHash } }),
    prisma.user.create({ data: { name: 'Non Member', email: 'nonmember@studysync.test', passwordHash } }),
    prisma.user.create({ data: { name: 'Suspended User', email: 'suspended@studysync.test', passwordHash, status: 'SUSPENDED' } }),
  ]);
  const workspace = await prisma.workspace.create({ data: { name: 'Study Group', description: 'Sample collaborative workspace', board: { create: { lists: { create: [{ name: 'To Do', position: 1024 }, { name: 'In Progress', position: 2048 }, { name: 'Done', position: 3072 }] } } }, channels: { create: { name: 'general' } }, memberships: { create: [{ userId: owner.id, role: 'OWNER' }, { userId: admin.id, role: 'ADMIN' }, { userId: member.id, role: 'MEMBER' }, { userId: sysAdmin.id, role: 'MEMBER' }] } } });
  const list = await prisma.list.findFirstOrThrow({ where: { board: { workspaceId: workspace.id } } });
  await prisma.card.createMany({ data: [{ title: 'Review project requirements', position: 1024, listId: list.id, createdById: owner.id }, { title: 'Plan the first sprint', position: 2048, listId: list.id, createdById: member.id }, { title: 'Set up the repository', position: 3072, listId: list.id, createdById: admin.id }] });
  const channel = await prisma.channel.findFirstOrThrow({ where: { workspaceId: workspace.id } });
  await prisma.message.createMany({ data: [{ channelId: channel.id, authorId: owner.id, content: 'Welcome to the study group!' }, { channelId: channel.id, authorId: member.id, content: 'I will review the requirements.' }, { channelId: channel.id, authorId: admin.id, content: 'Sprint planning is ready.' }] });
  await prisma.workspace.create({ data: { name: 'Second Workspace', memberships: { create: { userId: owner.id, role: 'OWNER' } } } });
  if (process.env.SEED_LARGE_WORKSPACE === 'true') {
    const large = await prisma.workspace.create({ data: { name: 'Large Demo Workspace', memberships: { create: { userId: owner.id, role: 'OWNER' } }, board: { create: { lists: { create: { name: 'Backlog', position: 1024 } } } }, channels: { create: { name: 'general' } } } });
    const largeList = await prisma.list.findFirstOrThrow({ where: { board: { workspaceId: large.id } } });
    const largeChannel = await prisma.channel.findFirstOrThrow({ where: { workspaceId: large.id } });
    await prisma.card.createMany({ data: Array.from({ length: 500 }, (_, index) => ({ listId: largeList.id, title: `Demo task ${index + 1}`, position: (index + 1) * 1024, createdById: owner.id })) });
    await prisma.message.createMany({ data: Array.from({ length: 5000 }, (_, index) => ({ channelId: largeChannel.id, authorId: owner.id, content: `Demo message ${index + 1}` })) });
  }
  console.info(`Seeded users including ${suspended.email} and workspace fixtures.`);
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
