import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { queryClient } from '@/shared/lib/queryClient.js';
import { SessionProvider } from '@/shared/lib/session.js';
import { ToastProvider } from '@/shared/ui/index.js';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ToastProvider>{children}</ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
