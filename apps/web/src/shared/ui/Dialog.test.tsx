import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { useState } from 'react';
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

  it('TC-NFR-12: traps keyboard focus and returns it to the opener when closed', () => {
    function DialogHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
          <Dialog open={open} title="Accessible dialog" onOpenChange={setOpen}>
            <button type="button">First action</button>
            <button type="button">Last action</button>
          </Dialog>
        </>
      );
    }

    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Accessible dialog' });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const lastAction = within(dialog).getByRole('button', { name: 'Last action' });

    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(lastAction).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(close).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Accessible dialog' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
