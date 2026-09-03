import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom(): never {
  throw new Error('deliberate');
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a readable page with a way out instead of a blank one', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Bir şeyler ters gitti')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yenile/ })).toBeInTheDocument();
    expect(screen.getByText(/kaybolmadı/)).toBeInTheDocument();
  });

  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary><p>çalışıyor</p></ErrorBoundary>);
    expect(screen.getByText('çalışıyor')).toBeInTheDocument();
    expect(screen.queryByText('Bir şeyler ters gitti')).not.toBeInTheDocument();
  });
});
