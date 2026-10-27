import { DndContext } from '@dnd-kit/core';
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiContext, useAiContext } from '@/shared/stores/aiContext.js';
import { BoardCard } from './BoardCard.js';

const card = {
  id: 'card-1',
  listId: 'list-1',
  position: 1024,
  title: 'Review notes',
  priority: 'MEDIUM' as const,
  assignees: [],
};

afterEach(() => {
  cleanup();
  aiContext.clear();
});

describe('BoardCard', () => {
  it('TC-AI-02: adds the card to AI context and opens the assistant', () => {
    const openAssistant = vi.fn();
    const unsubscribe = aiContext.subscribeToAssistantOpen(openAssistant);
    const { result } = renderHook(() => useAiContext());
    render(
      <DndContext>
        <BoardCard
          card={card}
          listId="list-1"
          idPrefix="desktop"
          lists={[]}
          onMove={vi.fn()}
          onOpen={vi.fn()}
        />
      </DndContext>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add Review notes to AI chat' }));

    expect(result.current.items).toEqual([{ type: 'card', id: 'card-1', label: 'Review notes' }]);
    expect(screen.getByRole('button', { name: 'Add Review notes to AI chat' })).toHaveTextContent('In AI chat');
    expect(openAssistant).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
