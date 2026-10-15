import type { RequestHandler } from 'express';
import { ROLE_RANK } from '../config/constants.js';
import { Errors } from '../lib/errors.js';
export const requireRole = (role: keyof typeof ROLE_RANK): RequestHandler => (req, _res, next) => { if (!req.membership || ROLE_RANK[req.membership.role] < ROLE_RANK[role]) return next(Errors.forbidden()); next(); };
export const requireSystemAdmin: RequestHandler = (req, _res, next) => { if (req.user?.systemRole !== 'ADMIN') return next(Errors.forbidden()); next(); };
