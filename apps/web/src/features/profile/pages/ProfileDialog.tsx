import { useEffect, useState, type FormEvent } from 'react';
import { patchProfileBody } from '@studysync/shared';
import { getAccessToken } from '@/shared/lib/api.js';
import { restoreSession, setSession, type SessionUser } from '@/shared/lib/session.js';
import { Avatar, Button, Dialog, Input } from '@/shared/ui/index.js';
import { updateProfile } from './profile.api.js';

type ProfileDialogProps = {
  user: SessionUser;
  onClose: () => void;
};

type FieldErrors = Partial<Record<'name' | 'bio' | 'avatarUrl', string>>;

export function ProfileDialog({ user, onClose }: ProfileDialogProps) {
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setBio(user.bio ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user?.id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError('');
    setSaved(false);

    const input = {
      name,
      bio: bio.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
    };
    const parsed = patchProfileBody.safeParse(input);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === 'name' || field === 'bio' || field === 'avatarUrl') && !nextErrors[field]) {
          nextErrors[field] = field === 'name'
            ? 'Enter your name.'
            : field === 'avatarUrl'
              ? 'Enter a valid avatar URL.'
              : 'Bio must be 500 characters or fewer.';
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const updatedUser = await updateProfile(parsed.data);
      const token = getAccessToken();
      if (token) setSession(updatedUser, token);
      else await restoreSession();
      setName(updatedUser.name);
      setBio(updatedUser.bio ?? '');
      setAvatarUrl(updatedUser.avatarUrl ?? '');
      setSaved(true);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Edit profile"
      description="Update the name, bio, and avatar your teammates see."
      className="max-h-[min(100dvh,48rem)] overflow-y-auto sm:rounded-xl"
    >
      <form className="flex min-h-0 flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="flex items-center gap-4 rounded-lg bg-surface-muted p-4">
          <Avatar name={name.trim() || user.name} alt="Avatar preview" src={avatarUrl.trim() || null} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg">Avatar preview</p>
            <p className="break-all text-xs text-fg-muted">{avatarUrl.trim() || 'Using your initials'}</p>
          </div>
        </div>

        <Input
          label="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => { setName(event.target.value); setFieldErrors((errors) => ({ ...errors, name: undefined })); }}
          error={fieldErrors.name}
          maxLength={80}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-bio" className="text-sm font-medium text-fg">Bio</label>
          <textarea
            id="profile-bio"
            name="bio"
            value={bio}
            onChange={(event) => { setBio(event.target.value); setFieldErrors((errors) => ({ ...errors, bio: undefined })); }}
            maxLength={500}
            rows={4}
            aria-invalid={Boolean(fieldErrors.bio)}
            aria-describedby={fieldErrors.bio ? 'profile-bio-error' : undefined}
            className="min-h-24 w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:border-primary focus-visible:outline-2 focus-visible:outline-primary"
            placeholder="A little about you"
          />
          {fieldErrors.bio && <p id="profile-bio-error" className="text-xs text-danger">{fieldErrors.bio}</p>}
          <p className="text-right text-xs text-fg-faint">{bio.length}/500</p>
        </div>

        <div className="flex flex-col gap-2">
          <Input
            label="Avatar URL"
            name="avatarUrl"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={avatarUrl}
            onChange={(event) => { setAvatarUrl(event.target.value); setFieldErrors((errors) => ({ ...errors, avatarUrl: undefined })); }}
            error={fieldErrors.avatarUrl}
            placeholder="https://example.com/avatar.png"
          />
          {avatarUrl && (
            <Button type="button" variant="ghost" className="self-start" onClick={() => { setAvatarUrl(''); setFieldErrors((errors) => ({ ...errors, avatarUrl: undefined })); }}>
              Remove avatar
            </Button>
          )}
        </div>

        {apiError && <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{apiError}</p>}
        {saved && <p role="status" className="text-sm text-success">Profile saved.</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="lg" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" size="lg" loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
