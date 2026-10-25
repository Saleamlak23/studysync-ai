import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardPage } from './BoardPage.js';
import {
  useBoard,
  useCreateBoardList,
  useDeleteBoardList,
  useMoveBoardCard,
  useMoveBoardList,
  useRenameBoardList,
} from './board.api.js';
import { useMyRole, useWorkspace } from '@/features/workspaces';

vi.mock('./board.api.js', () => ({
  useBoard: vi.fn(),
  useCreateBoardList: vi.fn(),
  useRenameBoardList: vi.fn(),
  useDeleteBoardList: vi.fn(),
  useMoveBoardCard: vi.fn(),
  useMoveBoardList: vi.fn(),
}));

vi.mock('@/features/workspaces', () => ({
  useWorkspace: vi.fn(),
  useMyRole: vi.fn(),
}));
vi.mock('./useBoardSocket.js', () => ({ useBoardSocket: vi.fn() }));
vi.mock('./components/BoardCardDialog.js', () => ({ BoardCardDialog: () => null }));

const card = {
  id: 'card-1',
  listId: 'list-1',
  position: 1024,
  title: 'Prepare study plan',
  priority: 'HIGH' as const,
  assignees: [{ userId: 'user-1', user: { id: 'user-1', name: 'Rufta Gaiem', email: 'rufta@example.com', avatarUrl: null } }],
};

const lists = [
  { id: 'list-1', boardId: 'board-1', name: 'To do', position: 1024, cards: [card] },
  { id: 'list-2', boardId: 'board-1', name: 'In progress', position: 2048, cards: [] },
  { id: 'list-3', boardId: 'board-1', name: 'Done', position: 3072, cards: [] },
];

const board = { board: { id: 'board-1', workspaceId: 'workspace-1', name: 'Board' }, lists };

