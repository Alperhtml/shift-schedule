import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { App } from '../../../App';

/** Filling shifts and drawing names are two jobs. They used to be one button, so
    anyone refreshing the shifts had their drawn names reshuffled too. SPEC §17. */
describe('rastgele doldur', () => {
  beforeEach(() => localStorage.clear());

  const toBoard = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
  };

  /** Names in the pool, entered the way a person would. */
  const fillPool = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Artır' }));
    const field = screen.getByPlaceholderText('Ad ve soyad');
    fireEvent.paste(field, { clipboardData: { getData: () => 'Ayşe Yılmaz, Burak Öztürk, Cem Aydın' } });
  };

  const openDialog = (): HTMLElement => {
    fireEvent.click(screen.getByRole('button', { name: /Rastgele doldur/ }));
    return screen.getByRole('dialog', { name: 'Rastgele doldur' });
  };

  const placeShift = async (): Promise<void> => {
    const day = screen.getAllByRole('group', { name: /gündüz nöbeti/i })[0];
    if (!day) throw new Error('no day zone');
    fireEvent.click(within(day).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: /İntörn 1/ }));
  };

  const chipCount = (): number => screen.queryAllByRole('button', { name: /nöbeti$/ }).length;

  it('asks nothing when the board and the pool are both empty', () => {
    render(<App />);
    toBoard();
    fireEvent.click(screen.getByRole('button', { name: /Rastgele doldur/ }));
    expect(screen.queryByRole('dialog', { name: 'Rastgele doldur' })).not.toBeInTheDocument();
  });

  it('asks on an empty board as soon as the pool has names', () => {
    render(<App />);
    fillPool();
    toBoard();
    const d = openDialog();
    // Names used to be handed out here with no dialog at all.
    expect(within(d).getByText('Nöbetleri ve isimleri dağıt')).toBeInTheDocument();
    expect(within(d).getByText('Sadece nöbetleri dağıt')).toBeInTheDocument();
    expect(within(d).getByText('Sadece isimleri dağıt')).toBeInTheDocument();
  });

  it('offers no name rows when there is nothing in the pool', async () => {
    render(<App />);
    toBoard();
    await placeShift();
    const d = openDialog();
    expect(within(d).getByText('Sadece nöbetleri dağıt')).toBeInTheDocument();
    expect(within(d).queryByText('Sadece isimleri dağıt')).not.toBeInTheDocument();
    expect(within(d).queryByText('Nöbetleri ve isimleri dağıt')).not.toBeInTheDocument();
  });

  it('preselects nothing, so Enter cannot run a job nobody picked', () => {
    render(<App />);
    fillPool();
    toBoard();
    const d = openDialog();
    // Cancel is the only button in the footer; every job is its own row.
    expect(within(d).getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument();
    expect(within(d).queryByRole('button', { name: 'Doldur' })).not.toBeInTheDocument();
    expect(within(d).queryByRole('radio')).not.toBeInTheDocument();
  });

  it('starts with keep-what-is-there on whenever the board holds anything', async () => {
    render(<App />);
    toBoard();
    await placeShift();
    const d = openDialog();
    // Nobody should lose their own placements by not reading a switch.
    expect(within(d).getByRole('switch', { name: 'Tabloda olanlar kalsın' })).toBeChecked();
    expect(within(d).getByText(/yalnızca boş kalanlar doldurulacak/)).toBeInTheDocument();
  });

  it('forgets a turned-off switch, so the safe setting comes back next time', async () => {
    render(<App />);
    toBoard();
    await placeShift();
    const off = within(openDialog()).getByRole('switch', { name: 'Tabloda olanlar kalsın' });
    fireEvent.click(off);
    expect(off).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }));

    expect(within(openDialog()).getByRole('switch', { name: 'Tabloda olanlar kalsın' })).toBeChecked();
  });

  it('drawing names only leaves every shift where it was', async () => {
    render(<App />);
    fillPool();
    toBoard();
    await placeShift();
    expect(chipCount()).toBe(1);

    fireEvent.click(within(openDialog()).getByText('Sadece isimleri dağıt'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Rastgele doldur' })).not.toBeInTheDocument());
    expect(chipCount()).toBe(1);
    // The pool names landed on the interns that had none.
    expect(screen.getAllByText(/Ayşe Yılmaz|Burak Öztürk|Cem Aydın/).length).toBeGreaterThan(0);
  });

  it('filling shifts only leaves every name where it was', async () => {
    render(<App />);
    fillPool();
    toBoard();
    fireEvent.click(within(openDialog()).getByText('Sadece isimleri dağıt'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Names only. The shift counts beside them are meant to change.
    const roster = (): string[] =>
      (screen.getByRole('region', { name: 'İntörnler' }).textContent ?? '')
        .match(/Ayşe Yılmaz|Burak Öztürk|Cem Aydın/g) ?? [];
    const named = roster();
    expect(named).toHaveLength(3);

    fireEvent.click(within(openDialog()).getByText('Sadece nöbetleri dağıt'));
    await waitFor(() => expect(screen.getByText('Sorun yok')).toBeInTheDocument(), { timeout: 25_000 });
    // The board filled, and not one name moved with it.
    expect(roster()).toEqual(named);
  }, 30_000);

  it('each row carries an i that opens on a tap, since a phone has no hover', async () => {
    render(<App />);
    fillPool();
    toBoard();
    const d = openDialog();
    const dot = within(d).getAllByRole('button', { name: 'Sadece isimleri dağıt' })
      .find(b => b.querySelector('svg'));
    if (!dot) throw new Error('no info button');
    fireEvent.click(dot);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Panodaki nöbetlere dokunmaz');
    // Tapping the i must not run the row underneath it.
    expect(screen.getByRole('dialog', { name: 'Rastgele doldur' })).toBeInTheDocument();
  });
});
