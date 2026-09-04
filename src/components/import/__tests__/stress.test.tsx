import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../../App';
import { STORAGE_KEY, BACKUP_KEY } from '../../../state/persistence';

/** Fixes from the stress test of 4 September 2026. SPEC §16. */
describe('stress test fixes', () => {
  beforeEach(() => localStorage.clear());

  const toBoard = (): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
  };
  const openExport = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /Dışa aktar/ }));
  };
  const zone = (type: 'gündüz' | 'gece', index: number): HTMLElement => {
    const node = screen.getAllByRole('group', { name: new RegExp(`${type} nöbeti`, 'i') })[index];
    if (!node) throw new Error(`no ${type} zone at ${index}`);
    return node;
  };
  const assign = async (type: 'gündüz' | 'gece', index: number, who: RegExp): Promise<void> => {
    fireEvent.click(within(zone(type, index)).getByRole('button', { name: /ekle/i }));
    fireEvent.click(await screen.findByRole('option', { name: who }));
  };

  it('refuses to export a solo file with no name on it', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: 'Kendi programım' }));
    toBoard();
    openExport();
    fireEvent.click(screen.getByRole('menuitem', { name: /JSON dosyası/ }));
    // The file would be refused by the merge later, when it is too late to fix.
    expect(screen.getByRole('dialog', { name: 'Önce adınızı yazın' })).toBeInTheDocument();
  });

  it('asks before exporting a schedule that breaks rest rules', async () => {
    render(<App />);
    toBoard();
    await assign('gece', 0, /İntörn 1/);
    await assign('gündüz', 1, /İntörn 1/);
    openExport();
    fireEvent.click(screen.getByRole('menuitem', { name: /JSON dosyası/ }));
    const dialog = screen.getByRole('dialog', { name: 'Dosyada kural ihlali var' });
    expect(dialog).toHaveTextContent('1 dinlenme kuralı ihlali');
  });

  it('exports without a word when the schedule is clean', async () => {
    render(<App />);
    toBoard();
    await assign('gündüz', 0, /İntörn 1/);
    openExport();
    fireEvent.click(screen.getByRole('menuitem', { name: /JSON dosyası/ }));
    expect(screen.queryByRole('dialog', { name: 'Dosyada kural ihlali var' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Önce adınızı yazın' })).not.toBeInTheDocument();
  });

  it('hands back an unreadable draft instead of dropping it', () => {
    const doomed = JSON.stringify({ schedule: { version: 1, startDate: 'salı' } });
    localStorage.setItem(STORAGE_KEY, doomed);
    render(<App />);
    expect(screen.getByRole('dialog', { name: 'Kayıtlı program açılamadı' })).toBeInTheDocument();
    expect(localStorage.getItem(BACKUP_KEY)).toBe(doomed);
    fireEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.queryByRole('dialog', { name: 'Kayıtlı program açılamadı' })).not.toBeInTheDocument();
    // The app still starts rather than refusing to open.
    expect(screen.getByRole('button', { name: 'Panoya geç' })).toBeInTheDocument();
  });

  it('a pasted list of names becomes several names, not one long one', () => {
    render(<App />);
    // The pool card appears once the interns card has been touched.
    fireEvent.click(screen.getByRole('button', { name: 'Artır' }));
    const field = screen.getByPlaceholderText('Ad ve soyad');
    fireEvent.paste(field, { clipboardData: { getData: () => 'Ayşe Yılmaz\nBurak Öztürk, Cem Aydın' } });
    expect(screen.getByText('Ayşe Yılmaz')).toBeInTheDocument();
    expect(screen.getByText('Burak Öztürk')).toBeInTheDocument();
    expect(screen.getByText('Cem Aydın')).toBeInTheDocument();
  });
});
