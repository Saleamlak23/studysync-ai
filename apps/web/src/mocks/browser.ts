import { setupWorker } from 'msw/browser';
import { handlers } from './handlers.js';

export const worker = setupWorker(...handlers);

export async function startMocks(): Promise<void> {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
    await worker.start();
  }
}

if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true') {
  void startMocks();
}
