import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { App } from '../../../App';

function toBoard(): void {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
}

/** Zones are groups; chips are buttons, and their labels also end in "nöbeti". */
const zones = (type: 'gündüz' | 'gece'): HTMLElement[] =>
  screen.getAllByRole('group', { name: new RegExp(`${type} nöbeti`, 'i') });

const zone = (type: 'gündüz' | 'gece', index: number): HTMLElement => {
  const node = zones(type)[index];
  if (!node) throw new Error(`no ${type} zone at ${index}`);
  return node;
};

describe('board', () => {
  beforeEach(() => localStorage.clear());

  it('renders 56 slot zones with hour labels', () => {
    toBoard();
    expect(zones('gündüz')).toHaveLength(28);
    expect(zones('gece')).toHaveLength(28);
    expect(zones('gündüz')[0]).toHaveAccessibleName(/7 Eyl Pzt gündüz nöbeti, Boş/);
    expect(screen.getAllByText('08-20')).toHaveLength(28);
    expect(screen.getAllByText('20-08')).toHaveLength(28);
  });

  it('assigns through the popover and shows a violation badge for a post-night day', async () => {
    toBoard();
    fireEvent.click(within(zone('gece', 0)).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: /İntörn 1/ }));

    fireEvent.click(within(zone('gündüz', 1)).getByRole('button', { name: /ekle/i }));
    const option = await screen.findByRole('option', { name: /İntörn 1/ });
    expect(option).toHaveTextContent('Kural ihlali oluşturur');
    fireEvent.click(option);

    expect(within(zone('gündüz', 1)).getByLabelText('Kural ihlali')).toBeInTheDocument();
    const checks = screen.getByLabelText('Denetim');
    expect(within(checks).getByText(/gece nöbetinden sonra ertesi gün gündüz nöbeti olamaz/)).toBeInTheDocument();
  });

  it('undo and redo put the assignment back', async () => {
    toBoard();
    fireEvent.click(within(zone('gündüz', 0)).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: /İntörn 2/ }));
    expect(within(zone('gündüz', 0)).getByText('İntörn 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(within(zone('gündüz', 0)).queryByText('İntörn 2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yinele' }));
    expect(within(zone('gündüz', 0)).getByText('İntörn 2')).toBeInTheDocument();
  });

  it('randomize fills a board with no rule violation at all', async () => {
    toBoard();
    fireEvent.click(screen.getByRole('button', { name: /Rastgele doldur/ }));
    await waitFor(() => expect(screen.getByText('Sorun yok')).toBeInTheDocument(), { timeout: 25_000 });
    expect(screen.getAllByText('G 8/8 · N 8/8')).toHaveLength(6);
  }, 30_000);

  it('Delete on a focused chip removes it and undo puts it back', async () => {
    toBoard();
    fireEvent.click(within(zone('gündüz', 0)).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: /İntörn 4/ }));
    const chip = within(zone('gündüz', 0)).getByText('İntörn 4');
    fireEvent.keyDown(chip, { key: 'Delete' });
    expect(within(zone('gündüz', 0)).queryByText('İntörn 4')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }));
    expect(within(zone('gündüz', 0)).getByText('İntörn 4')).toBeInTheDocument();
  });

  it('the matrix view lists every intern with totals', () => {
    toBoard();
    fireEvent.click(screen.getByRole('radio', { name: 'Matris' }));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(screen.getByText(/G: gündüz 08:00-20:00/)).toBeInTheDocument();
  });
});
