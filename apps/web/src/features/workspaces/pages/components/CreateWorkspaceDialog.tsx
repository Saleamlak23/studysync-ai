import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorkspaceBody } from '@studysync/shared';
import { api, ApiError } from '@/shared/lib/api.js';
import { Button, Dialog, Input } from '@/shared/ui/index.js';
import { workspaceKeys, type WorkspaceCreated } from './api.js';

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [requestError, setRequestError] = useState<string>();
  const createWorkspace = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      api<WorkspaceCreated>('/workspaces', { method: 'POST', body }),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list });
      navigate(`/w/${workspace.id}`);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(undefined);
    const result = createWorkspaceBody.safeParse({ name, ...(description ? { description } : {}) });
    if (!result.success) {
      setNameError('Workspace name must be between 1 and 80 characters.');
      return;
    }
    setNameError(undefined);
    createWorkspace.mutate(result.data, {
      onError: (error) => setRequestError(
        error instanceof ApiError ? error.message : 'We could not create the workspace. Try again.',
      ),
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && createWorkspace.isPending) return;
    if (!nextOpen) {
      setName('');
      setDescription('');
      setNameError(undefined);
      setRequestError(undefined);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} title="Create a workspace" description="Give your team a place to organize its work.">
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Input
          label="Workspace name"
          name="workspace-name"
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={nameError}
        />
        <Input
          label="Description (optional)"
          name="workspace-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {requestError && <p role="alert" className="text-sm text-danger">{requestError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" size="lg" onClick={() => handleOpenChange(false)} disabled={createWorkspace.isPending}>
            Cancel
          </Button>
          <Button type="submit" size="lg" variant="primary" loading={createWorkspace.isPending}>
            Create workspace
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
