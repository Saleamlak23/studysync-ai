export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const Errors = {
  validation: (details: unknown) => new AppError(400, 'VALIDATION_ERROR', 'Invalid input', details),
  unauthenticated: () => new AppError(401, 'UNAUTHENTICATED', 'Sign in required'),
  tokenExpired: () => new AppError(401, 'TOKEN_EXPIRED', 'Access token expired'),
  forbidden: (message = 'You do not have permission') => new AppError(403, 'FORBIDDEN', message),
  suspended: () => new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended'),
  notFound: (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
};
