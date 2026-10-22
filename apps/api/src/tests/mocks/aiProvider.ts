import type { AIProvider, AIProviderName, AIProviderResult } from '../../modules/ai/providers/types.js';

export const validAiOutput = { items: [{ title: 'Plan study session' }], provider: 'test' };
export const invalidAiOutput = { items: [], provider: 'test' };
export const aiProviderOutcomes = ['timeout', 'error'] as const;

export class MockAIProvider implements AIProvider {
  calls = 0;

  constructor(
    readonly name: AIProviderName,
    private readonly outcome: 'success' | 'error' | 'timeout' = 'success',
    private readonly response: AIProviderResult = { text: 'Mock response', tokensIn: 2, tokensOut: 3 },
  ) {}

  async complete(_prompt: string, signal?: AbortSignal): Promise<AIProviderResult> {
    this.calls += 1;
    if (this.outcome === 'timeout') {
      await new Promise<void>((_resolve, reject) => {
        if (signal?.aborted) reject(signal.reason);
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    if (this.outcome === 'error') throw new Error(`${this.name} mock failure`);
    return this.response;
  }
}
