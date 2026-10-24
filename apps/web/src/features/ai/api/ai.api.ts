import { api } from '@/shared/lib/api.js';

export type AiContextPayload =
  | { type: 'card'; id: string }
  | { type: 'file'; id: string }
  | { type: 'message_range'; channelId: string; fromId: string; toId: string };

export type AskAiInput = { question: string; context: AiContextPayload[] };
export type SummarizeAiInput = { target: AiContextPayload };
export type AiAnswer = { answer: string; provider: string };
export type AiSummary = { summary: string; provider: string };
export type BreakdownItem = {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
};
export type BreakdownPreview = { items: BreakdownItem[]; provider: string };

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

export function previewBreakdown(
  workspaceId: string,
  input: { description: string; listId: string },
): Promise<BreakdownPreview> {
  return api<BreakdownPreview>(`/workspaces/${encodeURIComponent(workspaceId)}/ai/breakdown`, {
    method: 'POST',
    body: input,
  });
}

export function confirmBreakdown(
  workspaceId: string,
  input: { listId: string; items: BreakdownItem[] },
): Promise<unknown[]> {
  return api<unknown[]>(`/workspaces/${encodeURIComponent(workspaceId)}/ai/breakdown/confirm`, {
    method: 'POST',
    body: input,
  });
}

export type WorkspaceBoardLists = { lists: Array<{ id: string; name: string }> };

export function getWorkspaceBoardLists(workspaceId: string): Promise<WorkspaceBoardLists> {
  return api<WorkspaceBoardLists>(`/workspaces/${encodeURIComponent(workspaceId)}/board`);
}
