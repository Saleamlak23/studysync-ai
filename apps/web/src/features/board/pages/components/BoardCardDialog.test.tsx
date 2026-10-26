import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardCardDialog } from './BoardCardDialog.js';
import { ApiError } from '@/shared/lib/api.js';
import { useBoardCard, useBoardCardComments, useBoardCardLabels, useBoardCardMembers, useCreateBoardCard, useCreateBoardCardComment, useDeleteBoardCard, useDeleteBoardCardComment, useUpdateBoardCard } from '../board.api.js';

vi.mock('../board.api.js', () => ({
  useBoardCard: vi.fn(), useBoardCardComments: vi.fn(), useBoardCardLabels: vi.fn(), useBoardCardMembers: vi.fn(),
  useCreateBoardCard: vi.fn(), useCreateBoardCardComment: vi.fn(), useDeleteBoardCard: vi.fn(),
  useDeleteBoardCardComment: vi.fn(), useUpdateBoardCard: vi.fn(),
}));

const userId = '11111111-1111-4111-8111-111111111111';
const labelId = '22222222-2222-4222-8222-222222222222';
const card = { id: 'card-1', listId: 'list-1', position: 1024, title: 'Review notes', priority: 'MEDIUM' as const,
  description: 'Chapter one', dueDate: null, createdById: userId,
  assignees: [{ userId, user: { id: userId, name: 'Rufta Gaiem', email: 'r@example.com', avatarUrl: null } }], labels: [] };
const createMutation = vi.fn(); const updateMutation = vi.fn(); const deleteMutation = vi.fn(); const commentMutation = vi.fn(); const deleteComment = vi.fn();

function renderDialog(overrides: Partial<React.ComponentProps<typeof BoardCardDialog>> = {}) {
  return render(<BoardCardDialog open onOpenChange={vi.fn()} workspaceId="workspace-1" listId="list-1" listName="To do" cardId={null} role="OWNER" {...overrides} />);
}

