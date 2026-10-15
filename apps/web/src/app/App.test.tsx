import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';
describe('application scaffold', () => { it('renders the app', () => { render(<App />); expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument(); }); });
