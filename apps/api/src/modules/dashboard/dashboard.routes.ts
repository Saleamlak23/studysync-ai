import { Router } from 'express';
import { workspaceIdParams } from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loadMembership } from '../../middleware/attachMembership.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { getWorkspaceDashboard } from './dashboard.service.js';

// Requirements: FR-ANA-01. GET /workspaces/:id/dashboard — Member role required.
export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/:id/dashboard',
  validate({ params: workspaceIdParams }),
  loadMembership(),
  requireRole('MEMBER'),
  asyncHandler(async (req, res) => {
    res.json(await getWorkspaceDashboard(req.params.id));
  }),
);
