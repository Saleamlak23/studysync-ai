import { Router } from 'express';
import { listNotificationsQuery, notificationIdParams } from '@studysync/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', validate({ query: listNotificationsQuery }), asyncHandler(async (req, res) => {
  res.json(await listNotifications(req.user!.id, req.query));
}));

notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await markAllNotificationsRead(req.user!.id);
  res.status(204).end();
}));

notificationsRouter.post('/:id/read', validate({ params: notificationIdParams }), asyncHandler(async (req, res) => {
  res.json(await markNotificationRead(req.user!.id, req.params.id));
}));
