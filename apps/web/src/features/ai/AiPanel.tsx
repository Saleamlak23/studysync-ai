import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { PanelRightClose } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAiContext, type AiContextItem } from '@/shared/stores/aiContext.js';
import { ApiError } from '@/shared/lib/api.js';
import { useAskAi, useSummarizeAi, useWorkspaceAiState } from './api/hooks.js';
import type { AiContextPayload, AiConversationMessage } from './api/ai.api.js';
import {
  appendAiChatMessage,
  clearAiConversation,
  syncAiConversationContext,
  useAiConversation,
} from './conversation.js';
import { BreakdownDialog } from './BreakdownDialog.js';

type FailedRequest =
  | { kind: 'ask'; question: string; context: AiContextPayload[]; history: AiConversationMessage[] }
  | { kind: 'summary'; target: AiContextPayload; history: AiConversationMessage[]; label: string };

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
  return <li className="max-w-full truncate rounded-sm border border-ai-soft-line bg-ai-soft px-2 py-1 text-xs text-fg" title={`${type}: ${item.label}`}>
    <span className="mr-1 font-semibold text-ai">{type}:</span>
    {item.label}
  </li>;
}

function AnswerMarkdown({ children }: { children: string }) {
  return <ReactMarkdown components={{
    p: ({ children: content }) => <p className="mb-2 last:mb-0">{content}</p>,
    ul: ({ children: content }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{content}</ul>,
    ol: ({ children: content }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{content}</ol>,
    li: ({ children: content }) => <li className="pl-1">{content}</li>,
    h1: ({ children: content }) => <h3 className="mb-2 text-base font-semibold">{content}</h3>,
    h2: ({ children: content }) => <h3 className="mb-2 text-sm font-semibold">{content}</h3>,
    h3: ({ children: content }) => <h3 className="mb-2 text-sm font-semibold">{content}</h3>,
    pre: ({ children: content }) => <pre className="my-2 overflow-x-auto rounded-md bg-surface-muted p-3 font-mono text-xs">{content}</pre>,
    code: ({ children: content }) => <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{content}</code>,
  }}>{children}</ReactMarkdown>;
}

export function AiPanel({
  workspaceId: workspaceIdProp,
  onCollapse,
}: {
  workspaceId?: string;
  onCollapse?: () => void;
} = {}) {
  const params = useParams<{ id?: string }>();
  const workspaceId = workspaceIdProp ?? params.id ?? '';
  const queryClient = useQueryClient();
  const { items, clear } = useAiContext();
  const messages = useAiConversation(workspaceId);
  const questionId = useId();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const workspace = useWorkspaceAiState(workspaceId);
  const ask = useAskAi(workspaceId);
  const summarize = useSummarizeAi(workspaceId);
  const [question, setQuestion] = useState('');
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [failedRequest, setFailedRequest] = useState<FailedRequest | null>(null);
  const contextPayload = items.map(toPayload);
  const contextKey = JSON.stringify(contextPayload);
  const hasConversation = messages.some((message) => message.role === 'assistant');
  const requestPending = ask.isPending || summarize.isPending;
  const canUseAi = workspace.data?.aiEnabled === true;
  const workspaceStateLoading = Boolean(workspaceId) && workspace.isPending;
  const workspaceStateError = workspace.error;
  const error = ask.error ?? summarize.error;

  useEffect(() => {
    ask.reset();
    summarize.reset();
    setFailedRequest(null);
    syncAiConversationContext(workspaceId, contextKey);
  }, [workspaceId, contextKey]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages.length, ask.isPending, summarize.isPending]);

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
    setFailedRequest(null);
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    const input = { question: trimmed, context: contextPayload, ...(history.length ? { history } : {}) };
    appendAiChatMessage(workspaceId, { role: 'user', content: trimmed });
    setQuestion('');
    ask.mutate(input, {
      onSuccess: (response) => appendAiChatMessage(workspaceId, {
        role: 'assistant',
        content: response.answer,
        provider: response.provider,
        kind: 'answer',
      }),
      onError: handleAiError,
    });
    setFailedRequest({ kind: 'ask', question: trimmed, context: contextPayload, history });
  }

  function summarizeSelection() {
    const item = items[0];
    if (!workspaceId || !canUseAi || items.length !== 1 || !item || requestPending) return;
    ask.reset();
    summarize.reset();
    setFailedRequest(null);
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    const target = toPayload(item);
    appendAiChatMessage(workspaceId, { role: 'user', content: `Summarize ${item.label}` });
    summarize.mutate({ target: toPayload(item) }, {
      onSuccess: (response) => appendAiChatMessage(workspaceId, {
        role: 'assistant',
        content: response.summary,
        provider: response.provider,
        kind: 'summary',
      }),
      onError: handleAiError,
    });
    setFailedRequest({ kind: 'summary', target, history, label: item.label });
  }

  function retryFailedRequest() {
    if (!workspaceId || !canUseAi || !failedRequest || requestPending) return;
    ask.reset();
    summarize.reset();
    if (failedRequest.kind === 'ask') {
      ask.mutate({
        question: failedRequest.question,
        context: failedRequest.context,
        ...(failedRequest.history.length ? { history: failedRequest.history } : {}),
      }, {
        onSuccess: (response) => {
          appendAiChatMessage(workspaceId, {
            role: 'assistant',
            content: response.answer,
            provider: response.provider,
            kind: 'answer',
          });
          setFailedRequest(null);
        },
        onError: handleAiError,
      });
      return;
    }

    summarize.mutate({ target: failedRequest.target }, {
      onSuccess: (response) => {
        appendAiChatMessage(workspaceId, {
          role: 'assistant',
          content: response.summary,
          provider: response.provider,
          kind: 'summary',
        });
        setFailedRequest(null);
      },
      onError: handleAiError,
    });
  }

  function startNewChat() {
    if (!workspaceId || requestPending) return;
    ask.reset();
    summarize.reset();
    clearAiConversation(workspaceId);
    setFailedRequest(null);
    setQuestion('');
  }

  const panel = <section aria-label="AI assistant" className={`flex h-full min-h-0 flex-col gap-3 overflow-hidden bg-surface ${onCollapse ? 'p-3' : 'rounded-lg border border-ai-soft-line p-4'}`}>
    <header className="flex shrink-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-fg">AI assistant</h2>
      </div>
      {messages.length > 0 && <button type="button" onClick={startNewChat} disabled={requestPending} className="min-h-11 shrink-0 rounded-md px-2 text-sm font-medium text-ai hover:bg-ai-soft disabled:opacity-50">New chat</button>}
      {onCollapse && <button
        type="button"
        aria-label="Collapse AI assistant"
        title="Collapse AI assistant"
        onClick={onCollapse}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
      ><PanelRightClose aria-hidden="true" className="size-4" strokeWidth={1.75} /></button>}
    </header>

    <p className="shrink-0 text-xs text-fg-muted">Selected content may be sent to AI providers.</p>

    {!workspaceId && <p role="status" className="shrink-0 rounded-md border border-warning bg-warning-bg p-2 text-sm text-fg">Open a workspace to use its AI assistant.</p>}
    {workspaceStateLoading && <p role="status" className="shrink-0 rounded-md border border-line bg-surface-muted p-2 text-sm text-fg-muted">Checking workspace AI consent…</p>}
    {workspaceStateError && <div role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg">
      <p>{workspaceStateError instanceof ApiError ? workspaceStateError.message : 'We could not check workspace AI consent.'}</p>
      <button type="button" onClick={() => void workspace.refetch()} disabled={workspace.isFetching} className="mt-2 min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>
    </div>}
    {workspace.data && !workspace.data.aiEnabled && <p role="status" className="shrink-0 rounded-md border border-warning bg-warning-bg p-2 text-sm text-fg">AI is off for this workspace. The workspace owner can enable it in Settings.</p>}

    {items.length > 0 && <section aria-label="Selected AI context" className="flex shrink-0 items-start gap-2">
      <ul className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-y-auto">{items.map((item, index) => <ContextLabel key={`${item.type}-${index}`} item={item} />)}</ul>
      <button type="button" onClick={clear} aria-label="Clear selected context" className="min-h-9 shrink-0 rounded-md px-2 text-xs font-medium text-ai hover:bg-ai-soft">Clear</button>
    </section>}

    <div className="flex shrink-0 gap-2">
      <button type="button" onClick={summarizeSelection} disabled={!workspaceId || !canUseAi || items.length !== 1 || requestPending} className="min-h-9 rounded-md border border-ai-soft-line bg-ai-soft px-3 text-xs font-semibold text-ai hover:bg-ai-soft disabled:cursor-not-allowed disabled:opacity-50">
        {summarize.isPending ? 'Summarizing…' : 'Summarize'}
      </button>
      <button type="button" aria-label="Break down a project" onClick={() => setIsBreakdownOpen(true)} disabled={!workspaceId || !canUseAi || requestPending} className="min-h-9 rounded-md border border-ai-soft-line bg-ai-soft px-3 text-xs font-semibold text-ai hover:bg-ai-soft disabled:cursor-not-allowed disabled:opacity-50">
        Break down
      </button>
    </div>

    <section aria-label="AI conversation" role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-line bg-surface-muted/40 p-3">
      {messages.map((message) => message.role === 'user'
        ? <div key={message.id} className="flex justify-end">
          <article aria-label="Your question" className="max-w-[90%] rounded-lg bg-primary-soft px-3 py-2 text-sm text-fg">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </article>
        </div>
        : <article key={message.id} role="region" aria-label={message.kind === 'summary' ? 'AI summary' : 'AI answer'} className="rounded-lg border border-ai-soft-line bg-ai-soft p-3 text-sm text-fg">
          {message.kind === 'summary' && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ai">Summary</h3>}
          <div className="break-words [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-ai [&_blockquote]:pl-3 [&_strong]:font-semibold">
            <AnswerMarkdown>{message.content}</AnswerMarkdown>
          </div>
          {message.provider && <p className="mt-2 border-t border-ai-soft-line pt-2 text-xs text-fg-muted">Answered by {message.provider}</p>}
        </article>)}
      {(ask.isPending || summarize.isPending) && <p role="status" className="rounded-md border border-line bg-surface p-3 text-sm text-fg-muted">Thinking…</p>}
      {error && <div role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm text-fg">
        <p>{errorText(error)}</p>
        {failedRequest && <button type="button" onClick={retryFailedRequest} disabled={requestPending} className="mt-2 min-h-11 rounded-md border border-line bg-surface px-3 font-medium hover:bg-surface-muted disabled:opacity-50">Try again</button>}
      </div>}
      <div ref={conversationEndRef} />
    </section>

    <form onSubmit={submitQuestion} className="flex shrink-0 flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea id={questionId} aria-label="Ask a question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={10000} rows={2} placeholder={hasConversation ? 'Ask a follow-up…' : 'Ask a question…'} className="min-h-11 min-w-0 flex-1 resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-faint focus-visible:ring-2 focus-visible:ring-focus" />
        <button type="submit" aria-label={hasConversation ? 'Send follow-up' : 'Ask AI'} disabled={!workspaceId || !canUseAi || items.length === 0 || !question.trim() || requestPending} className="min-h-11 shrink-0 rounded-md bg-ai px-4 text-sm font-semibold text-white hover:bg-ai-hover disabled:cursor-not-allowed disabled:opacity-50">
          {ask.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </form>
  </section>;

  return <>
    {isBreakdownOpen && workspaceId && <BreakdownDialog workspaceId={workspaceId} onClose={() => setIsBreakdownOpen(false)} />}
    {panel}
  </>;
}
