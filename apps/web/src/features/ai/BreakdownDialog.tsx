import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/lib/api.js';
import { useConfirmBreakdown, usePreviewBreakdown, useWorkspaceAiState, useWorkspaceBoardLists } from './api/hooks.js';
import type { BreakdownItem } from './api/ai.api.js';

type EditableItem = BreakdownItem & { selected: boolean };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The breakdown could not be completed. Nothing was changed. Try again.';
}

export function BreakdownDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [provider, setProvider] = useState('');
  const queryClient = useQueryClient();
  const workspace = useWorkspaceAiState(workspaceId);
  const lists = useWorkspaceBoardLists(workspaceId, true);
  const preview = usePreviewBreakdown(workspaceId);
  const confirm = useConfirmBreakdown(workspaceId);
  const isBusy = preview.isPending || confirm.isPending;
  const selectedItems = items.filter((item) => item.selected);
  const currentListId = listId || lists.data?.lists[0]?.id || '';

  function generate() {
    const trimmed = description.trim();
    if (!workspaceId || !workspace.data?.aiEnabled || !currentListId || !trimmed || isBusy) return;
    preview.reset();
    confirm.reset();
    preview.mutate({ description: trimmed, listId: currentListId }, {
      onSuccess: (result) => {
        setProvider(result.provider);
        setItems(result.items.map((item) => ({ ...item, selected: true })));
      },
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'AI_DISABLED') {
          queryClient.setQueryData(['workspace-ai-consent', workspaceId], { id: workspaceId, aiEnabled: false });
        }
      },
    });
  }

  function updateItem(index: number, changes: Partial<EditableItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  function createCards() {
    if (!currentListId || selectedItems.length === 0 || isBusy) return;
    confirm.reset();
    confirm.mutate({
      listId: currentListId,
      items: selectedItems.map((item) => ({
        title: item.title,
        ...(item.description ? { description: item.description } : {}),
        ...(item.priority ? { priority: item.priority } : {}),
        ...(item.dueDate ? { dueDate: item.dueDate } : {}),
      })),
    }, {
      onSuccess: onClose,
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'AI_DISABLED') {
          queryClient.setQueryData(['workspace-ai-consent', workspaceId], { id: workspaceId, aiEnabled: false });
        }
      },
    });
  }

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-fg/40 p-0 sm:items-center sm:p-3" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="breakdown-title" className="flex h-[95dvh] max-h-[95dvh] w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-t-xl border border-line bg-surface p-4 text-fg shadow-lg sm:h-auto sm:max-h-[92dvh] sm:rounded-lg sm:p-6">
      <header className="flex items-center gap-3">
        <h2 id="breakdown-title" className="min-w-0 flex-1 text-lg font-semibold">Break down a project</h2>
        <button type="button" onClick={onClose} disabled={isBusy} className="min-h-11 rounded-md border border-line px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-50">Close</button>
      </header>

      {workspace.isPending && <p role="status" className="rounded-md border border-line bg-surface-muted p-3 text-sm text-fg-muted">Checking workspace AI consent…</p>}
      {workspace.error && <div role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm">{errorMessage(workspace.error)}<button type="button" onClick={() => void workspace.refetch()} className="ml-2 min-h-11 rounded-md px-2 font-semibold">Try again</button></div>}
      {workspace.data && !workspace.data.aiEnabled && <p role="status" className="rounded-md border border-warning bg-warning-bg p-3 text-sm">AI is off for this workspace. The workspace owner can enable it in Settings.</p>}

      <form onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); generate(); }} className="flex flex-col gap-3">
        <label htmlFor="breakdown-description" className="flex flex-col gap-1 text-sm font-medium">Describe the project or goal
          <textarea id="breakdown-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={10000} rows={3} className="min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-focus" />
        </label>
        {lists.isPending && <p role="status" className="text-sm text-fg-muted">Loading workspace lists…</p>}
        {lists.error && <div role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm">{errorMessage(lists.error)} <button type="button" onClick={() => void lists.refetch()} className="min-h-11 rounded-md px-2 font-semibold">Try again</button></div>}
        {lists.data?.lists.length === 0 && <p role="status" className="rounded-md border border-line bg-surface-muted p-3 text-sm text-fg-muted">Create a board list before generating cards.</p>}
        {(lists.data?.lists.length ?? 0) > 0 && <label htmlFor="breakdown-list" className="flex flex-col gap-1 text-sm font-medium">Add cards to list
          <select id="breakdown-list" value={currentListId} onChange={(event) => setListId(event.target.value)} className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-sm">
            {lists.data?.lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
        </label>}
        <button type="button" onClick={generate} disabled={!workspace.data?.aiEnabled || !description.trim() || !currentListId || lists.isPending || isBusy} className="min-h-11 w-full rounded-md bg-ai px-4 text-sm font-semibold text-white hover:bg-ai-hover disabled:cursor-not-allowed disabled:opacity-50">
          {preview.isPending ? 'Generating preview…' : 'Generate preview'}
        </button>
      </form>

      {preview.error && <p role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm">{errorMessage(preview.error)}</p>}
      {items.length > 0 && <section role="region" aria-label="Breakdown preview" className="flex flex-col gap-2">
        <div><h3 className="text-sm font-semibold">Preview: edit, remove or confirm</h3><p className="text-xs text-fg-muted">Generated by {provider}</p></div>
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {items.map((item, index) => <li key={`${index}-${item.title}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-md border border-line p-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(7rem,auto)]">
            <input type="checkbox" checked={item.selected} aria-label={`Include ${item.title}`} onChange={(event) => updateItem(index, { selected: event.target.checked })} className="mt-3 size-4 accent-ai" />
            <div className="flex min-w-0 flex-col gap-2">
              <label className="text-xs font-medium text-fg-muted">Title
                <input aria-label={`Title ${index + 1}`} value={item.title} maxLength={200} onChange={(event) => updateItem(index, { title: event.target.value })} className="min-h-11 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg" />
              </label>
              <label className="text-xs font-medium text-fg-muted">Description
                <textarea aria-label={`Description ${index + 1}`} value={item.description ?? ''} maxLength={2000} rows={2} onChange={(event) => updateItem(index, { description: event.target.value || undefined })} className="min-h-16 w-full rounded-md border border-line bg-surface px-2 py-2 text-sm text-fg" />
              </label>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 sm:flex sm:flex-col">
              <label className="text-xs font-medium text-fg-muted">Priority
                <select aria-label={`Priority ${index + 1}`} value={item.priority ?? 'MEDIUM'} onChange={(event) => updateItem(index, { priority: event.target.value as BreakdownItem['priority'] })} className="min-h-11 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg">
                  <option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                </select>
              </label>
              <label className="text-xs font-medium text-fg-muted">Due date
                <input aria-label={`Due date ${index + 1}`} type="date" value={item.dueDate?.slice(0, 10) ?? ''} onChange={(event) => updateItem(index, { dueDate: event.target.value ? new Date(`${event.target.value}T00:00:00.000Z`).toISOString() : undefined })} className="min-h-11 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg" />
              </label>
            </div>
          </li>)}
        </ul>
        <p role="note" className="text-sm text-fg-muted">Nothing is created until you confirm.</p>
      </section>}

      {confirm.error && <p role="alert" className="rounded-md border border-danger bg-danger-bg p-3 text-sm">{errorMessage(confirm.error)} Nothing was changed. Your preview is still available.</p>}
      <footer className="flex flex-col-reverse gap-2 border-t border-line pt-3 sm:flex-row sm:items-center">
        <span className="flex-1 text-xs text-fg-muted">{items.length > 0 ? `${selectedItems.length} of ${items.length} cards selected` : 'Review the preview before creating cards.'}</span>
        <button type="button" onClick={onClose} disabled={isBusy} className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold hover:bg-surface-muted disabled:opacity-50">Cancel</button>
        {items.length > 0 && <button type="button" onClick={createCards} disabled={!selectedItems.length || selectedItems.some((item) => !item.title.trim()) || isBusy} className="min-h-11 rounded-md bg-ai px-4 text-sm font-semibold text-white hover:bg-ai-hover disabled:cursor-not-allowed disabled:opacity-50">{confirm.isPending ? 'Creating cards…' : `Create ${selectedItems.length} cards`}</button>}
      </footer>
    </section>
  </div>;
}
