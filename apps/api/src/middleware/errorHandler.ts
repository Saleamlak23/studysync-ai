import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { AppError } from '../lib/errors.js';
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  let status = 500, code = 'INTERNAL', message = 'Something went wrong', details: unknown;
  if (error instanceof AppError) ({ status, code, message, details } = error);
  else if (error instanceof ZodError) { status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid input'; details = error.issues; }
  else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') { status = 409; code = 'CONFLICT'; message = 'Already exists'; }
  else if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') { status = 413; code = 'FILE_TOO_LARGE'; message = 'File is too large'; }
  else if (error instanceof multer.MulterError) { status = 400; code = 'VALIDATION_ERROR'; message = 'Invalid file upload'; }
  else if (error?.status === 404) { status = 404; code = 'NOT_FOUND'; message = 'Resource not found'; }
  else console.error(error);
  void next;
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
};
