import { env } from '../../../config/env.js';
import type { AIProvider, AIProviderResult } from './types.js';

type GroqResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export class GroqProvider implements AIProvider {
  readonly name = 'groq' as const;

  async complete(prompt: string, signal?: AbortSignal): Promise<AIProviderResult> {
    if (!env.GROQ_API_KEY) throw new Error('Groq provider is not configured');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal,
    });
    if (!response.ok) throw new Error(`Groq request failed with status ${response.status}`);
    const result = await response.json() as GroqResponse;
    const text = result.choices?.[0]?.message?.content;
    if (typeof text !== 'string') throw new Error('Groq returned no completion text');
    return {
      text,
      tokensIn: result.usage?.prompt_tokens ?? 0,
      tokensOut: result.usage?.completion_tokens ?? 0,
    };
  }
}
