import { useDroppable } from '@dnd-kit/core';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import type { BoardList } from '../board.api.js';
import { BoardCard } from './BoardCard.js';

type BoardColumnProps = {
  list: BoardList;
  canManage: boolean;
  index: number;
  listCount: number;
  isMoving: boolean;
  idPrefix: 'mobile' | 'desktop';
  lists: BoardList[];
  onRename: (list: BoardList) => void;
  onDelete: (list: BoardList) => void;
  onMove: (list: BoardList, direction: 'up' | 'down') => void;
  onMoveCard: (cardId: string, toListId: string, afterCardId: string | null) => void;
};

export function BoardColumn({
  list,
  canManage,
  index,
  listCount,
  isMoving,
  idPrefix,
  lists,
  onRename,
  onDelete,
  onMove,
  onMoveCard,
}: BoardColumnProps) {
  const droppable = useDroppable({
    id: `${idPrefix}:list:${list.id}`,
    data: { type: 'list', listId: list.id },
  });

  return (
    <section
      ref={droppable.setNodeRef}
      aria-labelledby={`board-${idPrefix}-list-${list.id}`}
      className={`w-full shrink-0 rounded-lg bg-surface-muted p-2.5 md:w-(--size-list) ${droppable.isOver ? 'outline outline-2 outline-primary-soft-line' : ''}`}
    >
      <header className="mb-3 flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`board-${idPrefix}-list-${list.id}`} className="break-words text-sm font-semibold text-fg">{list.name}</h2>
          <p className="text-xs text-fg-muted">{list.cards.length} {list.cards.length === 1 ? 'card' : 'cards'}</p>
        </div>
        {canManage && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <button
              type="button"
              aria-label={`Move ${list.name} up`}
              title="Move up"
              disabled={index === 0 || isMoving}
              onClick={() => onMove(list, 'up')}
              className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg disabled:opacity-50"
            >
              <ArrowUp aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={`Move ${list.name} down`}
              title="Move down"
              disabled={index === listCount - 1 || isMoving}
              onClick={() => onMove(list, 'down')}
              className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg disabled:opacity-50"
            >
              <ArrowDown aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={`Rename ${list.name}`}
              title="Rename list"
              onClick={() => onRename(list)}
              className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-md text-fg-muted hover:bg-surface hover:text-fg"
            >
              <Pencil aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${list.name}`}
              title="Delete list"
              onClick={() => onDelete(list)}
              className="inline-flex min-h-(--size-touch) min-w-(--size-touch) items-center justify-center rounded-md text-danger hover:bg-danger-bg"
            >
              <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </header>
      {list.cards.length > 0 ? (
        <div className="space-y-2">
          {list.cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              listId={list.id}
              idPrefix={idPrefix}
              lists={lists}
              onMove={onMoveCard}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line-strong px-3 py-4 text-center text-sm text-fg-muted">
          No cards in this list yet.
        </p>
      )}
    </section>
  );
}
