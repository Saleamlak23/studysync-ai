import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/api.js';
import { AiPanel } from './AiPanel.js';

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }));
vi.mock('@/shared/lib/api.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/api.js')>()),
  api: apiMock,
}));

function renderAiPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(['workspace-ai-consent', 'workspace-1'], { id: 'workspace-1', aiEnabled: true });
  return render(<QueryClientProvider client={client}><AiPanel workspaceId="workspace-1" /></QueryClientProvider>);
}

afterEach(() => {
  cleanup();
  apiMock.mockReset();
});

describe('BreakdownDialog', () => {
  it('FR-AI-04 / TC-AI-04: previews editable tasks without creating cards, then confirms selected edits', async () => {
    apiMock
      .mockResolvedValueOnce({ board: { id: 'board-1' }, lists: [{ id: 'list-1', name: 'To do', cards: [] }] })
      .mockResolvedValueOnce({
        provider: 'groq',
        items: [
          { title: 'Define roles', description: 'Initial roles', priority: 'HIGH' },
          { title: 'Create board', priority: 'MEDIUM' },
          { title: 'Write tests', priority: 'LOW' },
        ],
      })
      .mockResolvedValueOnce([]);
    renderAiPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Break down a project' }));

    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the project or goal' }), { target: { value: 'Build a study app' } });
    const generateButton = await screen.findByRole('button', { name: 'Generate preview' });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);
    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock.mock.calls.map(([path]) => path)).toEqual([
      '/workspaces/workspace-1/board',
      '/workspaces/workspace-1/ai/breakdown',
    ]);
    expect(await screen.findByRole('region', { name: 'Breakdown preview' })).toBeInTheDocument();
    expect(screen.getByText('Nothing is created until you confirm.')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/workspaces/workspace-1/ai/breakdown', {
      method: 'POST', body: { description: 'Build a study app', listId: 'list-1' },
    });
    expect(apiMock).toHaveBeenCalledTimes(2);

    fireEvent.change(screen.getByRole('textbox', { name: 'Title 1' }), { target: { value: 'Define team roles' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include Create board' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 cards' }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('/workspaces/workspace-1/ai/breakdown/confirm', {
      method: 'POST',
      body: { listId: 'list-1', items: [
        { title: 'Define team roles', description: 'Initial roles', priority: 'HIGH' },
        { title: 'Write tests', priority: 'LOW' },
      ] },
    }));
    expect(await screen.findByRole('button', { name: 'Break down a project' })).toBeInTheDocument();
  });

  it('FR-AI-09: keeps the preview intact when the explicit confirmation request fails', async () => {
    apiMock
      .mockResolvedValueOnce({ board: { id: 'board-1' }, lists: [{ id: 'list-1', name: 'To do', cards: [] }] })
      .mockResolvedValueOnce({ provider: 'groq', items: [
        { title: 'One' }, { title: 'Two' }, { title: 'Three' },
      ] })
      .mockRejectedValueOnce(new ApiError(502, 'AI_UNAVAILABLE', 'The AI could not answer. Nothing was changed. Try again.'));
    renderAiPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Break down a project' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the project or goal' }), { target: { value: 'Build a study app' } });
    const generateButton = await screen.findByRole('button', { name: 'Generate preview' });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);
    await screen.findByRole('region', { name: 'Breakdown preview' });
    fireEvent.click(screen.getByRole('button', { name: 'Create 3 cards' }));

    expect(await screen.findByText(/Your preview is still available/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Breakdown preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create 3 cards' })).toBeEnabled();
  });

  it('FR-AI-08 / TC-AI-08: shows a friendly breakdown error and allows retry without creating cards', async () => {
    apiMock
      .mockResolvedValueOnce({ board: { id: 'board-1' }, lists: [{ id: 'list-1', name: 'To do', cards: [] }] })
      .mockRejectedValueOnce(new ApiError(502, 'AI_UNAVAILABLE', 'The AI could not answer. Nothing was changed. Try again.'))
      .mockResolvedValueOnce({ provider: 'groq', items: [
        { title: 'One' }, { title: 'Two' }, { title: 'Three' },
      ] });
    renderAiPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Break down a project' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the project or goal' }), { target: { value: 'Build a study app' } });
    const generateButton = await screen.findByRole('button', { name: 'Generate preview' });
    await waitFor(() => expect(generateButton).toBeEnabled());
    fireEvent.click(generateButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI could not answer. Nothing was changed. Try again.');
    expect(apiMock).toHaveBeenCalledTimes(2);
    fireEvent.click(generateButton);
    expect(await screen.findByRole('region', { name: 'Breakdown preview' })).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(3);
    expect(apiMock.mock.calls.some(([path]) => path.endsWith('/breakdown/confirm'))).toBe(false);
  });

  it('TC-AI-04: gives an empty board an actionable list state', async () => {
    apiMock.mockResolvedValueOnce({ board: { id: 'board-1' }, lists: [] });
    renderAiPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Break down a project' }));
    expect(await screen.findByText('Create a board list before generating cards.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate preview' })).toBeDisabled();
  });
});
