const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Please check the highlighted fields.',
  UNAUTHENTICATED: 'Sign in to continue.',
  TOKEN_EXPIRED: 'Your session has expired. Sign in again.',
  ACCOUNT_SUSPENDED: 'This account is suspended. Contact an administrator.',
  FORBIDDEN: 'You do not have permission to do that.',
  NOT_FOUND: 'We could not find that.',
  CONFLICT: 'That already exists.',
  FILE_TOO_LARGE: 'Files can be up to 5 MB.',
  STORAGE_LIMIT_REACHED: 'This workspace has used all of its file storage.',
  UNSUPPORTED_FILE_TYPE: 'Use PDF, DOCX, TXT, PNG or JPG files.',
  AI_DISABLED: 'The workspace owner has not enabled AI.',
  AI_LIMIT_REACHED: 'Daily AI limit reached. Check back after it resets.',
  AI_UNAVAILABLE: 'The AI could not answer. Nothing was changed. Try again.',
  AI_BAD_OUTPUT: 'The AI could not answer. Nothing was changed. Try again.',
  RATE_LIMITED: 'Too many attempts. Wait a minute.',
  INTERNAL: 'Something went wrong. Try again.',
};

export function getErrorMessage(code: string, details?: unknown): string {
  if (code === 'AI_LIMIT_REACHED') {
    const resetAt =
      details && typeof details === 'object' && 'resetAt' in details && typeof details.resetAt === 'string'
        ? new Date(details.resetAt)
        : null;
    const resetTime = resetAt && !Number.isNaN(resetAt.getTime())
      ? resetAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;
    return resetTime
      ? `Daily AI limit reached. It resets at ${resetTime}.`
      : 'Daily AI limit reached. Check back after it resets.';
  }
  return messages[code] ?? 'Something went wrong. Try again.';
}
