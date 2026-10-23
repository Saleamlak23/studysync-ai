import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/shared/ui/index.js';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
