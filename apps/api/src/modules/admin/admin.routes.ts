import { Router } from 'express';
import {
  adminAiUsageQuery,
  adminUsersQuery,
  idParam,
  patchUserStatusBody,
  updateAiLimitsBody,
} from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireSystemAdmin } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { listUsers, updateUserStatus } from './users.service.js';
import { getAdminAiLimits, getAiUsage, updateAdminAiLimits } from './settings.service.js';

// Requirements: FR-ADM-01, FR-ADM-02, FR-AUTH-07.
// All endpoints are restricted to SysAdmin (systemRole: ADMIN).
export const adminRouter = Router();

adminRouter.use(authenticate);
adminRouter.use(requireSystemAdmin);

adminRouter.get(
  '/users',
  validate({ query: adminUsersQuery }),
  asyncHandler(async (req, res) => {
    res.json(await listUsers(req.query as unknown as Parameters<typeof listUsers>[0]));
  }),
);

adminRouter.patch(
  '/users/:id',
  validate({ params: idParam, body: patchUserStatusBody }),
  asyncHandler(async (req, res) => {
    res.json(await updateUserStatus(req.params.id, req.body.status));
  }),
);

adminRouter.get(
  '/ai-usage',
  validate({ query: adminAiUsageQuery }),
  asyncHandler(async (req, res) => {
    res.json(await getAiUsage(req.query as unknown as Parameters<typeof getAiUsage>[0]));
  }),
);

adminRouter.get(
  '/ai-limits',
  asyncHandler(async (_req, res) => {
    res.json(await getAdminAiLimits());
  }),
);

adminRouter.put(
  '/ai-limits',
  validate({ body: updateAiLimitsBody }),
  asyncHandler(async (req, res) => {
    res.json(await updateAdminAiLimits(req.user!.id, req.body));
  }),
);
