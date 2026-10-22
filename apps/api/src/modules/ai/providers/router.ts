import { AppError } from '../../../lib/errors.js';
import { GeminiProvider } from './gemini.js';
import { GroqProvider } from './groq.js';
import type { AIProvider, RoutedAIResult } from './types.js';

export const AI_PROVIDER_TIMEOUT_MS = 30_000;
const RETRY_COUNT = 1;

async function completeWithRetry(provider: AIProvider, prompt: string, timeoutMs: number) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      return await provider.complete(prompt, AbortSignal.timeout(timeoutMs));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function routeAIRequest(
  prompt: string,
  providers: { primary?: AIProvider; fallback?: AIProvider } = {},
  timeoutMs = AI_PROVIDER_TIMEOUT_MS,
): Promise<RoutedAIResult> {
  const primary = providers.primary ?? new GroqProvider();
  const fallback = providers.fallback ?? new GeminiProvider();
  try {
    return { ...await completeWithRetry(primary, prompt, timeoutMs), provider: primary.name };
  } catch {
    try {
      return { ...await fallback.complete(prompt, AbortSignal.timeout(timeoutMs)), provider: fallback.name };
    } catch {
      throw new AppError(502, 'AI_UNAVAILABLE', 'AI providers are unavailable');
    }
  }
}
