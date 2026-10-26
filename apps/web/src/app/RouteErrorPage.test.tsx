import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RouteErrorPage } from './RouteErrorPage.js';

afterEach(() => {
  cleanup();
});

describe('RouteErrorPage', () => {
  it('TC-UX-01: hides technical details and provides dashboard navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <Routes>
          <Route path="/broken" element={<RouteErrorPage />} />
          <Route path="/" element={<h1>Dashboard</h1>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'We hit a snag' })).toBeInTheDocument();
    expect(screen.getByText(/We couldn't load this page/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sensitive module stack trace/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
