import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkspaceRole } from '@studysync/shared';
import { ApiError } from '@/shared/lib/api.js';
import { useSession } from '@/shared/lib/session.js';
import { Badge, Button, Dialog, EmptyState } from '@/shared/ui/index.js';
import {
  useRemoveWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useWorkspaceMembers,
} from './api.js';

function errorText(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function WorkspaceMembersSection({
  workspaceId,
  role,
}: {
  workspaceId: string;
  role: WorkspaceRole;
}) {
  const navigate = useNavigate();
  const session = useSession();
  const membersQuery = useWorkspaceMembers(workspaceId);
  const updateRole = useUpdateWorkspaceMemberRole(workspaceId);
  const removeMember = useRemoveWorkspaceMember(workspaceId);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [roleError, setRoleError] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const [leaveError, setLeaveError] = useState<string>();
  const canManageMembers = role === 'OWNER' || role === 'ADMIN';
  const canChangeRoles = role === 'OWNER';
  const currentUserId = session.status === 'authenticated' ? session.user.id : undefined;
  const canLeaveWorkspace = role !== 'OWNER' && Boolean(currentUserId);
  const selectedMember = membersQuery.data?.find((member) => member.user.id === memberToRemove);

  function confirmRemove() {
    if (!memberToRemove) return;
    setRemoveError(undefined);
    removeMember.mutate(memberToRemove, {
      onSuccess: () => setMemberToRemove(null),
      onError: (error) => setRemoveError(errorText(error, 'We could not remove this member. Try again.')),
    });
  }

  function confirmLeave() {
    if (!currentUserId) return;
    setLeaveError(undefined);
    removeMember.mutate(currentUserId, {
      onSuccess: () => navigate('/workspaces'),
      onError: (error) => setLeaveError(errorText(error, 'We could not leave this workspace. Try again.')),
    });
  }

  return (
    <section aria-labelledby="workspace-members-heading" className="space-y-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <header>
        <h2 id="workspace-members-heading" className="text-lg font-semibold text-fg">Members</h2>
        <p className="mt-1 text-sm text-fg-muted">Manage workspace roles and access.</p>
      </header>

      <section aria-labelledby="workspace-role-guide-heading" className="space-y-2 rounded-md border border-line bg-surface-muted p-3">
        <h3 id="workspace-role-guide-heading" className="text-sm font-semibold text-fg">Workspace role guide</h3>
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
          Your workspace role: <Badge>{role[0] + role.slice(1).toLowerCase()}</Badge>
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-fg">Owner</dt>
            <dd className="text-fg-muted">Assigns roles, manages invites and AI consent, and archives the workspace.</dd>
          </div>
          <div>
            <dt className="font-semibold text-fg">Admin</dt>
            <dd className="text-fg-muted">Manages invites and members, but not role assignments, AI consent, or archiving.</dd>
          </div>
          <div>
            <dt className="font-semibold text-fg">Member</dt>
            <dd className="text-fg-muted">Collaborates on workspace content.</dd>
          </div>
        </dl>
        <p className="text-xs text-fg-muted">
          Non-owners can leave the workspace. System Admin is a separate platform role and does not grant workspace access.
        </p>
      </section>

      {membersQuery.isPending ? (
        <div role="status" aria-label="Loading workspace members" className="space-y-2">
          {[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="h-16 animate-pulse rounded-md bg-surface-muted" />)}
        </div>
      ) : membersQuery.isError ? (
        <div role="alert" className="space-y-3 rounded-md border border-danger bg-danger-bg p-3">
          <p>{errorText(membersQuery.error, 'We could not load workspace members. Try again.')}</p>
          <Button size="lg" onClick={() => void membersQuery.refetch()} disabled={membersQuery.isFetching}>Try again</Button>
        </div>
      ) : !membersQuery.data.length ? (
        <div className="rounded-md border border-dashed border-line-strong bg-surface-muted">
          <EmptyState title="No members to show" />
        </div>
      ) : (
        <>
          {roleError && <p role="alert" className="text-sm text-danger">{roleError}</p>}
          {removeError && <p role="alert" className="text-sm text-danger">{removeError}</p>}
          {leaveError && <p role="alert" className="text-sm text-danger">{leaveError}</p>}
          <ul className="space-y-2">
            {membersQuery.data.map((member) => {
              const isOwner = member.role === 'OWNER';
              const isCurrentUser = member.user.id === currentUserId;
              return (
                <li key={member.user.id} className="flex min-w-0 flex-col gap-3 rounded-md border border-line p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-fg">{member.user.name}{isCurrentUser ? ' (you)' : ''}</p>
                    <p className="break-all text-sm text-fg-muted">{member.user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canChangeRoles && !isOwner ? (
                      <label className="flex min-h-11 items-center gap-2 text-sm text-fg-muted">
                        <span className="sr-only">Role for {member.user.name}</span>
                        <select
                          aria-label={`Role for ${member.user.name}`}
                          className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-fg focus:border-primary"
                          value={member.role}
                          disabled={updateRole.isPending}
                          onChange={(event) => {
                            setRoleError(undefined);
                            updateRole.mutate(
                              { userId: member.user.id, role: event.target.value as 'ADMIN' | 'MEMBER' },
                              { onError: (error) => setRoleError(errorText(error, 'We could not update this role. Try again.')) },
                            );
                          }}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </label>
                    ) : (
                      <Badge>{member.role[0] + member.role.slice(1).toLowerCase()}</Badge>
                    )}
                    {canManageMembers && !isOwner && !isCurrentUser && (
                      <Button
                        variant="danger"
                        size="lg"
                        disabled={removeMember.isPending}
                        onClick={() => {
                          setRemoveError(undefined);
                          setMemberToRemove(member.user.id);
                        }}
                      >
                        Remove {member.user.name}
                      </Button>
                    )}
                    {isOwner && <span className="text-xs text-fg-muted">Workspace owner</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {canLeaveWorkspace && (
        <div className="border-t border-line pt-3">
          <Button
            variant="danger"
            size="lg"
            disabled={removeMember.isPending}
            onClick={() => {
              setLeaveError(undefined);
              setLeaveDialogOpen(true);
            }}
          >
            Leave workspace
          </Button>
        </div>
      )}

      <Dialog
        open={Boolean(selectedMember)}
        onOpenChange={(open) => { if (!open && !removeMember.isPending) setMemberToRemove(null); }}
        title="Remove workspace member?"
        description={selectedMember ? `${selectedMember.user.name} will lose access to this workspace.` : undefined}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" onClick={() => setMemberToRemove(null)} disabled={removeMember.isPending}>Cancel</Button>
          <Button size="lg" variant="danger" loading={removeMember.isPending} onClick={confirmRemove}>Remove member</Button>
        </div>
      </Dialog>
      <Dialog
        open={leaveDialogOpen}
        onOpenChange={(open) => { if (!open && !removeMember.isPending) setLeaveDialogOpen(false); }}
        title="Leave workspace?"
        description="You will lose access to this workspace."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" onClick={() => setLeaveDialogOpen(false)} disabled={removeMember.isPending}>Cancel</Button>
          <Button size="lg" variant="danger" loading={removeMember.isPending} onClick={confirmLeave}>Leave workspace</Button>
        </div>
      </Dialog>
    </section>
  );
}
