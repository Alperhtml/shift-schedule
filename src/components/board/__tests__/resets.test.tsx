import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../../App';

/** Three resets, three scopes. SPEC §15. */
describe('resets', () => {
  beforeEach(() => localStorage.clear());

  /** A board with a named intern and one shift on it. */
  const seed = async (): Promise<void> => {
    render(<App />);
    const first = screen.getAllByPlaceholderText(/İntörn \d/)[0];
    if (!first) throw new Error('no name field');
    fireEvent.change(first, { target: { value: 'Ayşe Yılmaz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
    // Assign through the slot popover, the same path a tap takes.
    const day = screen.getAllByRole('group', { name: /gündüz nöbeti/i })[0];
    if (!day) throw new Error('no day zone');
    fireEvent.click(within(day).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: /Ayşe Yılmaz/ }));
  };

  const chipCount = (): number => screen.queryAllByRole('button', { name: /nöbeti$/ }).length;

  it('the board reset empties the table and leaves the names', async () => {
    await seed();
    expect(chipCount()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Tabloyu sıfırla' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sıfırla' }));
    expect(chipCount()).toBe(0);
    expect(screen.getByText('Ayşe Yılmaz')).toBeInTheDocument();
  });

  it('the list reset clears the names and leaves the table', async () => {
    await seed();
    fireEvent.click(screen.getByRole('button', { name: 'Listeyi sıfırla' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sıfırla' }));
    expect(chipCount()).toBe(1);
    expect(screen.queryByText('Ayşe Yılmaz')).not.toBeInTheDocument();
  });

  it('the list reset is unavailable while there is no name to clear', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
    expect(screen.getByRole('button', { name: 'Listeyi sıfırla' })).toBeDisabled();
  });

  it('starting over goes back to the first screen with nothing on it', async () => {
    await seed();
    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    const sheet = screen.getByRole('dialog', { name: 'Ayarlar' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'En baştan başla' }));
    const confirm = screen.getByRole('dialog', { name: 'En baştan başla' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'En baştan başla' }));

    expect(screen.getByRole('button', { name: 'Panoya geç' })).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/İntörn \d/)).toHaveLength(6);
    expect(screen.getAllByPlaceholderText(/İntörn \d/).every(i => (i as HTMLInputElement).value === '')).toBe(true);
    // A shared link must not bring the old schedule back on the next reload.
    expect(location.hash).toBe('');
  });

  it('the mode switch goes straight through when nothing would be lost', async () => {
    await seed();
    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    const settings = screen.getByRole('dialog', { name: 'Ayarlar' });
    // Only the first person has a name and a shift, so the other five empty
    // interns are not a loss and there is nothing to ask about.
    fireEvent.click(within(settings).getByRole('radio', { name: 'Kendi programım' }));
    expect(screen.queryByRole('dialog', { name: 'Kendi programıma geç' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: 'Ayarlar' })).getByText('Siz')).toBeInTheDocument();
  });

  it('the mode switch asks first when someone else would lose their shifts', async () => {
    await seed();
    // Give a second person a shift; going solo would now throw it away.
    const night = screen.getAllByRole('group', { name: /gece nöbeti/i })[3];
    if (!night) throw new Error('no night zone');
    fireEvent.click(within(night).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: /İntörn 2/ }));
    expect(chipCount()).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    const sheet = screen.getByRole('dialog', { name: 'Ayarlar' });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'Kendi programım' }));

    const confirm = screen.getByRole('dialog', { name: 'Kendi programıma geç' });
    expect(confirm).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Geç' }));
    expect(within(screen.getByRole('dialog', { name: 'Ayarlar' })).getByText('Siz')).toBeInTheDocument();
  });
});
