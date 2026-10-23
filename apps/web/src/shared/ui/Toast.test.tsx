import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './Toast.js';

function ToastTrigger() {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast('Saved', { variant: 'success' })}>
      Show toast
    </button>
  );
}

describe('Toast', () => {
  it('announces toast in a live region', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show toast' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
