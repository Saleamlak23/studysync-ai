import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@/shared/ui/index.js';

export function RouteErrorPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-8 text-fg">
      <Card className="w-full max-w-md p-6 text-center shadow-md">
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-full bg-danger-bg text-danger">
          <AlertTriangle aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">We hit a snag</h1>
        <p className="mt-2 text-sm text-fg-muted">
          We couldn&apos;t load this page. Try again, or return to your dashboard.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try again
          </Button>
          <Button variant="secondary" onClick={() => navigate('/', { replace: true })}>
            Go to dashboard
          </Button>
        </div>
      </Card>
    </main>
  );
}
