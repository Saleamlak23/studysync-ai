import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { aiContext, useAiContext } from './aiContext.js';

describe('AI context store', () => {
  afterEach(() => {
    cleanup();
    aiContext.clear();
  });

  it('TC-AI-02: publishes selected context and lets the user clear it', () => {
    const { result } = renderHook(() => useAiContext());
    const selected = [
      { type: 'card' as const, id: 'card-1', label: 'Design login page' },
      {
        type: 'message_range' as const,
        channelId: 'channel-1',
        fromId: 'message-1',
        toId: 'message-5',
        label: 'Planning discussion',
      },
      { type: 'file' as const, id: 'file-1', label: 'Requirements.pdf' },
    ];

    act(() => result.current.select(selected));
    expect(result.current.items).toEqual(selected);
    expect(result.current.items).not.toBe(selected);

    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });

  it('TC-AI-02: replaces prior context with the newly selected items', () => {
    const { result } = renderHook(() => useAiContext());

    act(() => result.current.select([{ type: 'card', id: 'card-1', label: 'Old selection' }]));
    act(() => result.current.select([{ type: 'file', id: 'file-1', label: 'New selection' }]));

    expect(result.current.items).toEqual([{ type: 'file', id: 'file-1', label: 'New selection' }]);
  });

  it('TC-AI-02: adds a card to existing context once and requests the assistant to open', () => {
    const { result } = renderHook(() => useAiContext());
    let assistantOpenCount = 0;
    const openAssistant = () => {
      assistantOpenCount += 1;
    };
    const unsubscribe = aiContext.subscribeToAssistantOpen(openAssistant);
    act(() => result.current.select([{ type: 'file', id: 'file-1', label: 'Requirements.pdf' }]));

    act(() => {
      result.current.add({ type: 'card', id: 'card-1', label: 'Design login page' });
      result.current.add({ type: 'card', id: 'card-1', label: 'Design login page' });
      aiContext.requestAssistantOpen();
    });

    expect(result.current.items).toEqual([
      { type: 'file', id: 'file-1', label: 'Requirements.pdf' },
      { type: 'card', id: 'card-1', label: 'Design login page' },
    ]);
    expect(assistantOpenCount).toBe(1);
    unsubscribe();
  });
});
