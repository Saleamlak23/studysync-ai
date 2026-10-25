import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/shared/lib/api.js';
import { Button, Dialog } from '@/shared/ui/index.js';
import { useArchiveWorkspace } from './api.js';

export function WorkspaceArchiveSection({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const archiveWorkspace = useArchiveWorkspace(workspaceId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  function archive() {
    setErrorMessage(undefined);
    archiveWorkspace.mutate(undefined, {
      onSuccess: () => navigate('/workspaces'),
      onError: (error) => setErrorMessage(
        error instanceof ApiError ? error.message : 'We could not archive this workspace. Try again.',
      ),
    });
  }

  return (
    <section aria-labelledby="workspace-archive-heading" className="space-y-3 rounded-lg border border-danger bg-surface p-4 sm:p-5">
      <div>
        <h2 id="workspace-archive-heading" className="text-lg font-semibold text-fg">Danger zone</h2>
        <p className="mt-1 text-sm text-fg-muted">Archiving hides the workspace. It can be restored within 30 days.</p>
      </div>
      {errorMessage && <p role="alert" className="text-sm text-danger">{errorMessage}</p>}
      <Button variant="danger" size="lg" onClick={() => setDialogOpen(true)}>Archive workspace</Button>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => { if (!open && !archiveWorkspace.isPending) setDialogOpen(false); }}
        title="Archive this workspace?"
        description="The workspace will disappear from your list. You can restore it within 30 days."
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" onClick={() => setDialogOpen(false)} disabled={archiveWorkspace.isPending}>Cancel</Button>
          <Button size="lg" variant="danger" loading={archiveWorkspace.isPending} onClick={archive}>Archive workspace</Button>
        </div>
      </Dialog>
    </section>
  );
}
