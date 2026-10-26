import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/api.js';
import { aiContext } from '@/shared/stores/aiContext.js';
import { AiPanel } from '@/features/ai';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/shared/lib/api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/api.js')>()),
  api: apiMock,
}));

function renderPanel(aiEnabled = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(['workspace-ai-consent', 'workspace-1'], { id: 'workspace-1', aiEnabled });
  return render(<QueryClientProvider client={queryClient}><AiPanel workspaceId="workspace-1" /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  aiContext.clear();
  apiMock.mockReset();
});

describe('AiPanel', () => {
  it('TC-AI-02: explains privacy and disables requests until context is selected', () => {
    renderPanel();

    expect(screen.getByText(/sent to third-party AI providers, whose terms apply/)).toBeInTheDocument();
    expect(screen.getByText(/Select a card, message range or file/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled();
    expect(screen.getByText('Select workspace content and enter a question to enable Ask AI.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summarize selected item' })).toBeDisabled();
  });

  it('TC-AI-06: explains disabled workspace consent and prevents content requests', () => {
    aiContext.select([{ type: 'card', id: 'card-1', label: 'Plan the release' }]);
    renderPanel(false);

    expect(screen.getByText(/AI is off for this workspace/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Summarize selected item' })).toBeDisabled();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('TC-AI-02: asks with selected contexts and excludes client-only labels from the request', async () => {
    aiContext.select([
      { type: 'card', id: 'card-1', label: 'Plan the release' },
      { type: 'message_range', channelId: 'channel-1', fromId: 'message-1', toId: 'message-2', label: 'Team discussion' },
    ]);
    apiMock.mockResolvedValue({ answer: 'The team plans a release.', provider: 'groq' });
    renderPanel();

    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question' }), { target: { value: 'What is the plan?' } });
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(await screen.findByRole('region', { name: 'AI answer' })).toHaveTextContent('The team plans a release.');
    expect(apiMock).toHaveBeenCalledWith('/workspaces/workspace-1/ai/ask', {
      method: 'POST',
      body: {
        question: 'What is the plan?',
        context: [
          { type: 'card', id: 'card-1' },
          { type: 'message_range', channelId: 'channel-1', fromId: 'message-1', toId: 'message-2' },
        ],
      },
    });
  });

  it('TC-AI-03: summarizes one selected item using the documented target shape', async () => {
    aiContext.select([{ type: 'file', id: 'file-1', label: 'Study guide.pdf' }]);
    apiMock.mockResolvedValue({ summary: 'A short study guide.', provider: 'gemini' });
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Summarize selected item' }));

    expect(await screen.findByRole('region', { name: 'AI summary' })).toHaveTextContent('A short study guide.');
    expect(apiMock).toHaveBeenCalledWith('/workspaces/workspace-1/ai/summarize', {
      method: 'POST',
      body: { target: { type: 'file', id: 'file-1' } },
    });
  });

  it('TC-AI-02: clears selected context on request', () => {
    aiContext.select([{ type: 'card', id: 'card-1', label: 'Plan the release' }]);
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByText(/Select a card, message range or file/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled();
  });

  it.each([
    ['TC-AI-06', 'AI_DISABLED', 403, 'The workspace owner has not enabled AI.'],
    ['TC-AI-07', 'AI_LIMIT_REACHED', 429, 'Daily AI limit reached. It resets at 12:00 PM.'],
    ['TC-AI-05', 'AI_UNAVAILABLE', 502, 'The AI could not answer. Nothing was changed. Try again.'],
  ])('%s: shows the safe %s response', async (_testId, code, status, message) => {
    aiContext.select([{ type: 'card', id: 'card-1', label: 'Plan the release' }]);
    apiMock.mockRejectedValue(new ApiError(status, code, message, code === 'AI_LIMIT_REACHED' ? { resetAt: '2026-10-24T12:00:00.000Z' } : undefined));
    renderPanel();

    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question' }), { target: { value: 'What is the plan?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByText('private server detail')).not.toBeInTheDocument();
    if (code === 'AI_DISABLED') {
      expect(screen.getByText(/AI is off for this workspace/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled();
    }
  });
});
