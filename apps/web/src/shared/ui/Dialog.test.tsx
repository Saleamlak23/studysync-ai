import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog.js';

afterEach(() => {
  cleanup();
});

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
    
    // Scope the query inside the specific dialog to avoid matching multiple elements across tests
    const dialog = screen.getByRole('dialog', { name: 'Invite member' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});