import { useState } from 'react';
import type { WorkspaceRole } from '@studysync/shared';
import { ApiError } from '@/shared/lib/api.js';
import { useSetWorkspaceAiConsent } from './api.js';

export function WorkspaceAiConsentSection({
  workspaceId,
  role,
  enabled,
}: {
  workspaceId: string;
  role: WorkspaceRole;
  enabled: boolean;
}) {
  const setConsent = useSetWorkspaceAiConsent(workspaceId);
  const [errorMessage, setErrorMessage] = useState<string>();
  const canManage = role === 'OWNER';

  return (
    <section aria-labelledby="workspace-ai-heading" className="space-y-3 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div>
        <h2 id="workspace-ai-heading" className="text-lg font-semibold text-fg">AI features</h2>
        <p className="mt-1 text-sm text-fg-muted">Selected workspace content may be sent to third-party AI providers.</p>
      </div>
      <label className="flex min-h-11 items-start gap-3 rounded-md border border-line p-3 text-sm text-fg">
        <input
          aria-label="Enable AI for this workspace"
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={enabled}
          disabled={!canManage || setConsent.isPending}
          onChange={(event) => {
            setErrorMessage(undefined);
            setConsent.mutate(event.target.checked, {
              onError: (error) => setErrorMessage(
                error instanceof ApiError ? error.message : 'We could not update AI consent. Try again.',
              ),
            });
          }}
        />
        <span>Enable AI for this workspace</span>
      </label>
      {!canManage && <p className="text-xs text-fg-muted">Only the workspace owner can change AI consent.</p>}
      {errorMessage && <p role="alert" className="text-sm text-danger">{errorMessage}</p>}
      {setConsent.isPending && <p role="status" className="text-sm text-fg-muted">Saving AI consent…</p>}
    </section>
  );
}
