import { WorkspaceActions } from './components/WorkspaceActions.js';
import { WorkspaceList } from './components/WorkspaceList.js';

export function WorkspacesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 text-fg sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-sm text-fg-muted">Study and plan with your team.</p>
        </div>
        <WorkspaceActions />
      </header>
      <WorkspaceList />
    </main>
  );
}
