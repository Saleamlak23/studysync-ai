import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        return !(error instanceof Error && 'status' in error && error.status === 401);
      },
    },
    mutations: { retry: false },
  },
});
