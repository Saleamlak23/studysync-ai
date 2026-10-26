import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Dialog, Input } from '@/shared/ui/index.js';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog.js';

export function inviteCodeFromLink(value: string): string | null {
  try {
    const inviteUrl = new URL(value.trim(), window.location.origin);
    const segments = inviteUrl.pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0] !== 'join') return null;
    const code = decodeURIComponent(segments[1]);
    return code.length > 0 && code.length <= 128 ? code : null;
  } catch {
    return null;
  }
}

function JoinWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [inviteLink, setInviteLink] = useState('');
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = inviteCodeFromLink(inviteLink);
    if (!code) {
      setError('Paste a valid workspace invite link.');
      return;
    }
    setError(undefined);
    onOpenChange(false);
    navigate(`/join/${encodeURIComponent(code)}`);
  }

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setInviteLink('');
      setError(undefined);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
      title="Join a workspace"
      description="Paste an invite link from a workspace administrator."
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Input
          id="workspace-invite-link"
          label="Invite link"
          type="url"
          autoComplete="url"
          value={inviteLink}
          onChange={(event) => {
            setInviteLink(event.target.value);
            setError(undefined);
          }}
          error={error}
          placeholder="https://studysync.example/join/…"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" size="lg" onClick={() => changeOpen(false)}>Cancel</Button>
          <Button type="submit" size="lg" variant="primary">Continue</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function WorkspaceActions({ compact = false }: { compact?: boolean }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <>
      <div className={compact ? 'flex flex-col gap-1' : 'flex flex-wrap items-center gap-2'}>
        <Button
          size={compact ? 'md' : 'lg'}
          variant="primary"
          className={compact ? 'w-full justify-start' : undefined}
          onClick={() => setCreateOpen(true)}
        >
          New workspace
        </Button>
        <Button
          size={compact ? 'md' : 'lg'}
          className={compact ? 'w-full justify-start' : undefined}
          onClick={() => setJoinOpen(true)}
        >
          Join with invite link
        </Button>
      </div>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinWorkspaceDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </>
  );
}
