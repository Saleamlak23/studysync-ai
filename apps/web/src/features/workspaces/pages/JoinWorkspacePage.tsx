import { useMutation } from '@tanstack/react-query';
import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '@/shared/lib/api.js';
import { Button } from '@/shared/ui/index.js';
import type { WorkspaceCreated } from './components/api.js';

export function JoinWorkspacePage() {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string>();
  const joinWorkspace = useMutation({
    mutationFn: () => api<WorkspaceCreated>(`/invites/${encodeURIComponent(code)}/join`, { method: 'POST' }),
    onSuccess: (workspace) => navigate(`/w/${workspace.id}`),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        setErrorMessage('This invite link is invalid, revoked, or expired.');
      } else if (error instanceof ApiError && error.status === 409) {
        setErrorMessage('You are already a member of this workspace.');
      } else {
        setErrorMessage(error instanceof ApiError ? error.message : 'We could not join this workspace. Try again.');
      }
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 p-4 text-fg sm:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Join a workspace</h1>
        <p className="mt-1 text-sm text-fg-muted">Use this invite link to join the team workspace.</p>
      </header>
      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger bg-danger-bg p-4">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
          <p>{errorMessage}</p>
        </div>
      )}
      <Button
        size="lg"
        variant="primary"
        loading={joinWorkspace.isPending}
        onClick={() => {
          setErrorMessage(undefined);
          joinWorkspace.mutate();
        }}
      >
        Join workspace
      </Button>
    </main>
  );
}
