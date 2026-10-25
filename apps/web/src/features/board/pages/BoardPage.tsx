import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMyRole, useWorkspace } from '@/features/workspaces';
import { ApiError } from '@/shared/lib/api.js';
import { Button, Dialog, EmptyState } from '@/shared/ui/index.js';
import { BoardColumn } from './components/BoardColumn.js';
import { BoardListDialog } from './components/BoardListDialog.js';
import {
  useBoard,
  useCreateBoardList,
  useDeleteBoardList,
  useMoveBoardList,
  useRenameBoardList,
} from './board.api.js';
import type { BoardList } from './board.api.js';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

// Owner: Frontend A. Requirement: FR-TASK-01.
export function BoardPage() {
  const { workspaceId = '' } = useParams<{ workspaceId: string }>();
  const boardQuery = useBoard(workspaceId);
  const workspaceQuery = useWorkspace(workspaceId);
  const role = useMyRole(workspaceId);
  const createList = useCreateBoardList(workspaceId);
  const renameList = useRenameBoardList(workspaceId);
  const deleteList = useDeleteBoardList(workspaceId);
  const moveList = useMoveBoardList(workspaceId);
  const lists = boardQuery.data?.lists ?? [];
  const canManageLists = role === 'OWNER' || role === 'ADMIN';
  const [selectedListId, setSelectedListId] = useState('');
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<BoardList | null>(null);
  const [listToDelete, setListToDelete] = useState<BoardList | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (lists.length > 0 && !lists.some((list) => list.id === selectedListId)) {
      setSelectedListId(lists[0]!.id);
    }
  }, [lists, selectedListId]);

  async function saveList(name: string) {
    if (listToEdit) await renameList.mutateAsync({ listId: listToEdit.id, name });
    else await createList.mutateAsync(name);
    setListToEdit(null);
  }

  async function confirmDelete() {
    if (!listToDelete) return;
    setActionError('');
    try {
      await deleteList.mutateAsync(listToDelete.id);
      setListToDelete(null);
    } catch (error) {
      setActionError(errorMessage(error, 'We could not delete this list. Try again.'));
    }
  }

  async function reorderList(list: BoardList, direction: 'up' | 'down') {
    const currentIndex = lists.findIndex((item) => item.id === list.id);
    if (currentIndex < 0) return;
    const afterListId = direction === 'down'
      ? lists[currentIndex + 1]?.id
      : currentIndex > 1
        ? lists[currentIndex - 2]?.id
        : undefined;

    setActionError('');
    try {
      await moveList.mutateAsync({ listId: list.id, afterListId });
    } catch (error) {
      setActionError(errorMessage(error, 'We could not reorder this list. Try again.'));
    }
  }

  const retry = () => {
    void Promise.all([boardQuery.refetch(), workspaceQuery.refetch()]);
  };

  if (boardQuery.isPending || workspaceQuery.isPending) {
    return (
      <main className="min-w-0 space-y-6 p-4 text-fg sm:p-6" aria-label="Loading board">
        <div role="status" aria-label="Loading board" className="space-y-4">
          <div aria-hidden="true" className="h-8 w-56 animate-pulse rounded-md bg-surface-muted" />
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="h-64 w-(--size-list) shrink-0 animate-pulse rounded-lg bg-surface-muted" />)}
          </div>
        </div>
      </main>
    );
  }

  if (boardQuery.isError || workspaceQuery.isError || !boardQuery.data || !workspaceQuery.data) {
    const error = boardQuery.error ?? workspaceQuery.error;
    return (
      <main className="min-w-0 p-4 text-fg sm:p-6">
        <div role="alert" className="space-y-3 rounded-lg border border-danger bg-danger-bg p-4">
          <p>{errorMessage(error, 'We could not load this board. Try again.')}</p>
          <Button size="lg" onClick={retry} disabled={boardQuery.isFetching || workspaceQuery.isFetching}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  const selectedList = lists.find((list) => list.id === selectedListId) ?? lists[0];

  return (
    <main className="min-w-0 space-y-6 p-4 text-fg sm:p-6">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-fg-muted">{workspaceQuery.data.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Board</h1>
        </div>
        {canManageLists && (
          <Button size="lg" variant="primary" onClick={() => { setListToEdit(null); setListDialogOpen(true); }}>
            Add list
          </Button>
        )}
      </header>

      {actionError && <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{actionError}</p>}

      {lists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line-strong bg-surface p-4 sm:p-6">
          <EmptyState
            title="No lists on this board yet"
            description={canManageLists ? 'Create a list to start organizing this workspace.' : 'A workspace admin can add the first board list.'}
            action={canManageLists ? <Button size="lg" variant="primary" onClick={() => { setListToEdit(null); setListDialogOpen(true); }}>Create first list</Button> : undefined}
          />
        </div>
      ) : (
        <>
          <div className="md:hidden">
            <div role="tablist" aria-label="Board lists" className="flex gap-2 overflow-x-auto pb-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  id={`board-tab-${list.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedList?.id === list.id}
                  aria-controls="board-list-panel"
                  onClick={() => setSelectedListId(list.id)}
                  className={`min-h-(--size-touch) shrink-0 rounded-md border px-3 text-sm font-medium ${selectedList?.id === list.id ? 'border-primary-soft-line bg-primary-soft text-primary' : 'border-line bg-surface text-fg-muted'}`}
                >
                  {list.name} ({list.cards.length})
                </button>
              ))}
            </div>
            {selectedList && (
              <div id="board-list-panel" role="tabpanel" aria-labelledby={`board-tab-${selectedList.id}`}>
                <BoardColumn
                  list={selectedList}
                  canManage={canManageLists}
                  index={lists.findIndex((list) => list.id === selectedList.id)}
                  listCount={lists.length}
                  isMoving={moveList.isPending}
                  idPrefix="mobile"
                  onRename={(list) => { setListToEdit(list); setListDialogOpen(true); }}
                  onDelete={setListToDelete}
                  onMove={(list, direction) => void reorderList(list, direction)}
                />
              </div>
            )}
          </div>

          <div className="hidden min-w-0 gap-4 overflow-x-auto pb-3 md:flex">
            {lists.map((list, index) => (
              <BoardColumn
                key={list.id}
                list={list}
                canManage={canManageLists}
                index={index}
                listCount={lists.length}
                isMoving={moveList.isPending}
                idPrefix="desktop"
                onRename={(item) => { setListToEdit(item); setListDialogOpen(true); }}
                onDelete={setListToDelete}
                onMove={(item, direction) => void reorderList(item, direction)}
              />
            ))}
          </div>
        </>
      )}

      <BoardListDialog
        open={listDialogOpen}
        list={listToEdit}
        onOpenChange={(open) => { setListDialogOpen(open); if (!open) setListToEdit(null); }}
        onSave={saveList}
      />

      <Dialog
        open={Boolean(listToDelete)}
        onOpenChange={(open) => { if (!open && !deleteList.isPending) setListToDelete(null); }}
        title="Delete this list?"
        description={listToDelete ? `Deleting “${listToDelete.name}” also deletes all ${listToDelete.cards.length} ${listToDelete.cards.length === 1 ? 'card' : 'cards'} in it.` : undefined}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button size="lg" onClick={() => setListToDelete(null)} disabled={deleteList.isPending}>Cancel</Button>
          <Button size="lg" variant="danger" loading={deleteList.isPending} onClick={() => void confirmDelete()}>Delete list</Button>
        </div>
      </Dialog>
    </main>
  );
}
