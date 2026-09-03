import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../../App';

const typeInto = (el: HTMLElement, value: string): void => {
  fireEvent.change(el, { target: { value } });
};

function openSetupWithPool(): void {
  render(<App />);
  // The staffing and pool cards appear once the interns card is touched.
  fireEvent.click(screen.getByRole('button', { name: 'Artır' }));
}

describe('name pool', () => {
  beforeEach(() => localStorage.clear());

  it('hands names to the blanks and never touches a typed name', () => {
    openSetupWithPool();
    const interns = screen.getByRole('heading', { name: 'İntörnler' }).parentElement as HTMLElement;
    const fields = within(interns).getAllByRole('textbox');
    typeInto(fields[0] as HTMLElement, 'Ayşe Yılmaz');
    typeInto(fields[3] as HTMLElement, 'Emre Şahin');

    // A name only enters the pool when it is committed.
    const pool = screen.getByLabelText('İsim');
    for (const name of ['Mehmet Demir', 'Zeynep Kaya', 'Elif Çelik', 'Burak Öztürk', 'Deniz Arslan']) {
      typeInto(pool, name);
      fireEvent.keyDown(pool, { key: 'Enter' });
    }
    expect((pool as HTMLInputElement).value).toBe('');
    expect(screen.getByText('5 isim, 5 intörn adsız')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'İsimleri dağıt' }));

    const after = within(interns).getAllByRole('textbox').map(f => (f as HTMLInputElement).value);
    expect(after[0]).toBe('Ayşe Yılmaz');
    expect(after[3]).toBe('Emre Şahin');
    expect(after.filter(v => v === '')).toHaveLength(0);
    expect(new Set(after).size).toBe(after.length);
  });

  it('cannot hand out names when there is nothing to hand out', () => {
    openSetupWithPool();
    expect(screen.getByRole('button', { name: 'İsimleri dağıt' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ekle' })).toBeDisabled();
    expect(screen.getByText('Havuzda henüz isim yok')).toBeInTheDocument();

    // Whitespace is not a name, and Enter on it adds nothing.
    const field = screen.getByLabelText('İsim');
    typeInto(field, '   ');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByText('0 isim, 7 intörn adsız')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İsimleri dağıt' })).toBeDisabled();
  });

  it('keeps a two-word name whole, refuses a repeat and can drop one again', () => {
    openSetupWithPool();
    const field = screen.getByLabelText('İsim');
    typeInto(field, 'Mehmet Ali Yılmazoğlu');
    fireEvent.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(screen.getByText('Mehmet Ali Yılmazoğlu')).toBeInTheDocument();
    expect(screen.getByText('1 isim, 7 intörn adsız')).toBeInTheDocument();

    typeInto(field, 'mehmet ali yılmazoğlu');
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByText('Bu isim listede zaten var')).toBeInTheDocument();
    expect(screen.getByText('1 isim, 7 intörn adsız')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mehmet Ali Yılmazoğlu adını havuzdan kaldır/ }));
    expect(screen.getByText('0 isim, 7 intörn adsız')).toBeInTheDocument();
  });
});
