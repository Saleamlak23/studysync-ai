import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.js';

describe('Dialog', () => {
  it('exposes dialog semantics when open', () => {
    render(
      <Dialog open title="Create workspace" onOpenChange={() => undefined}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Create workspace' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('calls onOpenChange when Close is activated', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open title="Invite member" onOpenChange={onOpenChange}>
        <p>Form</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
