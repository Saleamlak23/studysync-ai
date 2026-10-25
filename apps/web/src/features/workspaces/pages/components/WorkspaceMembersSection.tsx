import { useState } from 'react';
import type { WorkspaceRole } from '@studysync/shared';
import { ApiError } from '@/shared/lib/api.js';
import { Button, Dialog, EmptyState } from '@/shared/ui/index.js';
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
  const membersQuery = useWorkspaceMembers(workspaceId);
  const updateRole = useUpdateWorkspaceMemberRole(workspaceId);
  const removeMember = useRemoveWorkspaceMember(workspaceId);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string>();
  const [removeError, setRemoveError] = useState<string>();
  const canManageMembers = role === 'OWNER' || role === 'ADMIN';
  const canChangeRoles = role === 'OWNER';
  const selectedMember = membersQuery.data?.find((member) => member.user.id === memberToRemove);

  function confirmRemove() {
    if (!memberToRemove) return;
    setRemoveError(undefined);
    removeMember.mutate(memberToRemove, {
      onSuccess: () => setMemberToRemove(null),
      onError: (error) => setRemoveError(errorText(error, 'We could not remove this member. Try again.')),
    });
  }

  return (
    <section aria-labelledby="workspace-members-heading" className="space-y-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <header>
        <h2 id="workspace-members-heading" className="text-lg font-semibold text-fg">Members</h2>
        <p className="mt-1 text-sm text-fg-muted">Manage workspace roles and access.</p>
      </header>

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
          <ul className="space-y-2">
            {membersQuery.data.map((member) => {
              const isOwner = member.role === 'OWNER';
              return (
                <li key={member.user.id} className="flex min-w-0 flex-col gap-3 rounded-md border border-line p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-fg">{member.user.name}</p>
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
                      <span className="rounded-sm bg-surface-muted px-2 py-1 text-xs font-medium text-fg-muted">
                        {member.role.toLowerCase()}
                      </span>
                    )}
                    {canManageMembers && !isOwner && (
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
    </section>
  );
}
