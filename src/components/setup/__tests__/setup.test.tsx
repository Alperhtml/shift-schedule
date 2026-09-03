import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../../App';

describe('setup', () => {
  beforeEach(() => localStorage.clear());

  it('shows the period card first, then interns, then staffing with the arithmetic line', () => {
    render(<App />);
    expect(screen.getByText('Dönem')).toBeInTheDocument();
    expect(screen.getByText('İntörnler')).toBeInTheDocument();
    expect(screen.queryByText('Kadro')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Artır' }));
    expect(screen.getByText('Kadro')).toBeInTheDocument();
    expect(screen.getByText(/7 intörn × 16 nöbet = 112 atama/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
    expect(screen.getByRole('radio', { name: 'Takvim' })).toBeInTheDocument();
  });

  it('switches the whole interface to English, dates included', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'EN' }));
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    expect(screen.getByText('Interns')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to board' })).toBeInTheDocument();
    // The dates must follow the switch too, not only the dictionary strings.
    expect(screen.getByText(/7 September 2026 to 4 October 2026, 4 weeks/)).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'TR' }));
    expect(screen.getByText(/7 Eylül 2026 ile 4 Ekim 2026 arası, 4 hafta/)).toBeInTheDocument();
    expect(screen.getByText('Pzt')).toBeInTheDocument();
  });
});
