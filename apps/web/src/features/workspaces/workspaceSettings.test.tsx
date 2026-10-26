import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, api } from '@/shared/lib/api.js';
import { clearSession, setSession } from '@/shared/lib/session.js';
import { WorkspaceSettingsPage } from './pages/WorkspaceSettingsPage.js';

vi.mock('@/shared/lib/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api.js')>();
  return { ...actual, api: vi.fn() };
});

const members = [
  { user: { id: 'owner-1', name: 'Aster Owner', email: 'owner@example.com', avatarUrl: null }, role: 'OWNER' as const, joinedAt: '2026-10-01T00:00:00.000Z' },
  { user: { id: 'admin-1', name: 'Bahir Admin', email: 'admin@example.com', avatarUrl: null }, role: 'ADMIN' as const, joinedAt: '2026-10-02T00:00:00.000Z' },
  { user: { id: 'member-1', name: 'Chaltu Member', email: 'member@example.com', avatarUrl: null }, role: 'MEMBER' as const, joinedAt: '2026-10-03T00:00:00.000Z' },
];
const invite = { id: 'invite-1', code: 'invite-code-1', expiresAt: null, createdAt: '2026-10-20T00:00:00.000Z' };
let currentRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER';
let aiEnabled = false;
let inviteCreated = false;
let inviteRevoked = false;
let currentMemberRole: 'ADMIN' | 'MEMBER' = 'MEMBER';
let removedMemberId: string | null = null;

const sessionUsers = {
  OWNER: { id: 'owner-1', name: 'Aster Owner', email: 'owner@example.com', avatarUrl: null, bio: null, systemRole: 'USER' as const },
  ADMIN: { id: 'admin-1', name: 'Bahir Admin', email: 'admin@example.com', avatarUrl: null, bio: null, systemRole: 'USER' as const },
  MEMBER: { id: 'member-1', name: 'Chaltu Member', email: 'member@example.com', avatarUrl: null, bio: null, systemRole: 'USER' as const },
};

function setupApi() {
  vi.mocked(api).mockImplementation(async (path, init) => {
    let result: unknown;
    if (path === '/workspaces/workspace-1') result = { id: 'workspace-1', name: 'StudySync Team', description: 'Course project', myRole: currentRole, aiEnabled };
    else if (path === '/workspaces/workspace-1/members') result = members
      .filter((member) => member.user.id !== removedMemberId)
      .map((member) => member.user.id === 'member-1' ? { ...member, role: currentMemberRole } : member);
    else if (path === '/workspaces/workspace-1/invites' && (!init?.method || init.method === 'GET')) result = inviteCreated && !inviteRevoked ? [invite] : [];
    else if (path === '/workspaces/workspace-1/members/member-1' && init?.method === 'PATCH') { currentMemberRole = (init.body as { role: 'ADMIN' | 'MEMBER' }).role; result = { ...members[2], role: currentMemberRole }; }
    else if (path.startsWith('/workspaces/workspace-1/members/') && init?.method === 'DELETE') {
      removedMemberId = path.slice('/workspaces/workspace-1/members/'.length);
      result = undefined;
    }
    else if (path === '/workspaces/workspace-1/invites' && init?.method === 'POST') { inviteCreated = true; result = { id: invite.id, code: invite.code, expiresAt: null }; }
    else if (path === '/workspaces/workspace-1/invites/invite-1' && init?.method === 'DELETE') { inviteRevoked = true; result = undefined; }
    else if (path === '/workspaces/workspace-1/ai-consent' && init?.method === 'PUT') { aiEnabled = (init.body as { enabled: boolean }).enabled; result = { aiEnabled, aiConsentAt: '2026-10-25T00:00:00.000Z' }; }
    else if (path === '/workspaces/workspace-1/archive' && init?.method === 'POST') result = { id: 'workspace-1', name: 'StudySync Team', description: null, myRole: currentRole, aiEnabled };
    else throw new Error('Unhandled mock request: ' + path);
    return result as never;
  });
}

