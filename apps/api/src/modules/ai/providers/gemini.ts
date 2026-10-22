import { env } from '../../../config/env.js';
import type { AIProvider, AIProviderResult } from './types.js';

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;

  async complete(prompt: string, signal?: AbortSignal): Promise<AIProviderResult> {
    if (!env.GEMINI_API_KEY) throw new Error('Gemini provider is not configured');
    const model = encodeURIComponent(env.GEMINI_MODEL);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': env.GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal,
      },
    );
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const result = await response.json() as GeminiResponse;
    const text = result.candidates?.[0]?.content?.parts
      ?.map(({ text: part }) => part ?? '')
      .join('');
    if (!text) throw new Error('Gemini returned no completion text');
    return {
      text,
      tokensIn: result.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: result.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
