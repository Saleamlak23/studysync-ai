import { CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/shared/lib/api.js';
import { Button, EmptyState } from '@/shared/ui/index.js';
import { useWorkspaces } from './api.js';

export function WorkspaceList() {
  const { data, error, isPending, isError, refetch, isFetching } = useWorkspaces();

  if (isPending) {
    return (
      <div role="status" aria-label="Loading workspaces" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} aria-hidden="true" className="h-24 animate-pulse rounded-lg border border-line bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger bg-danger-bg p-4 text-fg">
        <div className="flex items-start gap-2">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
          <p>{error instanceof ApiError ? error.message : 'We could not load your workspaces. Try again.'}</p>
        </div>
        <Button onClick={() => void refetch()} disabled={isFetching}>Try again</Button>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <section className="rounded-lg border border-line bg-surface">
        <EmptyState
          title="No workspaces yet"
          description="Create a workspace or join one with an invite link to get started."
        />
      </section>
    );
  }

  return (
    <ul aria-label="Your workspaces" className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((workspace) => (
        <li key={workspace.id} className="min-w-0">
          <Link
            to={`/w/${workspace.id}`}
            className="block h-full min-h-24 rounded-lg border border-line bg-surface p-4 shadow-sm transition-colors duration-(--duration-fast) hover:border-line-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="block break-words font-semibold text-fg">{workspace.name}</span>
            {workspace.description && <span className="mt-1 block break-words text-sm text-fg-muted">{workspace.description}</span>}
            <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-fg-muted">
              <span>{workspace.myRole.toLowerCase()}</span>
              <span>{workspace.memberCount} {workspace.memberCount === 1 ? 'member' : 'members'}</span>
              <span>{workspace.openCardCount} open {workspace.openCardCount === 1 ? 'task' : 'tasks'}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