function renderSettings() {
  setSession(sessionUsers[currentRole], 'test-access-token');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/w/workspace-1/settings']}>
        <Routes>
          <Route path="/w/:workspaceId/settings" element={<WorkspaceSettingsPage />} />
          <Route path="/workspaces" element={<p>Workspace list</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    currentRole = 'OWNER'; aiEnabled = false; inviteCreated = false; inviteRevoked = false; currentMemberRole = 'MEMBER'; removedMemberId = null;
    vi.clearAllMocks();
    setupApi();
  });
  afterEach(() => { cleanup(); clearSession(); });

  it('TC-WS-03: lets the owner change a member role', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    expect(screen.getByText('Your workspace role:')).toBeInTheDocument();
    expect(screen.getByText('Assigns roles, manages invites and AI consent, and archives the workspace.')).toBeInTheDocument();
    expect(screen.getByText(/System Admin is a separate platform role/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave workspace' })).not.toBeInTheDocument();
    fireEvent.change(await screen.findByRole('combobox', { name: 'Role for Chaltu Member' }), { target: { value: 'ADMIN' } });
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/members/member-1', { method: 'PATCH', body: { role: 'ADMIN' } }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Role for Chaltu Member' })).toHaveValue('ADMIN'));
  });

  it('TC-WS-03: hides owner-only actions from an admin', async () => {
    currentRole = 'ADMIN'; renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    expect(screen.queryByRole('combobox', { name: /Role for/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create invite link' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove Chaltu Member' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Aster Owner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive workspace' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enable AI for this workspace' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Leave workspace' })).toBeInTheDocument();
  });

  it('TC-WS-03: hides member-management actions from a regular member', async () => {
    currentRole = 'MEMBER'; renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    expect(screen.queryByRole('button', { name: 'Create invite link' })).not.toBeInTheDocument();
    await screen.findByText('Chaltu Member (you)');
    expect(screen.queryByRole('button', { name: /Remove / })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Role for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Invite links' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enable AI for this workspace' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Archive workspace' })).not.toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/workspaces/workspace-1/invites');
    expect(screen.getByRole('button', { name: 'Leave workspace' })).toBeInTheDocument();
  });

  it('TC-WS-04: lets a member leave after confirmation', async () => {
    currentRole = 'MEMBER';
    renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave workspace?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave workspace' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/members/member-1', { method: 'DELETE' }));
    expect(await screen.findByText('Workspace list')).toBeInTheDocument();
  });

  it('TC-WS-04: lets an admin leave without using member-removal controls', async () => {
    currentRole = 'ADMIN';
    renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    expect(screen.queryByRole('button', { name: 'Remove Bahir Admin' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave workspace' }));
    const dialog = screen.getByRole('dialog', { name: 'Leave workspace?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave workspace' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/members/admin-1', { method: 'DELETE' }));
    expect(await screen.findByText('Workspace list')).toBeInTheDocument();
  });

  it('TC-WS-04: asks before an admin removes a non-owner member', async () => {
    currentRole = 'ADMIN'; renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Chaltu Member' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove workspace member?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/members/member-1', { method: 'DELETE' }));
    await waitFor(() => expect(screen.queryByText('Chaltu Member')).not.toBeInTheDocument());
  });

  it('TC-WS-02: creates a no-expiry invite, copies its link, and revokes it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    await screen.findByText('No active invite links');
    fireEvent.click(screen.getByRole('button', { name: 'Create invite link' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/invites', { method: 'POST', body: {} }));
    const link = await screen.findByLabelText(/Invite link created/);
    expect(link).toHaveValue(window.location.origin + '/join/invite-code-1');
    expect(screen.getByText('No expiry')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.origin + '/join/invite-code-1'));
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke invite link' }));
    const dialog = screen.getByRole('dialog', { name: 'Revoke invite link?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke link' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/invites/invite-1', { method: 'DELETE' }));
    expect(await screen.findByText('No active invite links')).toBeInTheDocument();
  });

  it('TC-WS-06: updates AI consent through the documented endpoint', async () => {
    const { queryClient } = renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    queryClient.setQueryData(['workspace-ai-consent', 'workspace-1'], { id: 'workspace-1', aiEnabled: false });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable AI for this workspace' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/ai-consent', { method: 'PUT', body: { enabled: true } }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Enable AI for this workspace' })).toBeChecked());
    expect(queryClient.getQueryData(['workspace-ai-consent', 'workspace-1'])).toEqual({ id: 'workspace-1', aiEnabled: true });
  });

  it('TC-WS-05: confirms archiving and returns to the workspace list', async () => {
    renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Archive workspace' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive this workspace?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive workspace' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/workspaces/workspace-1/archive', { method: 'POST' }));
    expect(await screen.findByText('Workspace list')).toBeInTheDocument();
  });

  it('TC-WS-03: renders workspace loading and error states', async () => {
    vi.mocked(api).mockReturnValue(new Promise(() => undefined));
    renderSettings();
    expect(screen.getByRole('status', { name: 'Loading workspace settings' })).toBeInTheDocument();
    cleanup();

    vi.mocked(api).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'We could not find that.'));
    renderSettings();
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not find that.');
  });

  it('TC-WS-03: shows member and invite errors with retry controls', async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === '/workspaces/workspace-1') return { id: 'workspace-1', name: 'StudySync Team', description: null, myRole: currentRole, aiEnabled } as never;
      throw new Error('request failed');
    });
    renderSettings();
    await screen.findByRole('heading', { name: 'StudySync Team settings' });
    expect(await screen.findByText('We could not load workspace members. Try again.')).toBeInTheDocument();
    expect(await screen.findByText('We could not load invite links. Try again.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(2);
  });
});
