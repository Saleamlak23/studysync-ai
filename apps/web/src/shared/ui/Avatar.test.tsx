import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar.js';

describe('Avatar', () => {
  it('shows initials when no image is provided', () => {
    render(<Avatar name="Rufta Gaiem" />);
    expect(screen.getByLabelText('Rufta Gaiem')).toHaveTextContent('RG');
  });

  it('renders image with alt text when src is set', () => {
    render(<Avatar name="Rufta Gaiem" src="/avatar.png" alt="Profile photo" />);
    expect(screen.getByRole('img', { name: 'Profile photo' })).toBeInTheDocument();
  });
});
