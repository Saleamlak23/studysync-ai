import { Router } from 'express';
import { Readable } from 'node:stream';
import { idParam, pagination, workspaceIdParams } from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership, withWorkspace } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { createFile, getFileDownload, getFileWorkspaceId, listFiles } from './files.service.js';
import { fileUpload } from './upload.js';

export const filesRouter = Router();
filesRouter.use(authenticate);

filesRouter.post('/workspaces/:id/files', validate({ params: workspaceIdParams }), loadMembership(), requireRole('MEMBER'), fileUpload.single('file'), asyncHandler(async (req, res) => {
  res.status(201).json(await createFile(req.params.id, req.user!.id, req.file));
}));

filesRouter.get('/workspaces/:id/files', validate({ params: workspaceIdParams, query: pagination }), loadMembership(), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  res.json(await listFiles(req.params.id, pagination.parse(req.query)));
}));

filesRouter.get('/files/:id', validate({ params: idParam }), withWorkspace((req) => getFileWorkspaceId(req.params.id)), requireRole('MEMBER'), asyncHandler(async (req, res) => {
  const file = await getFileDownload(req.params.id);
  const safeName = encodeURIComponent(file.name).replaceAll("'", '%27');
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.sizeBytes);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
  Readable.from([Buffer.from(file.data)]).pipe(res);
}));
