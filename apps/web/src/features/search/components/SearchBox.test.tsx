import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '@/shared/lib/api.js';
import { SearchBox } from './SearchBox.js';

vi.mock('@/shared/lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api.js')>();
  return { ...actual, api: vi.fn() };
});

const results = {
  cards: [{ id: '11111111-1111-4111-8111-111111111111', title: 'Orchid plan', snippet: 'Plan the orchid report' }],
  messages: [{ id: '22222222-2222-4222-8222-222222222222', snippet: 'Discuss orchid research' }],
  files: [{ id: '33333333-3333-4333-8333-333333333333', name: 'orchid-notes.txt' }],
};

function renderSearchBox() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><SearchBox workspaceId="workspace-1" /></MemoryRouter></QueryClientProvider>);
}

describe('SearchBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('TC-SRCH-01: trims input, requires two characters, and debounces workspace search', async () => {
    vi.mocked(api).mockResolvedValue(results);
    renderSearchBox();
    const input = screen.getByRole('searchbox', { name: 'Search cards, messages, files' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: ' o ' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 320)); });
    expect(api).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '  orchid  ' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 250)); });
    expect(api).not.toHaveBeenCalled();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });

    expect(await screen.findByText('Orchid plan')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/search', { query: { q: 'orchid' } });
  });

  it('TC-SRCH-01: shows grouped card, message, and file results linked to their workspace areas', async () => {
    vi.mocked(api).mockResolvedValue(results);
    renderSearchBox();
    const input = screen.getByRole('searchbox', { name: 'Search cards, messages, files' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'orchid' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });

    expect(await screen.findByRole('heading', { name: 'Cards' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
    expect(screen.getByText('Plan the orchid report')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Orchid plan/ })).toHaveAttribute('href', '/w/workspace-1/board');
    expect(screen.getByRole('link', { name: /Discuss orchid research/ })).toHaveAttribute('href', '/w/workspace-1/chat');
    expect(screen.getByRole('link', { name: /orchid-notes.txt/ })).toHaveAttribute('href', '/w/workspace-1/chat');
  });

  it('TC-SRCH-01: shows a no-results state for an empty response', async () => {
    vi.mocked(api).mockResolvedValue({ cards: [], messages: [], files: [] });
    renderSearchBox();
    const input = screen.getByRole('searchbox', { name: 'Search cards, messages, files' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'missing' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(await screen.findByText('No results for “missing”')).toBeInTheDocument();
  });

  it('TC-SRCH-01: prompts for a minimum query and shows loading while results are pending', async () => {
    vi.mocked(api).mockReturnValue(new Promise(() => undefined));
    renderSearchBox();
    const input = screen.getByRole('searchbox', { name: 'Search cards, messages, files' });
    fireEvent.focus(input);
    expect(screen.getByText('Enter at least 2 characters to search this workspace.')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'orchid' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(screen.getByRole('status', { name: 'Searching' })).toBeInTheDocument();
  });

  it('TC-SRCH-01: displays a friendly request error and retries it', async () => {
    vi.mocked(api).mockRejectedValueOnce(new ApiError(500, 'INTERNAL', 'Something went wrong. Try again.')).mockResolvedValueOnce(results);
    renderSearchBox();
    const input = screen.getByRole('searchbox', { name: 'Search cards, messages, files' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'orchid' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Orchid plan')).toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('TC-SRCH-01: opens the mobile search dialog and closes it on Escape', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query === '(max-width: 767px)', media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    renderSearchBox();
    fireEvent.click(screen.getByRole('button', { name: 'Open workspace search' }));
    expect(screen.getByRole('dialog', { name: 'Search this workspace' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Search this workspace' })).not.toBeInTheDocument();
  });
});