const createMutation = vi.fn();
const renameMutation = vi.fn();
const deleteMutation = vi.fn();
const moveMutation = vi.fn();
const moveCardMutation = vi.fn();
const boardRefetch = vi.fn();
const workspaceRefetch = vi.fn();

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/w/workspace-1/board']}>
      <Routes>
        <Route path="/w/:workspaceId/board" element={<BoardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setBoardState(options: {
  data?: typeof board;
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
} = {}) {
  const { data = board, isPending = false, isError = false, error = null } = options;
  vi.mocked(useBoard).mockReturnValue({
    data,
    isPending,
    isError,
    error,
    isFetching: false,
    refetch: boardRefetch,
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useWorkspace).mockReturnValue({
    data: { id: 'workspace-1', name: 'Study team', description: null, myRole: 'OWNER', aiEnabled: true },
    isPending,
    isError,
    error,
    isFetching: false,
    refetch: workspaceRefetch,
  } as unknown as ReturnType<typeof useWorkspace>);
  vi.mocked(useMyRole).mockReturnValue('OWNER');
}

describe('BoardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBoardState();
    vi.mocked(useCreateBoardList).mockReturnValue({ mutateAsync: createMutation, isPending: false } as unknown as ReturnType<typeof useCreateBoardList>);
    vi.mocked(useRenameBoardList).mockReturnValue({ mutateAsync: renameMutation, isPending: false } as unknown as ReturnType<typeof useRenameBoardList>);
    vi.mocked(useDeleteBoardList).mockReturnValue({ mutateAsync: deleteMutation, isPending: false } as unknown as ReturnType<typeof useDeleteBoardList>);
    vi.mocked(useMoveBoardList).mockReturnValue({ mutateAsync: moveMutation, isPending: false } as unknown as ReturnType<typeof useMoveBoardList>);
    vi.mocked(useMoveBoardCard).mockReturnValue({ mutate: moveCardMutation, isPending: false } as unknown as ReturnType<typeof useMoveBoardCard>);
  });

  afterEach(cleanup);

  it('TC-TASK-01: shows a loading state while workspace and board load', () => {
    setBoardState({ isPending: true, data: undefined as unknown as typeof board });
    renderBoard();
    expect(screen.getByRole('status', { name: 'Loading board' })).toBeInTheDocument();
  });

  it('TC-TASK-01: shows an error and retries board and workspace requests', () => {
    setBoardState({ isError: true, error: new Error('offline') });
    renderBoard();
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load this board. Try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(boardRefetch).toHaveBeenCalled();
    expect(workspaceRefetch).toHaveBeenCalled();
  });

  it('TC-TASK-01: offers list creation from the empty board state to an Owner', async () => {
    setBoardState({ data: { ...board, lists: [] } });
    createMutation.mockResolvedValue({ id: 'list-new', boardId: 'board-1', name: 'Review', position: 4096 });
    renderBoard();

    expect(screen.getByText('No lists on this board yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create first list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
    expect(await screen.findByText('Enter a list name.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: ' Review ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
    await waitFor(() => expect(createMutation).toHaveBeenCalledWith('Review'));
  });

  it('TC-TASK-01: renders cards and exposes list controls to an Owner', () => {
    renderBoard();
    expect(screen.getByText('Study team')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getAllByText('Prepare study plan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rufta Gaiem').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Rename To do' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Delete To do' }).length).toBeGreaterThan(0);
  });

  it.each(['ADMIN', 'MEMBER'] as const)('TC-TASK-01: applies list controls for a %s role', (role) => {
    vi.mocked(useMyRole).mockReturnValue(role);
    renderBoard();

    if (role === 'ADMIN') {
      expect(screen.getAllByRole('button', { name: 'Rename To do' }).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Add list' })).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('button', { name: 'Rename To do' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add list' })).not.toBeInTheDocument();
    }
  });

  it('TC-TASK-01: renames a list with normalized input', async () => {
    renameMutation.mockResolvedValue({ id: 'list-1', boardId: 'board-1', name: 'Ready', position: 1024 });
    renderBoard();
    fireEvent.click(screen.getAllByRole('button', { name: 'Rename To do' })[0]!);
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: ' Ready ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }));
    await waitFor(() => expect(renameMutation).toHaveBeenCalledWith({ listId: 'list-1', name: 'Ready' }));
  });

  it('TC-TASK-01: confirms list deletion and explains its cards are deleted too', async () => {
    deleteMutation.mockResolvedValue(undefined);
    renderBoard();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete To do' })[0]!);
    expect(screen.getByRole('dialog', { name: 'Delete this list?' })).toHaveTextContent('also deletes all 1 card');
    fireEvent.click(screen.getByRole('button', { name: 'Delete list' }));
    await waitFor(() => expect(deleteMutation).toHaveBeenCalledWith('list-1'));
  });

  it('TC-TASK-01: reorders lists using the preceding list id, never a client position', async () => {
    moveMutation.mockResolvedValue({ id: 'list-3', boardId: 'board-1', name: 'Done', position: 1536 });
    renderBoard();
    fireEvent.click(screen.getByRole('button', { name: 'Move Done up' }));
    await waitFor(() => expect(moveMutation).toHaveBeenCalledWith({ listId: 'list-3', afterListId: 'list-1' }));
  });

  it('TC-TASK-01: shows one selected list in the mobile tab panel', () => {
    renderBoard();
    const tablist = screen.getByRole('tablist', { name: 'Board lists' });
    fireEvent.click(within(tablist).getByRole('tab', { name: 'In progress (0)' }));
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', 'board-tab-list-2');
    expect(within(panel).getByRole('heading', { name: 'In progress' })).toBeInTheDocument();
    expect(within(panel).getByText('No cards in this list yet.')).toBeInTheDocument();
  });

  it('TC-TASK-03: provides a keyboard and mobile move menu that appends after the last card', () => {
    const destinationCard = { ...card, id: 'card-destination', listId: 'list-2', position: 1024, title: 'Existing destination card' };
    const boardWithDestinationCard = {
      ...board,
      lists: [board.lists[0]!, { ...board.lists[1]!, cards: [destinationCard] }, board.lists[2]!],
    };
    setBoardState({ data: boardWithDestinationCard });
    renderBoard();

    expect(screen.getAllByRole('button', { name: 'Drag Prepare study plan' })).toHaveLength(2);
    const moveMenu = screen.getAllByLabelText('Move Prepare study plan to list')[0]!;
    moveMenu.focus();
    fireEvent.change(moveMenu, { target: { value: 'list-2' } });

    expect(moveCardMutation).toHaveBeenCalledWith({
      cardId: 'card-1',
      toListId: 'list-2',
      afterCardId: 'card-destination',
    }, expect.objectContaining({ onError: expect.any(Function) }));
  });
});
