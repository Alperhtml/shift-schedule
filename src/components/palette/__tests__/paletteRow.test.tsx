import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { App } from '../../../App';

function toBoard(): void {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
}

const palette = (): HTMLElement => screen.getByRole('region', { name: 'İntörnler' });

describe('palette row rename', () => {
  beforeEach(() => localStorage.clear());

  it('opens an editor on click and does not start a drag', () => {
    toBoard();
    const pencil = within(palette()).getAllByRole('button', { name: /İsmi değiştir/ })[0] as HTMLElement;
    fireEvent.mouseDown(pencil, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 40 });
    // A drag would have put an overlay copy of the chip on the page.
    expect(within(palette()).queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(pencil);
    const field = within(palette()).getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Ayşe Yılmaz' } });
    fireEvent.blur(field);
    expect(within(palette()).getByText('Ayşe Yılmaz')).toBeInTheDocument();
  });

  it('is reachable with the keyboard', () => {
    toBoard();
    const pencil = within(palette()).getAllByRole('button', { name: /İsmi değiştir/ })[0] as HTMLElement;
    pencil.focus();
    expect(document.activeElement).toBe(pencil);
    fireEvent.keyDown(pencil, { key: 'Enter', code: 'Enter' });
    fireEvent.click(pencil);
    expect(within(palette()).getByRole('textbox')).toBeInTheDocument();
  });

  it('a typed name is pinned, so a pool draw leaves it alone', () => {
    toBoard();
    const pencil = within(palette()).getAllByRole('button', { name: /İsmi değiştir/ })[0] as HTMLElement;
    fireEvent.click(pencil);
    const field = within(palette()).getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Sabit İsim' } });
    fireEvent.blur(field);

    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    const sheet = screen.getByRole('dialog', { name: 'Ayarlar' });
    const poolField = within(sheet).getByLabelText('İsim');
    for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
      fireEvent.change(poolField, { target: { value: name } });
      fireEvent.keyDown(poolField, { key: 'Enter' });
    }
    fireEvent.click(within(sheet).getByRole('button', { name: 'İsimleri dağıt' }));
    // Only the intern name fields; the pool's own input is a text box too.
    const values = within(sheet)
      .getAllByRole('textbox')
      .filter(f => (f.getAttribute('aria-label') ?? '').startsWith('İsim (isteğe bağlı)'))
      .map(f => (f as HTMLInputElement).value);
    expect(values).toHaveLength(6);
    expect(values[0]).toBe('Sabit İsim');
    expect(values.filter(v => v === '')).toHaveLength(0);
  });
});
