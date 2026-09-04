import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../../App';

/** Import is its own control, and solo mode is a roster of one. SPEC §14. */
describe('import menu and solo mode', () => {
  beforeEach(() => localStorage.clear());

  const toBoard = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
  };

  it('holds both import paths, and export no longer does', () => {
    render(<App />);
    toBoard();
    fireEvent.click(screen.getByRole('button', { name: /İçe aktar/ }));
    expect(screen.getByRole('menuitem', { name: 'JSON dosyası' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Programları birleştir' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /Dışa aktar/ }));
    expect(screen.queryByRole('menuitem', { name: /içe aktar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Excel' })).toBeInTheDocument();
  });

  it('opens the merge dialog with nothing chosen and nothing to apply', () => {
    render(<App />);
    toBoard();
    fireEvent.click(screen.getByRole('button', { name: /İçe aktar/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Programları birleştir' }));
    expect(screen.getByRole('dialog', { name: 'Programları birleştir' })).toBeInTheDocument();
    expect(screen.getByText('Henüz dosya seçilmedi.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Panoya aktar' })).toBeDisabled();
  });

  it('solo mode collapses the setup to one person and hides the team cards', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Kendi programım' }));
    expect(screen.getByText('Siz')).toBeInTheDocument();
    expect(screen.queryByText('İntörn sayısı')).not.toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Adınız')).toHaveLength(1);

    // Back to a team: the roster returns and so do the team controls.
    fireEvent.click(screen.getByRole('radio', { name: 'Takım programı' }));
    expect(screen.getByText('İntörn sayısı')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/İntörn \d/)).toHaveLength(6);
  });

  it('an empty team board reports understaffing on all 56 slots, an empty solo board on none', () => {
    const { unmount } = render(<App />);
    toBoard();
    expect(screen.getByText('Kadro (56)')).toBeInTheDocument();
    unmount();

    localStorage.clear();
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Kendi programım' }));
    toBoard();
    // One person cannot staff 56 slots, so the warning would be noise on every day.
    expect(screen.queryByText(/^Kadro \(/)).not.toBeInTheDocument();
  });
});
