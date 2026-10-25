import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage.js';
import { api, getAccessToken } from '@/shared/lib/api.js';
import { restoreSession, setSession, useSession } from '@/shared/lib/session.js';

vi.mock('@/shared/lib/api.js', () => ({
  api: vi.fn(),
  getAccessToken: vi.fn(() => 'access-token'),
}));

vi.mock('@/shared/lib/session.js', () => ({
  useSession: vi.fn(),
  setSession: vi.fn(),
  restoreSession: vi.fn(),
}));

const user = {
  id: 'user-1',
  name: 'Rufta Gaiem',
  email: 'rufta@example.com',
  avatarUrl: null,
  bio: 'Student',
  systemRole: 'USER' as const,
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({ status: 'authenticated', user });
    vi.mocked(getAccessToken).mockReturnValue('access-token');
  });

  afterEach(cleanup);

  it('TC-PROF-01: validates required name and avatar URL before saving', async () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Avatar URL'), { target: { value: 'not a URL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid avatar URL.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('TC-PROF-01: submits normalized profile data and updates the session', async () => {
    const updatedUser = { ...user, name: 'Ada Lovelace', bio: 'Mathematician', avatarUrl: 'https://example.com/ada.png' };
    vi.mocked(api).mockResolvedValue(updatedUser);
    renderProfile();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Ada Lovelace ' } });
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: ' Mathematician ' } });
    fireEvent.change(screen.getByLabelText('Avatar URL'), { target: { value: ' https://example.com/ada.png ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/me', {
        method: 'PATCH',
        body: { name: 'Ada Lovelace', bio: 'Mathematician', avatarUrl: 'https://example.com/ada.png' },
      });
    });
    expect(setSession).toHaveBeenCalledWith(updatedUser, 'access-token');
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
    expect(screen.getByRole('img', { name: 'Avatar preview' })).toHaveAttribute('src', updatedUser.avatarUrl);
  });

  it('TC-PROF-01: clears the avatar by submitting null', async () => {
    const userWithAvatar = { ...user, avatarUrl: 'https://example.com/current.png' };
    vi.mocked(useSession).mockReturnValue({ status: 'authenticated', user: userWithAvatar });
    vi.mocked(api).mockResolvedValue({ ...userWithAvatar, avatarUrl: null });
    renderProfile();

    fireEvent.click(screen.getByRole('button', { name: 'Remove avatar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(api).toHaveBeenCalledWith('/me', {
        method: 'PATCH',
        body: { name: 'Rufta Gaiem', bio: 'Student', avatarUrl: null },
      });
    });
    expect(setSession).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null }), 'access-token');
    expect(screen.getByText('Using your initials')).toBeInTheDocument();
  });

  it('TC-PROF-01: restores the session if an access token is not available after save', async () => {
    vi.mocked(getAccessToken).mockReturnValue(null);
    vi.mocked(api).mockResolvedValue(user);
    renderProfile();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(restoreSession).toHaveBeenCalled());
    expect(setSession).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Profile saved.');
  });

  it('TC-PROF-01: displays API save errors and keeps the dialog open', async () => {
    vi.mocked(api).mockRejectedValue(new Error('Profile service is unavailable.'));
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile service is unavailable.');
    expect(screen.getByRole('dialog', { name: 'Edit profile' })).toBeInTheDocument();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('TC-PROF-01: closes the profile dialog and returns to the dashboard', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  });

  it('TC-PROF-01: shows loading and unavailable states when no profile can be edited', () => {
    vi.mocked(useSession).mockReturnValue({ status: 'loading', user: null });
    const { rerender } = renderProfile();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();

    vi.mocked(useSession).mockReturnValue({ status: 'unauthenticated', user: null });
    rerender(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes><Route path="/profile" element={<ProfilePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Profile unavailable')).toBeInTheDocument();
  });
});