describe('BoardCardDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBoardCard).mockReturnValue({ data: undefined, isPending: false, isError: false } as never);
    vi.mocked(useBoardCardComments).mockReturnValue({ data: [], isPending: false, isError: false } as never);
    vi.mocked(useBoardCardMembers).mockReturnValue({ data: [{ user: { id: userId, name: 'Rufta Gaiem', email: 'r@example.com', avatarUrl: null }, role: 'OWNER', joinedAt: '' }], isPending: false, isError: false } as never);
    vi.mocked(useBoardCardLabels).mockReturnValue({ data: [{ id: labelId, workspaceId: 'workspace-1', name: 'Exam', color: 'stone' }], isPending: false, isError: false } as never);
    vi.mocked(useCreateBoardCard).mockReturnValue({ mutateAsync: createMutation, isPending: false } as never);
    vi.mocked(useUpdateBoardCard).mockReturnValue({ mutateAsync: updateMutation, isPending: false } as never);
    vi.mocked(useDeleteBoardCard).mockReturnValue({ mutateAsync: deleteMutation, isPending: false } as never);
    vi.mocked(useCreateBoardCardComment).mockReturnValue({ mutateAsync: commentMutation, isPending: false } as never);
    vi.mocked(useDeleteBoardCardComment).mockReturnValue({ mutateAsync: deleteComment, isPending: false } as never);
  });
  afterEach(cleanup);

  it('TC-TASK-02: validates title, normalizes fields, and submits card create with selected assignee and label', async () => {
    createMutation.mockResolvedValue({ ...card, id: 'created-1' });
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create card' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  Review notes  ' } });
    fireEvent.click(screen.getByLabelText('Rufta Gaiem'));
    fireEvent.click(screen.getByLabelText('Exam'));
    fireEvent.click(screen.getByRole('button', { name: 'Create card' }));
    await waitFor(() => expect(createMutation).toHaveBeenCalledWith({ listId: 'list-1', input: expect.objectContaining({ title: 'Review notes', assigneeIds: [userId], labelIds: [labelId] }) }));
  });

  it('TC-TASK-02: edits a card and clears its due date with null', async () => {
    vi.mocked(useBoardCard).mockReturnValue({ data: card, isPending: false, isError: false, refetch: vi.fn() } as never);
    updateMutation.mockResolvedValue(card);
    renderDialog({ cardId: 'card-1' });
    await screen.findByDisplayValue('Review notes');
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    await waitFor(() => expect(updateMutation).toHaveBeenCalledWith({ cardId: 'card-1', input: expect.objectContaining({ dueDate: null }) }));
  });

  it('TC-TASK-02: maps API validation errors and offers delete only to an allowed author', async () => {
    vi.mocked(useBoardCard).mockReturnValue({ data: card, isPending: false, isError: false, refetch: vi.fn() } as never);
    updateMutation.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.'));
    renderDialog({ cardId: 'card-1' });
    await screen.findByDisplayValue('Review notes');
    expect(screen.getByRole('button', { name: 'Delete card' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save card' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('TC-TASK-05: posts a comment with selected mention IDs and allows author deletion', async () => {
    vi.mocked(useBoardCard).mockReturnValue({ data: card, isPending: false, isError: false, refetch: vi.fn() } as never);
    vi.mocked(useBoardCardComments).mockReturnValue({ data: [{ id: 'comment-1', cardId: 'card-1', authorId: userId, body: 'Hello', createdAt: '', author: { id: userId, name: 'Rufta Gaiem', avatarUrl: null } }], isPending: false, isError: false, refetch: vi.fn() } as never);
    commentMutation.mockResolvedValue({});
    renderDialog({ cardId: 'card-1' });
    await screen.findByText('Hello');
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: '@Rufta' } });
    fireEvent.click(screen.getByRole('option', { name: '@Rufta Gaiem' }));
    fireEvent.change(screen.getByLabelText('Add a comment'), { target: { value: '@Rufta Gaiem please review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));
    await waitFor(() => expect(commentMutation).toHaveBeenCalledWith({ body: '@Rufta Gaiem please review', mentionIds: [userId] }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith('comment-1'));

    cleanup();
    vi.mocked(useBoardCard).mockReturnValue({ data: { ...card, createdById: '33333333-3333-4333-8333-333333333333' }, isPending: false, isError: false } as never);
    vi.mocked(useBoardCardComments).mockReturnValue({ data: [{ id: 'comment-2', cardId: 'card-1', authorId: '33333333-3333-4333-8333-333333333333', body: 'Other user comment', createdAt: '', author: { id: '33333333-3333-4333-8333-333333333333', name: 'Another member', avatarUrl: null } }], isPending: false, isError: false } as never);
    renderDialog({ cardId: 'card-1', role: 'MEMBER' });
    await screen.findByText('Other user comment');
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('TC-TASK-02: maps a forbidden delete response and hides delete for a non-author Member', async () => {
    vi.mocked(useBoardCard).mockReturnValue({ data: { ...card, createdById: '33333333-3333-4333-8333-333333333333' }, isPending: false, isError: false, refetch: vi.fn() } as never);
    deleteMutation.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'You do not have permission to do that.'));
    renderDialog({ cardId: 'card-1', role: 'MEMBER' });
    await screen.findByDisplayValue('Review notes');
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
  });

  it('TC-TASK-02: shows the mapped 403 response after confirmed card deletion', async () => {
    vi.mocked(useBoardCard).mockReturnValue({ data: card, isPending: false, isError: false, refetch: vi.fn() } as never);
    deleteMutation.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'You do not have permission to do that.'));
    renderDialog({ cardId: 'card-1' });
    await screen.findByDisplayValue('Review notes');
    fireEvent.click(screen.getByRole('button', { name: 'Delete card' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete card' }).at(-1)!);
    expect(await screen.findByText('You do not have permission to do that.')).toBeInTheDocument();
  });

  it('TC-TASK-05: shows comment loading, empty, and retryable error states', async () => {
    vi.mocked(useBoardCard).mockReturnValue({ data: card, isPending: false, isError: false, refetch: vi.fn() } as never);
    vi.mocked(useBoardCardComments).mockReturnValue({ data: undefined, isPending: true, isError: false, refetch: vi.fn() } as never);
    const { rerender } = renderDialog({ cardId: 'card-1' });
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Loading comments…');
    vi.mocked(useBoardCardComments).mockReturnValue({ data: [], isPending: false, isError: false, refetch: vi.fn() } as never);
    rerender(<BoardCardDialog open onOpenChange={vi.fn()} workspaceId="workspace-1" listId="list-1" listName="To do" cardId="card-1" role="MEMBER" />);
    expect(await screen.findByText('No comments yet.')).toBeInTheDocument();
    const refetch = vi.fn();
    vi.mocked(useBoardCardComments).mockReturnValue({ data: undefined, isPending: false, isError: true, error: new Error('offline'), refetch } as never);
    rerender(<BoardCardDialog open onOpenChange={vi.fn()} workspaceId="workspace-1" listId="list-1" listName="To do" cardId="card-1" role="MEMBER" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});
