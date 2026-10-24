import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useAiContext, type AiContextItem } from '@/shared/stores/aiContext.js';
import { ApiError } from '@/shared/lib/api.js';
import { useAskAi, useSummarizeAi, useWorkspaceAiState } from './api/hooks.js';
import type { AiContextPayload } from './api/ai.api.js';

type AiResult =
  | { kind: 'answer'; text: string; provider: string }
  | { kind: 'summary'; text: string; provider: string };

function toPayload(item: AiContextItem): AiContextPayload {
  switch (item.type) {
    case 'card': return { type: 'card', id: item.id };
    case 'file': return { type: 'file', id: item.id };
    case 'message_range': return {
      type: 'message_range',
      channelId: item.channelId,
      fromId: item.fromId,
      toId: item.toId,
    };
  }
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The AI could not answer. Nothing was changed. Try again.';
}

function ContextLabel({ item }: { item: AiContextItem }) {
  const type = item.type === 'message_range' ? 'Messages' : item.type === 'card' ? 'Card' : 'File';
  return <li className="break-words rounded-md border border-ai-soft-line bg-ai-soft px-3 py-2 text-sm text-fg">
    <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-ai">{type}</span>
    {item.label}
  </li>;
}

export function AiPanel({ workspaceId: workspaceIdProp }: { workspaceId?: string } = {}) {
  const params = useParams<{ id?: string }>();
  const workspaceId = workspaceIdProp ?? params.id ?? '';
  const queryClient = useQueryClient();
  const { items, clear } = useAiContext();
  const workspace = useWorkspaceAiState(workspaceId);
  const ask = useAskAi(workspaceId);
  const summarize = useSummarizeAi(workspaceId);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const requestPending = ask.isPending || summarize.isPending;
  const canUseAi = workspace.data?.aiEnabled === true;
  const workspaceStateLoading = Boolean(workspaceId) && workspace.isPending;
  const workspaceStateError = workspace.error;
  const error = ask.error ?? summarize.error;

  function handleAiError(error: unknown) {
    if (error instanceof ApiError && error.code === 'AI_DISABLED') {
      queryClient.setQueryData(['workspace-ai-consent', workspaceId], { id: workspaceId, aiEnabled: false });
    }
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!workspaceId || !canUseAi || !trimmed || items.length === 0 || requestPending) return;
    ask.reset();
    summarize.reset();
    setResult(null);
    ask.mutate({ question: trimmed, context: items.map(toPayload) }, {
      onSuccess: (response) => setResult({ kind: 'answer', text: response.answer, provider: response.provider }),
      onError: handleAiError,
    });
  }

  function summarizeSelection() {
    const item = items[0];
    if (!workspaceId || !canUseAi || items.length !== 1 || !item || requestPending) return;
    ask.reset();
    summarize.reset();
    setResult(null);
    summarize.mutate({ target: toPayload(item) }, {
      onSuccess: (response) => setResult({ kind: 'summary', text: response.summary, provider: response.provider }),
      onError: handleAiError,
    });
  }

  const panel = <section aria-label="AI assistant" className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-lg border border-ai-soft-line bg-surface p-4">
    <header className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-fg">AI assistant</h2>
        <p className="text-xs text-fg-muted">Ask or summarize selected workspace content.</p>
      </div>
      {isOpen && <button type="button" aria-label="Close AI assistant" onClick={() => setIsOpen(false)} className="min-h-11 shrink-0 rounded-md px-3 text-sm font-medium text-fg hover:bg-surface-muted xl:hidden">Close</button>}
    </header>

    <p className="rounded-md border border-ai-soft-line bg-ai-soft p-3 text-sm text-fg">
      The workspace owner must enable AI. Selected content is sent to third-party AI providers, whose terms apply. Do not include sensitive information.
    </p>

    {!workspaceId && <p role="status" className="rounded-md border border-warning bg-warning-bg p-3 text-sm text-fg">Open a workspace to use its AI assistant.</p>}
    {workspaceStateLoading && <p role="status" className="rounded-md border border-line bg-surface-muted p-3 text-sm text-fg-muted">Checking workspace AI consent…</p>}
    {workspaceStateError && <div role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg">
      <p>{workspaceStateError instanceof ApiError ? workspaceStateError.message : 'We could not check workspace AI consent.'}</p>
      <button type="button" onClick={() => void workspace.refetch()} disabled={workspace.isFetching} className="mt-2 min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>
    </div>}
    {workspace.data && !workspace.data.aiEnabled && <p role="status" className="rounded-md border border-warning bg-warning-bg p-3 text-sm text-fg">AI is off for this workspace. The workspace owner can enable it in Settings.</p>}

    <section aria-label="Selected AI context" className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">Selected context</h3>
        {items.length > 0 && <button type="button" onClick={clear} className="min-h-11 shrink-0 rounded-md px-2 text-sm font-medium text-ai hover:bg-ai-soft">Clear</button>}
      </div>
      {items.length === 0
        ? <p className="rounded-md border border-dashed border-line p-3 text-sm text-fg-muted">Select a card, message range or file to give the assistant context.</p>
        : <ul className="max-h-36 space-y-2 overflow-y-auto">{items.map((item, index) => <ContextLabel key={`${item.type}-${index}`} item={item} />)}</ul>}
    </section>

    <button type="button" onClick={summarizeSelection} disabled={!workspaceId || !canUseAi || items.length !== 1 || requestPending} className="min-h-11 w-full rounded-md border border-ai-soft-line bg-ai-soft px-3 text-sm font-semibold text-ai hover:bg-ai-soft disabled:cursor-not-allowed disabled:opacity-50">
      {summarize.isPending ? 'Summarizing…' : 'Summarize selected item'}
    </button>
    {items.length > 1 && <p className="-mt-3 text-xs text-fg-muted">Select one item at a time to summarize.</p>}

    <form onSubmit={submitQuestion} className="flex flex-col gap-2">
      <label htmlFor="ai-question" className="text-sm font-semibold text-fg">Ask a question</label>
      <textarea id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={10000} rows={3} placeholder="Ask about the selected content…" className="min-h-24 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-focus" />
      <button type="submit" disabled={!workspaceId || !canUseAi || items.length === 0 || !question.trim() || requestPending} className="min-h-11 w-full rounded-md bg-ai px-4 text-sm font-semibold text-white hover:bg-ai-hover disabled:cursor-not-allowed disabled:opacity-50">
        {ask.isPending ? 'Asking…' : 'Ask AI'}
      </button>
    </form>

    {error && <div role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg">{errorText(error)}</div>}
    {result && <section aria-label={result.kind === 'answer' ? 'AI answer' : 'AI summary'} aria-live="polite" className="max-h-48 overflow-y-auto rounded-md border border-ai-soft-line bg-ai-soft p-3">
      <h3 className="text-sm font-semibold text-fg">{result.kind === 'answer' ? 'Answer' : 'Summary'}</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-fg">{result.text}</p>
      <p className="mt-2 text-xs text-fg-muted">Provider: {result.provider}</p>
    </section>}
  </section>;

  return <>
    <aside className="hidden h-full w-[var(--size-ai-panel)] shrink-0 xl:flex">{panel}</aside>
    <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(true)} className="fixed bottom-[calc(var(--size-bottom-nav)+1rem)] right-4 z-30 min-h-11 rounded-full bg-ai px-4 text-sm font-semibold text-white shadow-md hover:bg-ai-hover xl:hidden">AI assistant</button>
    {isOpen && <div className="fixed inset-0 z-40 flex items-end bg-fg/40 p-3 md:items-stretch md:justify-end xl:hidden">
      <div id="mobile-ai-panel" role="dialog" aria-modal="true" aria-label="AI assistant" className="h-[85dvh] w-full md:h-full md:max-w-md">{panel}</div>
    </div>}
  </>;
}
