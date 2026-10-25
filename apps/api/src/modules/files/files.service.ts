import { Prisma, type File as FileRecord } from '@prisma/client';
import type { Express } from 'express';
import { pagination } from '@studysync/shared';
import type { z } from 'zod';
import { env } from '../../config/env.js';
import { Errors, AppError } from '../../lib/errors.js';
import { prisma } from '../../db/prisma.js';

const fileMetadata = {
  id: true,
  workspaceId: true,
  uploaderId: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  uploader: { select: { id: true, name: true, avatarUrl: true } },
} as const;

type StoredFile = Pick<FileRecord, 'workspaceId' | 'name' | 'mimeType' | 'sizeBytes'>;
type FileListQuery = z.infer<typeof pagination>;

interface FileStorage {
  save(workspaceId: string, uploaderId: string, file: Express.Multer.File): Promise<unknown>;
}

class PostgresFileStorage implements FileStorage {
  async save(workspaceId: string, uploaderId: string, file: Express.Multer.File) {
    return prisma.$transaction(async (tx) => {
      // Serialize workspace uploads so concurrent requests cannot exceed its storage cap.
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE
      `);
      if (locked.length === 0) throw Errors.notFound('Workspace');

      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { archivedAt: true } });
      if (!workspace || workspace.archivedAt) throw Errors.notFound('Workspace');
      const membership = await tx.membership.findUnique({
        where: { userId_workspaceId: { userId: uploaderId, workspaceId } },
        select: { id: true },
      });
      if (!membership) throw Errors.notFound('Workspace');

      const current = await tx.file.aggregate({ where: { workspaceId }, _sum: { sizeBytes: true } });
      const usedBytes = current._sum.sizeBytes ?? 0;
      if (usedBytes + file.size > env.WORKSPACE_STORAGE_CAP_BYTES) {
        throw new AppError(413, 'STORAGE_LIMIT_REACHED', 'Workspace storage limit reached');
      }

      const data: StoredFile = {
        workspaceId,
        name: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      };
      const bytes = new Uint8Array(file.size);
      bytes.set(file.buffer);
      const created = await tx.file.create({
        data: { ...data, uploaderId, blob: { create: { data: bytes } } },
        select: fileMetadata,
      });
      return created;
    });
  }
}

const fileStorage: FileStorage = new PostgresFileStorage();

export async function createFile(workspaceId: string, uploaderId: string, file?: Express.Multer.File) {
  if (!file) throw Errors.validation({ field: 'file', message: 'A file is required' });
  return fileStorage.save(workspaceId, uploaderId, file);
}

export async function listFiles(workspaceId: string, input: FileListQuery) {
  const query = pagination.parse(input);
  const cursor = query.cursor
    ? await prisma.file.findFirst({ where: { id: query.cursor, workspaceId }, select: { id: true, createdAt: true } })
    : null;
  if (query.cursor && !cursor) {
    throw Errors.validation({ field: 'cursor', message: 'Cursor must identify a file in this workspace' });
  }
  return prisma.file.findMany({
    where: {
      workspaceId,
      ...(cursor
        ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit,
    select: fileMetadata,
  });
}

export async function getFileWorkspaceId(fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { workspaceId: true } });
  if (!file) throw Errors.notFound('File');
  return file.workspaceId;
}

export async function getFileDownload(fileId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: {
      name: true,
      mimeType: true,
      sizeBytes: true,
      blob: { select: { data: true } },
    },
  });
  if (!file || !file.blob) throw Errors.notFound('File');
  return { name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes, data: file.blob.data };
}
