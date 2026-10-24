import { api } from '@/shared/lib/api.js';

export type AiContextPayload =
  | { type: 'card'; id: string }
  | { type: 'file'; id: string }
  | { type: 'message_range'; channelId: string; fromId: string; toId: string };

export type AskAiInput = { question: string; context: AiContextPayload[] };
export type SummarizeAiInput = { target: AiContextPayload };
export type AiAnswer = { answer: string; provider: string };
export type AiSummary = { summary: string; provider: string };

export function askAi(workspaceId: string, input: AskAiInput): Promise<AiAnswer> {
  return api<AiAnswer>(`/workspaces/${encodeURIComponent(workspaceId)}/ai/ask`, {
    method: 'POST',
    body: input,
  });
}

export function summarizeAi(workspaceId: string, input: SummarizeAiInput): Promise<AiSummary> {
  return api<AiSummary>(`/workspaces/${encodeURIComponent(workspaceId)}/ai/summarize`, {
    method: 'POST',
    body: input,
  });
}
