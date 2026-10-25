import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createCardBody, createCommentBody, patchCardBody } from '@studysync/shared';
import { useSession } from '@/features/auth';
import { ApiError } from '@/shared/lib/api.js';
import { aiContext } from '@/shared/stores/aiContext.js';
import { Button, Dialog, Input } from '@/shared/ui/index.js';
import {
  useBoardCard, useBoardCardComments, useBoardCardLabels, useBoardCardMembers,
  useCreateBoardCard, useCreateBoardCardComment, useDeleteBoardCard,
  useDeleteBoardCardComment, useUpdateBoardCard,
} from '../board.api.js';

type Props = { open: boolean; onOpenChange: (open: boolean) => void; workspaceId: string; listId: string; listName: string; cardId: string | null; role: string | null | undefined };
const errorText = (error: unknown, fallback: string) => error instanceof ApiError ? error.message : fallback;
const mayAdmin = (role: string | null | undefined) => role === 'OWNER' || role === 'ADMIN';
const toLocalDateTime = (value: string) => {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function BoardCardDialog({ open, onOpenChange, workspaceId, listId, listName, cardId, role }: Props) {
  const session = useSession();
  const card = useBoardCard(open ? cardId : null);
  const comments = useBoardCardComments(open ? cardId : null);
  const members = useBoardCardMembers(workspaceId, open);
  const labels = useBoardCardLabels(workspaceId, open);
  const createCard = useCreateBoardCard(workspaceId);
  const updateCard = useUpdateBoardCard(workspaceId);
  const deleteCard = useDeleteBoardCard(workspaceId);
  const createComment = useCreateBoardCardComment(cardId ?? '');
  const deleteComment = useDeleteBoardCardComment(cardId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [validation, setValidation] = useState('');
  const [requestError, setRequestError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const editing = Boolean(cardId);
  const suggestions = useMemo(() => (members.data ?? []).filter((member) => member.user.name.toLowerCase().includes((mentionQuery ?? '').toLowerCase())), [members.data, mentionQuery]);

  useEffect(() => {
    if (!open) return;
    setTitle(card.data?.title ?? ''); setDescription(card.data?.description ?? '');
    setPriority(card.data?.priority ?? 'MEDIUM');
    setDueDate(card.data?.dueDate ? toLocalDateTime(card.data.dueDate) : '');
    setAssigneeIds(card.data?.assignees.map((item) => item.userId) ?? []);
    setLabelIds(card.data?.labels.map((item) => item.labelId) ?? []);
    setValidation(''); setRequestError(''); setBody(''); setMentionIds([]);
  }, [open, card.data, cardId]);

  useEffect(() => {
    if (open && card.data) aiContext.select([{ type: 'card', id: card.data.id, label: card.data.title }]);
  }, [open, card.data]);

  async function save(event: FormEvent) {
    event.preventDefault(); setRequestError('');
    const raw = { title, description: description || null, priority, dueDate: dueDate ? new Date(dueDate).toISOString() : null, assigneeIds, labelIds };
    const parsed = (editing ? patchCardBody : createCardBody).safeParse(raw);
    if (!parsed.success) { setValidation(parsed.error.issues[0]?.message ?? 'Check the card fields.'); return; }
    setValidation('');
    try {
      if (cardId) await updateCard.mutateAsync({ cardId, input: parsed.data });
      else {
        const created = await createCard.mutateAsync({ listId, input: parsed.data });
        aiContext.select([{ type: 'card', id: created.id, label: created.title }]);
      }
      onOpenChange(false);
    } catch (error) { setRequestError(errorText(error, 'We could not save this card. Try again.')); }
  }

  function updateComment(value: string) {
    setBody(value);
    const match = value.match(/(?:^|\s)@([^\s@]*)$/);
    setMentionQuery(match ? match[1] ?? '' : null);
    if (mentionIds.length && !value.includes('@')) setMentionIds([]);
  }

  function selectMention(member: (typeof suggestions)[number]) {
    const next = body.replace(/@[^\s@]*$/, `@${member.user.name} `);
    setBody(next); setMentionIds((current) => [...new Set([...current, member.user.id])]); setMentionQuery(null);
  }

  async function sendComment(event: FormEvent) {
    event.preventDefault(); setRequestError('');
    const parsed = createCommentBody.safeParse({ body, ...(mentionIds.length ? { mentionIds } : {}) });
    if (!parsed.success) { setValidation('Enter a comment before sending.'); return; }
    try { await createComment.mutateAsync({ body: parsed.data.body, mentionIds: parsed.data.mentionIds ?? [] }); setBody(''); setMentionIds([]); setValidation(''); }
    catch (error) { setRequestError(errorText(error, 'We could not post your comment. Try again.')); }
  }

  async function removeComment(commentId: string) {
    setRequestError('');
    try { await deleteComment.mutateAsync(commentId); }
    catch (error) { setRequestError(errorText(error, 'We could not delete this comment. Try again.')); }
  }

  const canDeleteCard = mayAdmin(role) || (card.data?.createdById != null && card.data.createdById === session.user?.id);
  return <>
    <Dialog open={open} onOpenChange={onOpenChange} title={editing ? 'Card details' : `Add card to ${listName}`} description={editing ? 'Edit the card and its discussion.' : 'Add a card to this list.'} className="h-[100dvh] max-h-[100dvh] max-w-none rounded-none p-4 sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-lg sm:p-5">
      <div className="min-h-0 space-y-5 overflow-y-auto pr-1">
        {editing && card.isPending ? <p role="status">Loading card…</p> : editing && card.isError ? <div role="alert" className="space-y-2"><p>{errorText(card.error, 'We could not load this card.')}</p><Button onClick={() => void card.refetch()}>Try again</Button></div> : <>
          <form className="space-y-4" onSubmit={save} noValidate>
            <Input label="Title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <label className="block space-y-1 text-sm font-medium text-fg">Description<textarea aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-fg" /></label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-fg">Priority<select aria-label="Priority" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)} className="min-h-(--size-touch) w-full rounded-md border border-line-strong bg-surface px-3 text-fg"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
              <label className="space-y-1 text-sm font-medium text-fg">Due date<input aria-label="Due date" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="min-h-(--size-touch) w-full rounded-md border border-line-strong bg-surface px-3 text-fg" /></label>
            </div>
            <fieldset className="space-y-2"><legend className="text-sm font-medium text-fg">Assignees</legend>{members.isPending ? <p role="status">Loading members…</p> : members.isError ? <div role="alert"><p>{errorText(members.error, 'Could not load members.')}</p><Button type="button" onClick={() => void members.refetch()}>Try again</Button></div> : members.data?.length ? <div className="grid gap-2 sm:grid-cols-2">{members.data.map((member) => <label key={member.user.id} className="flex min-h-(--size-touch) items-center gap-2 rounded-md border border-line p-2 text-sm"><input type="checkbox" checked={assigneeIds.includes(member.user.id)} onChange={(event) => setAssigneeIds((ids) => event.target.checked ? [...ids, member.user.id] : ids.filter((id) => id !== member.user.id))} />{member.user.name}</label>)}</div> : <p className="text-sm text-fg-muted">No workspace members found.</p>}</fieldset>
            <fieldset className="space-y-2"><legend className="text-sm font-medium text-fg">Labels</legend>{labels.isPending ? <p role="status">Loading labels…</p> : labels.isError ? <div role="alert"><p>{errorText(labels.error, 'Could not load labels.')}</p><Button type="button" onClick={() => void labels.refetch()}>Try again</Button></div> : labels.data?.length ? <div className="flex flex-wrap gap-2">{labels.data.map((label) => <label key={label.id} className="flex min-h-(--size-touch) items-center gap-2 rounded-md border border-line px-2 text-sm"><input type="checkbox" checked={labelIds.includes(label.id)} onChange={(event) => setLabelIds((ids) => event.target.checked ? [...ids, label.id] : ids.filter((id) => id !== label.id))} />{label.name}</label>)}</div> : <p className="text-sm text-fg-muted">No workspace labels found.</p>}</fieldset>
            {validation && <p role="alert" className="text-sm text-danger">{validation}</p>}{requestError && <p role="alert" className="text-sm text-danger">{requestError}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">{editing && canDeleteCard && <Button type="button" variant="danger" onClick={() => setShowDelete(true)}>Delete card</Button>}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" loading={createCard.isPending || updateCard.isPending}>{editing ? 'Save card' : 'Create card'}</Button></div></div>
          </form>
          {editing && <section aria-label="Comments" className="space-y-3 border-t border-line pt-4"><h3 className="font-semibold text-fg">Comments</h3>{comments.isPending ? <p role="status">Loading comments…</p> : comments.isError ? <div role="alert"><p>{errorText(comments.error, 'Could not load comments.')}</p><Button onClick={() => void comments.refetch()}>Try again</Button></div> : comments.data?.length ? <ul className="space-y-3">{comments.data.map((comment) => <li key={comment.id} className="rounded-md bg-surface-muted p-3"><div className="flex justify-between gap-2"><p className="text-sm font-medium">{comment.author?.name ?? 'Deleted user'}</p>{(mayAdmin(role) || comment.authorId === session.user?.id) && <button type="button" className="text-sm text-danger underline" onClick={() => void removeComment(comment.id)}>Delete</button>}</div><p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p></li>)}</ul> : <p className="text-sm text-fg-muted">No comments yet.</p>}
            <form onSubmit={(event) => void sendComment(event)} className="relative space-y-2"><label className="block text-sm font-medium">Add a comment<textarea aria-label="Add a comment" value={body} onChange={(event) => updateComment(event.target.value)} rows={3} className="mt-1 min-h-20 w-full rounded-md border border-line-strong bg-surface px-3 py-2" /></label>{mentionQuery !== null && suggestions.length > 0 && <ul role="listbox" aria-label="Mention members" className="max-h-40 overflow-y-auto rounded-md border border-line bg-surface shadow-lg">{suggestions.map((member) => <li key={member.user.id}><button type="button" role="option" aria-selected="false" className="min-h-(--size-touch) w-full px-3 text-left hover:bg-surface-muted" onClick={() => selectMention(member)}>@{member.user.name}</button></li>)}</ul>}<Button type="submit" variant="primary" loading={createComment.isPending}>Post comment</Button></form>
          </section>}
        </>}
      </div>
    </Dialog>
    <Dialog open={showDelete} onOpenChange={setShowDelete} title="Delete this card?" description="This permanently deletes the card and its comments."><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button onClick={() => setShowDelete(false)}>Cancel</Button><Button variant="danger" loading={deleteCard.isPending} onClick={async () => { try { await deleteCard.mutateAsync(cardId!); setShowDelete(false); onOpenChange(false); } catch (error) { setRequestError(errorText(error, 'We could not delete this card.')); setShowDelete(false); } }}>Delete card</Button></div></Dialog>
  </>;
}
