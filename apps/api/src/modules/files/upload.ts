import multer from 'multer';
import { env } from '../../config/env.js';
import { ALLOWED_FILE_MIME_TYPES } from '../../config/constants.js';
import { AppError } from '../../lib/errors.js';

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.FILE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_FILE_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_FILE_MIME_TYPES[number])) {
      callback(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'File type is not allowed'));
      return;
    }
    callback(null, true);
  },
});
