import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input.js';

describe('Input', () => {
  it('associates label, input and error message', () => {
    render(<Input id="email" label="Email" error="Enter a valid email" name="email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByText('Enter a valid email')).toHaveAttribute('id', 'email-error');
  });
});
