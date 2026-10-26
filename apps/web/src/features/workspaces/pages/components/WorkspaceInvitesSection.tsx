import { useState } from 'react';
import type { WorkspaceRole } from '@studysync/shared';
import { ApiError } from '@/shared/lib/api.js';
import { Button, Dialog, EmptyState, Input } from '@/shared/ui/index.js';
import {
  useCreateWorkspaceInvite,
  useRevokeWorkspaceInvite,
  useWorkspaceInvites,
} from './api.js';

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function inviteUrl(code: string) {
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

export function WorkspaceInvitesSection({ workspaceId, role }: { workspaceId: string; role: WorkspaceRole }) {
  const canManageInvites = role === 'OWNER' || role === 'ADMIN';
  const invitesQuery = useWorkspaceInvites(workspaceId, canManageInvites);
  const createInvite = useCreateWorkspaceInvite(workspaceId);
  const revokeInvite = useRevokeWorkspaceInvite(workspaceId);
  const [inviteToRevoke, setInviteToRevoke] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string>();
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});
  const selectedInvite = invitesQuery.data?.find((invite) => invite.id === inviteToRevoke);

  if (!canManageInvites) return null;

  function handleCreateInvite() {
    setRequestError(undefined);
    createInvite.mutate(undefined, {
      onError: (error) => setRequestError(errorText(error, 'We could not create an invite link. Try again.')),
    });
  }

  async function copyInvite(id: string, code: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopyStatus((status) => ({ ...status, [id]: 'Copied' }));
    } catch {
      setCopyStatus((status) => ({ ...status, [id]: 'Copy failed. Select and copy the link above.' }));
    }
  }

  function confirmRevoke() {
    if (!inviteToRevoke) return;
    setRequestError(undefined);
    revokeInvite.mutate(inviteToRevoke, {
      onSuccess: () => setInviteToRevoke(null),
      onError: (error) => setRequestError(errorText(error, 'We could not revoke this invite link. Try again.')),
    });
  }

  return (
    <section aria-labelledby="workspace-invites-heading" className="space-y-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="workspace-invites-heading" className="text-lg font-semibold text-fg">Invite links</h2>
          <p className="mt-1 text-sm text-fg-muted">Share a link to invite someone as a workspace member.</p>
        </div>
        {canManageInvites && (
          <Button size="lg" variant="primary" loading={createInvite.isPending} onClick={handleCreateInvite}>
            Create invite link
          </Button>
        )}
      </header>

      {requestError && <p role="alert" className="text-sm text-danger">{requestError}</p>}
      {invitesQuery.isPending ? (
        <div role="status" aria-label="Loading invite links" className="space-y-2">
          {[0, 1].map((item) => <div key={item} aria-hidden="true" className="h-16 animate-pulse rounded-md bg-surface-muted" />)}
        </div>
      ) : invitesQuery.isError ? (
        <div role="alert" className="space-y-3 rounded-md border border-danger bg-danger-bg p-3">
          <p>{errorText(invitesQuery.error, 'We could not load invite links. Try again.')}</p>
          <Button size="lg" onClick={() => void invitesQuery.refetch()} disabled={invitesQuery.isFetching}>Try again</Button>
        </div>
      ) : !invitesQuery.data.length ? (
        <div className="rounded-md border border-dashed border-line-strong bg-surface-muted">
          <EmptyState title="No active invite links" description="Create a link to invite someone to this workspace." />
        </div>
      ) : (
        <ul className="space-y-2">
          {invitesQuery.data.map((invite) => (
            <li key={invite.id} className="flex min-w-0 flex-col gap-3 rounded-md border border-line p-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input id={`invite-link-${invite.id}`} label={`Invite link created ${new Date(invite.createdAt).toLocaleDateString()}`} value={inviteUrl(invite.code)} readOnly className="w-full" />
                  <p className="mt-1 text-xs text-fg-muted">
                    {invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleDateString()}` : 'No expiry'}
                  </p>
                  {copyStatus[invite.id] && <p role="status" className="mt-1 text-xs text-fg-muted">{copyStatus[invite.id]}</p>}
                </div>
                <Button size="lg" onClick={() => void copyInvite(invite.id, invite.code)}>Copy link</Button>
              </div>
              {canManageInvites && (
                <Button
                  variant="danger"
                  size="lg"
                  className="self-start"
                  disabled={revokeInvite.isPending}
                  onClick={() => {
                    setRequestError(undefined);
                    setInviteToRevoke(invite.id);
                  }}
                >
                  Revoke invite link
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(selectedInvite)}
        onOpenChange={(open) => { if (!open && !revokeInvite.isPending) setInviteToRevoke(null); }}
        title="Revoke invite link?"
        description="Anyone using this link will no longer be able to join the workspace."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" onClick={() => setInviteToRevoke(null)} disabled={revokeInvite.isPending}>Cancel</Button>
          <Button size="lg" variant="danger" loading={revokeInvite.isPending} onClick={confirmRevoke}>Revoke link</Button>
        </div>
      </Dialog>
    </section>
  );
}
