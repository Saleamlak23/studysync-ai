export type AIProviderName = 'groq' | 'gemini';

export type AIProviderResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
};

export interface AIProvider {
  readonly name: AIProviderName;
  complete(prompt: string, signal?: AbortSignal): Promise<AIProviderResult>;
}

export type RoutedAIResult = AIProviderResult & { provider: AIProviderName };
