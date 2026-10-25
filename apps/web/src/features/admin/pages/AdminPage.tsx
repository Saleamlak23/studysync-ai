import { AdminUsersPanel } from '@/features/admin';

export function AdminPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight">User administration</h1>
      <AdminUsersPanel />
    </div>
  );
}
