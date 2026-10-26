import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sheet } from './Sheet.js';

afterEach(cleanup);

describe('Sheet', () => {
  it('TC-NFR-12: keeps keyboard focus inside and returns it to the trigger', () => {
    function SheetHarness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open sheet</button>
          <Sheet open={open} onOpenChange={setOpen} title="Search panel">
            <button type="button">First result</button>
            <button type="button">Last result</button>
          </Sheet>
        </>
      );
    }

    render(<SheetHarness />);
    const trigger = screen.getByRole('button', { name: 'Open sheet' });
    trigger.focus();
    fireEvent.click(trigger);

    const sheet = screen.getByRole('dialog', { name: 'Search panel' });
    const close = within(sheet).getByRole('button', { name: 'Close' });
    const lastResult = within(sheet).getByRole('button', { name: 'Last result' });

    lastResult.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(lastResult).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Search panel' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
