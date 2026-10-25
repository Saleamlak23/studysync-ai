import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Priority } from '@studysync/shared';
import { Badge, Card } from '@/shared/ui/index.js';
import type { BoardCard as BoardCardData, BoardList } from '../board.api.js';

const priorityVariant = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'default',
} as const satisfies Record<Priority, 'danger' | 'warning' | 'default'>;

type BoardCardProps = {
  card: BoardCardData;
  listId: string;
  idPrefix: 'mobile' | 'desktop';
  lists: BoardList[];
  onMove: (cardId: string, toListId: string, afterCardId: string | null) => void;
};

export function BoardCard({ card, listId, idPrefix, lists, onMove }: BoardCardProps) {
  const assigneeNames = card.assignees.map(({ user }) => user.name);
  const draggableId = `${idPrefix}:card:${card.id}`;
  const draggable = useDraggable({
    id: draggableId,
    data: { type: 'card', cardId: card.id, listId },
  });
  const droppable = useDroppable({
    id: draggableId,
    data: { type: 'card', cardId: card.id, listId },
  });
  const setNodeRef = (node: HTMLElement | null) => {
    draggable.setNodeRef(node);
    droppable.setNodeRef(node);
  };
  const destinationLists = lists.filter((list) => list.id !== listId);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(draggable.transform) }}
      className={`touch-pan-y rounded-md focus-visible:outline-2 focus-visible:outline-focus ${draggable.isDragging ? 'opacity-40' : ''} ${droppable.isOver ? 'ring-2 ring-primary-soft-line' : ''}`}
    >
      <Card variant="tile" className="space-y-3">
        <div className="flex min-w-0 items-start gap-2">
          <h3 className="min-w-0 flex-1 break-words text-sm font-medium text-fg">{card.title}</h3>
          <button
            ref={draggable.setActivatorNodeRef}
            type="button"
            {...draggable.attributes}
            {...draggable.listeners}
            aria-label={`Drag ${card.title}`}
            title="Drag card"
            className="inline-flex min-h-(--size-touch) min-w-(--size-touch) shrink-0 items-center justify-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            <GripVertical aria-hidden="true" className="size-4" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={priorityVariant[card.priority]}>{card.priority.toLowerCase()}</Badge>
          {assigneeNames.map((name) => (
            <span key={name} className="max-w-full break-words text-xs text-fg-muted">{name}</span>
          ))}
        </div>
        {destinationLists.length > 0 && (
          <label className="flex min-h-(--size-touch) items-center gap-2 border-t border-line pt-2 text-xs text-fg-muted">
            <span className="shrink-0">Move to list</span>
            <select
              aria-label={`Move ${card.title} to list`}
              value=""
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                const targetListId = event.currentTarget.value;
                const targetList = lists.find((list) => list.id === targetListId);
                if (!targetList) return;
                onMove(card.id, targetList.id, targetList.cards.at(-1)?.id ?? null);
              }}
              className="min-h-(--size-touch) min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-fg"
            >
              <option value="">Choose a list</option>
              {destinationLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </label>
        )}
      </Card>
    </div>
  );
}
