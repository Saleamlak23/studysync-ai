import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api, ApiError } from '@/shared/lib/api.js';
import { CreateWorkspaceDialog } from './pages/components/CreateWorkspaceDialog.js';
import { inviteCodeFromLink, WorkspaceActions } from './pages/components/WorkspaceActions.js';
import { WorkspaceList } from './pages/components/WorkspaceList.js';
import { JoinWorkspacePage } from './pages/JoinWorkspacePage.js';
import { WorkspacesPage } from './pages/WorkspacesPage.js';

vi.mock('@/shared/lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api.js')>();
  return { ...actual, api: vi.fn() };
});

const workspace = {
  id: 'c747bd88-98c9-4d47-86dd-08c79f801c25',
  name: 'Study Group',
  description: 'Prepare for exams together',
  myRole: 'OWNER' as const,
  memberCount: 1,
  openCardCount: 3,
};

function renderWithProviders(ui: React.ReactNode, initialEntries = ['/workspaces']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/workspaces" element={ui} />
          <Route path="/join/:code" element={<JoinWorkspacePage />} />
          <Route path="/w/:workspaceId" element={<p>Workspace opened</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('workspaces', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it('TC-WS-01: shows a loading state while workspaces are requested', async () => {
    vi.mocked(api).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<WorkspaceList />);
    expect(screen.getByRole('status', { name: 'Loading workspaces' })).toBeInTheDocument();
  });

  it('TC-WS-01: shows the empty state when the user has no workspaces', async () => {
    vi.mocked(api).mockResolvedValue([]);
    renderWithProviders(<WorkspaceList />);
    expect(await screen.findByText('No workspaces yet')).toBeInTheDocument();
  });

  it('TC-WS-01: shows an error and retries before rendering workspace content', async () => {
    vi.mocked(api)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce([workspace]);
    renderWithProviders(<WorkspaceList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not load your workspaces. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /Study Group/ })).toHaveAttribute('href', '/w/c747bd88-98c9-4d47-86dd-08c79f801c25');
    expect(screen.getByText('owner')).toBeInTheDocument();
    expect(screen.getByText('1 member')).toBeInTheDocument();
    expect(screen.getByText('3 open tasks')).toBeInTheDocument();
  });

  it('TC-WS-01: validates workspace name and creates with normalized data', async () => {
    vi.mocked(api).mockResolvedValue(workspace);
    renderWithProviders(<WorkspacesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'New workspace' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
    expect(await screen.findByText('Workspace name must be between 1 and 80 characters.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/workspaces', expect.anything());

    fireEvent.change(screen.getByLabelText('Workspace name'), { target: { value: '  Study Group  ' } });
    fireEvent.change(screen.getByLabelText('Description (optional)'), { target: { value: 'Prepare together' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces', {
      method: 'POST',
      body: { name: 'Study Group', description: 'Prepare together' },
    }));
    expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
  });

  it('TC-WS-01: exports a controlled create dialog for dashboard integration', () => {
    renderWithProviders(
      <CreateWorkspaceDialog open onOpenChange={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: 'Create a workspace' })).toBeInTheDocument();
  });

  it('TC-WS-02: joins through an invite link and opens the joined workspace', async () => {
    vi.mocked(api).mockResolvedValue(workspace);
    renderWithProviders(<JoinWorkspacePage />, ['/join/INVITE123']);
    fireEvent.click(screen.getByRole('button', { name: 'Join workspace' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/invites/INVITE123/join', { method: 'POST' }));
    expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
  });

  it('TC-WS-02: shows a pending state while the invite is being accepted', async () => {
    vi.mocked(api).mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<JoinWorkspacePage />, ['/join/INVITE123']);
    fireEvent.click(screen.getByRole('button', { name: 'Join workspace' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Join workspace' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Join workspace' })).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('TC-WS-02: turns a pasted invite URL into the internal join route', async () => {
    vi.mocked(api).mockResolvedValue(workspace);
    renderWithProviders(<WorkspaceActions />);

    fireEvent.click(screen.getByRole('button', { name: 'Join with invite link' }));
    fireEvent.change(screen.getByLabelText('Invite link'), {
      target: { value: 'https://studysync.example/join/INVITE123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Join workspace' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/invites/INVITE123/join', { method: 'POST' }));
    expect(await screen.findByText('Workspace opened')).toBeInTheDocument();
  });

  it('TC-WS-02: accepts only an invite route when parsing a pasted link', () => {
    expect(inviteCodeFromLink('https://studysync.example/join/INVITE123')).toBe('INVITE123');
    expect(inviteCodeFromLink('https://studysync.example/w/workspace-1')).toBeNull();
    expect(inviteCodeFromLink('not a link')).toBeNull();
  });

  it.each([
    [404, 'NOT_FOUND', 'This invite link is invalid, revoked, or expired.'],
    [409, 'CONFLICT', 'You are already a member of this workspace.'],
  ])('TC-WS-02: explains a join response with status %s', async (status, code, message) => {
    vi.mocked(api).mockRejectedValue(new ApiError(status, code, 'Server message'));
    renderWithProviders(<JoinWorkspacePage />, ['/join/INVITE123']);
    fireEvent.click(screen.getByRole('button', { name: 'Join workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });
});
