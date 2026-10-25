import { useEffect, useState, type FormEvent } from 'react';
import { createListBody, patchListBody } from '@studysync/shared';
import { ApiError } from '@/shared/lib/api.js';
import type { BoardList } from '../board.api.js';
import { Button, Dialog, Input } from '@/shared/ui/index.js';

type BoardListDialogProps = {
  open: boolean;
  list: BoardList | null;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
};

export function BoardListDialog({ open, list, onOpenChange, onSave }: BoardListDialogProps) {
  const [name, setName] = useState(list?.name ?? '');
  const [validationError, setValidationError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(list);

  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? '');
    setValidationError('');
    setRequestError('');
  }, [open, list]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError('');
    const schema = editing ? patchListBody : createListBody;
    const parsed = schema.safeParse({ name });
    if (!parsed.success) {
      setValidationError('Enter a list name.');
      return;
    }

    setValidationError('');
    setSaving(true);
    try {
      await onSave(parsed.data.name);
      onOpenChange(false);
    } catch (error) {
      setRequestError(error instanceof ApiError ? error.message : 'We could not save this list. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}
      title={editing ? 'Rename list' : 'Create list'}
      description={editing ? 'Choose a name for this board list.' : 'Add a new list to this board.'}
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Input
          label="List name"
          name="name"
          autoFocus
          value={name}
          onChange={(event) => { setName(event.target.value); setValidationError(''); }}
          error={validationError}
          required
        />
        {requestError && <p role="alert" className="text-sm text-danger">{requestError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" size="lg" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" size="lg" loading={saving}>
            {editing ? 'Save list' : 'Create list'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
