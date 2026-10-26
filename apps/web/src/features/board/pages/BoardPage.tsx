import { useEffect, useState, type KeyboardEvent } from 'react';
import {
  closestCorners,
  DndContext,
  PointerSensor,
  pointerWithin,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useParams } from 'react-router-dom';
import { useMyRole, useWorkspace } from '@/features/workspaces';
import { ApiError } from '@/shared/lib/api.js';
import { Button, Dialog, EmptyState } from '@/shared/ui/index.js';
import { BoardColumn } from './components/BoardColumn.js';
import { BoardListDialog } from './components/BoardListDialog.js';
import { BoardCardDialog } from './components/BoardCardDialog.js';
import {
  useBoard,
  useCreateBoardList,
  useDeleteBoardList,
  useMoveBoardCard,
  useMoveBoardList,
  useRenameBoardList,
} from './board.api.js';
import { afterCardId } from './board.api.js';
import type { BoardList } from './board.api.js';
import { useBoardSocket } from './useBoardSocket.js';

const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const cardCollisions = pointerCollisions.filter((collision) =>
    args.droppableContainers.find((container) => container.id === collision.id)?.data.current?.type === 'card',
  );
  return cardCollisions.length > 0 ? cardCollisions : pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
};

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
  const moveCardMutation = useMoveBoardCard(workspaceId);
  useBoardSocket(workspaceId);
  const lists = boardQuery.data?.lists ?? [];
  const canManageLists = role === 'OWNER' || role === 'ADMIN';
  const [selectedListId, setSelectedListId] = useState('');
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<BoardList | null>(null);
  const [listToDelete, setListToDelete] = useState<BoardList | null>(null);
  const [actionError, setActionError] = useState('');
  const [cardDialog, setCardDialog] = useState<{ open: boolean; listId: string; listName: string; cardId: string | null }>({ open: false, listId: '', listName: '', cardId: null });

  function openCard(list: BoardList, cardId: string | null = null) {
    setCardDialog({ open: true, listId: list.id, listName: list.name, cardId });
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  function requestCardMove(cardId: string, toListId: string, afterId: string | null) {
    setActionError('');
    moveCardMutation.mutate({ cardId, toListId, afterCardId: afterId }, {
      onError: (error) => setActionError(errorMessage(error, 'We could not move this card. Try again.')),
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const activeData = active.data.current as { type?: string; cardId?: string } | undefined;
    const overData = over.data.current as { type?: string; cardId?: string; listId?: string } | undefined;
    if (activeData?.type !== 'card' || !activeData.cardId || !overData?.listId) return;
    if (overData.cardId === activeData.cardId) return;
    const targetList = lists.find((list) => list.id === overData.listId);
    if (!targetList) return;

    const targetCards = targetList.cards.filter((card) => card.id !== activeData.cardId);
    const overCardId = overData.type === 'card' ? overData.cardId ?? null : null;
    const draggedCenter = active.rect.current.translated
      ? active.rect.current.translated.top + active.rect.current.translated.height / 2
      : null;
    const overCenter = over.rect.top + over.rect.height / 2;
    const insertAfter = draggedCenter !== null && draggedCenter > overCenter;
    requestCardMove(activeData.cardId, targetList.id, afterCardId(targetCards, overCardId, insertAfter));
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
    <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragEnd={handleDragEnd}>
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
              {lists.map((list, index) => {
                const isSelected = selectedList?.id === list.id;
                const selectListByKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
                  let nextIndex = index;
                  if (event.key === 'ArrowRight') nextIndex = (index + 1) % lists.length;
                  else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + lists.length) % lists.length;
                  else if (event.key === 'Home') nextIndex = 0;
                  else if (event.key === 'End') nextIndex = lists.length - 1;
                  else return;

                  event.preventDefault();
                  const nextList = lists[nextIndex];
                  if (!nextList) return;
                  setSelectedListId(nextList.id);
                  document.getElementById(`board-tab-${nextList.id}`)?.focus();
                };

                return (
                  <button
                    key={list.id}
                    id={`board-tab-${list.id}`}
                    type="button"
                    role="tab"
                    tabIndex={isSelected ? 0 : -1}
                    aria-selected={isSelected}
                    aria-controls="board-list-panel"
                    onClick={() => setSelectedListId(list.id)}
                    onKeyDown={selectListByKeyboard}
                    className={`min-h-(--size-touch) shrink-0 rounded-md border px-3 text-sm font-medium ${isSelected ? 'border-primary-soft-line bg-primary-soft text-primary' : 'border-line bg-surface text-fg-muted'}`}
                  >
                    {list.name} ({list.cards.length})
                  </button>
                );
              })}
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
                  lists={lists}
                  onRename={(list) => { setListToEdit(list); setListDialogOpen(true); }}
                  onDelete={setListToDelete}
                  onMove={(list, direction) => void reorderList(list, direction)}
                  onMoveCard={requestCardMove}
                  onAddCard={(list) => openCard(list)}
                  onOpenCard={(list, cardId) => openCard(list, cardId)}
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
                lists={lists}
                onRename={(item) => { setListToEdit(item); setListDialogOpen(true); }}
                onDelete={setListToDelete}
                onMove={(item, direction) => void reorderList(item, direction)}
                onMoveCard={requestCardMove}
                onAddCard={(item) => openCard(item)}
                onOpenCard={(item, cardId) => openCard(item, cardId)}
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

      <BoardCardDialog
        open={cardDialog.open}
        onOpenChange={(open) => setCardDialog((current) => ({ ...current, open }))}
        workspaceId={workspaceId}
        listId={cardDialog.listId}
        listName={cardDialog.listName}
        cardId={cardDialog.cardId}
        role={role}
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
    </DndContext>
  );
}
