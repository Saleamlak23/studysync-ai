import { useState } from 'react';
import { Button } from '@/shared/ui/index.js';
import { CreateWorkspaceDialog } from './components/CreateWorkspaceDialog.js';
import { WorkspaceList } from './components/WorkspaceList.js';

export function WorkspacesPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 text-fg sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="mt-1 text-sm text-fg-muted">Study and plan with your team.</p>
        </div>
        <Button size="lg" variant="primary" onClick={() => setCreateOpen(true)}>
          New workspace
        </Button>
      </header>
      <WorkspaceList />
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </main>
  );
}
