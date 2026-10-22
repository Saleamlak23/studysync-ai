import { Router } from 'express';
import { patchProfileBody } from '@studysync/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { clearRefreshCookie } from '../auth/auth.cookies.js';
import {
  deleteAccount,
  deleteAiHistory,
  getPersonalDashboard,
  getProfile,
  updateProfile,
} from './profile.service.js';

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await getProfile(req.user!.id));
  }),
);

profileRouter.get(
  '/me/dashboard',
  asyncHandler(async (req, res) => {
    res.json(await getPersonalDashboard(req.user!.id));
  }),
);

profileRouter.patch(
  '/me',
  validate({ body: patchProfileBody }),
  asyncHandler(async (req, res) => {
    res.json(await updateProfile(req.user!.id, req.body));
  }),
);

// Requirements: NFR-14, FR-PROF-03. Deletes account and clears refresh cookie.
profileRouter.delete(
  '/me',
  asyncHandler(async (req, res) => {
    await deleteAccount(req.user!.id);
    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

// Requirements: NFR-14. User can clear their own AI request history.
profileRouter.delete(
  '/me/ai-history',
  asyncHandler(async (req, res) => {
    await deleteAiHistory(req.user!.id);
    res.status(204).end();
  }),
);
