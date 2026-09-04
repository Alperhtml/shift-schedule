import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../../App';

describe('palette and diagnostics', () => {
  beforeEach(() => localStorage.clear());

  it('shows the quota counts and the grouped checks', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
    expect(screen.getAllByText('G 0/8 · N 0/8')).toHaveLength(6);
    expect(screen.getByText(/Eksik kotalar/)).toHaveTextContent('12');
    // Staffing is not reported until the board has been started.
    expect(screen.queryByText(/^Kadro/)).not.toBeInTheDocument();
  });
});
