import { CircleAlert } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { ApiError } from '@/shared/lib/api.js';
import { Button } from '@/shared/ui/index.js';
import { WorkspaceAiConsentSection } from './components/WorkspaceAiConsentSection.js';
import { WorkspaceArchiveSection } from './components/WorkspaceArchiveSection.js';
import { WorkspaceInvitesSection } from './components/WorkspaceInvitesSection.js';
import { WorkspaceMembersSection } from './components/WorkspaceMembersSection.js';
import { useWorkspaceSettings } from './components/api.js';

export function WorkspaceSettingsPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const { data, error, isPending, isError, refetch, isFetching } = useWorkspaceSettings(workspaceId);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-4 text-fg sm:p-6">
      {isPending ? (
        <div role="status" aria-label="Loading workspace settings" className="space-y-4">
          <div aria-hidden="true" className="h-8 w-56 animate-pulse rounded bg-surface-muted" />
          {[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="h-36 animate-pulse rounded-lg border border-line bg-surface-muted" />)}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger bg-danger-bg p-4">
          <div className="flex items-start gap-2">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
            <p>{error instanceof ApiError ? error.message : 'We could not load workspace settings. Try again.'}</p>
          </div>
          <Button size="lg" onClick={() => void refetch()} disabled={isFetching}>Try again</Button>
        </div>
      ) : data ? (
        <>
          <header>
            <h1 className="break-words text-2xl font-bold tracking-tight">{data.name} settings</h1>
            {data.description && <p className="mt-1 break-words text-sm text-fg-muted">{data.description}</p>}
          </header>
          <WorkspaceMembersSection workspaceId={workspaceId} role={data.myRole} />
          <WorkspaceInvitesSection workspaceId={workspaceId} role={data.myRole} />
          <WorkspaceAiConsentSection workspaceId={workspaceId} role={data.myRole} enabled={data.aiEnabled} />
          {data.myRole === 'OWNER' && <WorkspaceArchiveSection workspaceId={workspaceId} />}
        </>
      ) : null}
    </main>
  );
}
