import type { Priority } from '@studysync/shared';
import { Badge, Card } from '@/shared/ui/index.js';
import type { BoardCard as BoardCardData } from '../board.api.js';

const priorityVariant = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'default',
} as const satisfies Record<Priority, 'danger' | 'warning' | 'default'>;

export function BoardCard({ card }: { card: BoardCardData }) {
  const assigneeNames = card.assignees.map(({ user }) => user.name);

  return (
    <Card variant="tile" className="space-y-3">
      <h3 className="break-words text-sm font-medium text-fg">{card.title}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={priorityVariant[card.priority]}>{card.priority.toLowerCase()}</Badge>
        {assigneeNames.map((name) => (
          <span key={name} className="max-w-full break-words text-xs text-fg-muted">{name}</span>
        ))}
      </div>
    </Card>
  );
}
