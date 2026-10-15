import jwt from 'jsonwebtoken';
import { asyncHandler } from '../lib/asyncHandler.js';
import { Errors } from '../lib/errors.js';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw Errors.unauthenticated();
  let sub: string;
  try { sub = (jwt.verify(header.slice(7), env.JWT_SECRET) as { sub: string }).sub; }
  catch (error) { throw error instanceof jwt.TokenExpiredError ? Errors.tokenExpired() : Errors.unauthenticated(); }
  const user = await prisma.user.findUnique({ where: { id: sub }, select: { id: true, systemRole: true, status: true } });
  if (!user) throw Errors.unauthenticated();
  if (user.status === 'SUSPENDED') throw Errors.suspended();
  req.user = { id: user.id, systemRole: user.systemRole };
  next();
});
