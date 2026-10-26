import type { AdminUsersQuery } from '@studysync/shared';
import { useState } from 'react';
import { ApiError } from '@/shared/lib/api.js';
import { Badge, Button, Card, EmptyState, Input, Skeleton, useToast } from '@/shared/ui';
import { useAdminUsers, useUpdateAdminUserStatus } from '@/features/admin';

const USERS_LIMIT = 50;

export function AdminUsersPanel() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdminUsersQuery['status']>();
  const query: AdminUsersQuery = { q: search.trim() || undefined, status, limit: USERS_LIMIT };
  const users = useAdminUsers(query);
  const updateStatus = useUpdateAdminUserStatus();
  const { toast } = useToast();

  function changeStatus(userId: string, nextStatus: 'ACTIVE' | 'SUSPENDED') {
    updateStatus.mutate(
      { userId, status: nextStatus },
      {
        onSuccess: () => toast('User status updated.', { variant: 'success' }),
        onError: (error) =>
          toast(error instanceof ApiError ? error.message : 'We could not update this user. Try again.', {
            variant: 'error',
          }),
      },
    );
  }

  const clearFilters = () => {
    setSearch('');
    setStatus(undefined);
  };

  return (
    <section aria-labelledby="admin-users-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-users-heading" className="text-lg font-semibold">
          Users
        </h2>
        <p className="text-sm text-fg-muted">Search accounts and manage access.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Input
            id="admin-user-search"
            label="Search by name or email"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or email"
          />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-fg" htmlFor="admin-user-status">
            Account status
            <select
              id="admin-user-status"
              className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-fg md:h-10"
              value={status ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                setStatus(value === 'ACTIVE' || value === 'SUSPENDED' ? value : undefined);
              }}
            >
              <option value="">All users</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </label>
        </div>

        {users.isPending ? (
          <div role="status" aria-label="Loading users" className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : users.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p className="text-sm text-danger">
              {users.error instanceof ApiError ? users.error.message : 'We could not load users. Try again.'}
            </p>
            <Button onClick={() => void users.refetch()}>Try again</Button>
          </div>
        ) : users.data.length === 0 ? (
          <EmptyState
            title="No users found."
            description="Try another name, email, or status filter."
            action={
              (search || status) && (
                <Button onClick={clearFilters}>Clear filters</Button>
              )
            }
          />
        ) : (
          <ul className="flex flex-col gap-2" aria-label="User accounts">
            {users.data.map((user) => {
              const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
              const busy =
                updateStatus.isPending && updateStatus.variables?.userId === user.id;

              return (
                <li key={user.id}>
                  <Card variant="tile" className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-fg">{user.name}</p>
                      <p className="break-all text-sm text-fg-muted">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2" aria-label="Platform role">
                      <span className="text-xs text-fg-muted">Platform role</span>
                      <Badge>{user.systemRole === 'ADMIN' ? 'System Admin' : 'User'}</Badge>
                    </div>
                    <Badge variant={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                      {user.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                    </Badge>
                    <Button
                      variant={user.status === 'ACTIVE' ? 'danger' : 'secondary'}
                      className="min-h-(--size-touch)"
                      loading={busy}
                      disabled={updateStatus.isPending && !busy}
                      onClick={() => changeStatus(user.id, nextStatus)}
                    >
                      {user.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
