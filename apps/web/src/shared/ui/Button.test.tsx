import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('renders with accessible name', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('disables and shows busy state while loading', () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole('button', { name: 'Submit' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});
