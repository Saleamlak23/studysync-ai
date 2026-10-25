import { useNavigate } from 'react-router-dom';
import { useSession } from '@/shared/lib/session.js';
import { EmptyState, Spinner } from '@/shared/ui/index.js';
import { ProfileDialog } from './ProfileDialog.js';

// Owner: Frontend A. Requirement: FR-PROF-01.
export function ProfilePage() {
  const session = useSession();
  const navigate = useNavigate();

  if (session.status === 'loading') {
    return <main className="flex min-h-48 items-center justify-center" aria-label="Profile loading"><Spinner /></main>;
  }

  if (session.status === 'unauthenticated') {
    return (
      <main className="bg-canvas p-4 text-fg sm:p-6">
        <EmptyState title="Profile unavailable" description="Sign in to view and edit your profile." />
      </main>
    );
  }

  return <ProfileDialog user={session.user} onClose={() => navigate('/')} />;
}
