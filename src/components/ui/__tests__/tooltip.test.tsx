import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../../App';

function toBoard(): void {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Panoya geç' }));
}

describe('tooltips', () => {
  beforeEach(() => localStorage.clear());

  it('does not hang over the page after a dialog hands focus back', async () => {
    toBoard();
    const settings = screen.getByRole('button', { name: 'Ayarlar' });
    // A mouse press, then the sheet opens and closes; focus returns to the button.
    // jsdom does not focus on click the way a browser does, so do it here.
    fireEvent.pointerDown(settings, { pointerType: 'mouse' });
    settings.focus();
    fireEvent.click(settings);
    expect(await screen.findByRole('dialog', { name: 'Ayarlar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }));
    expect(screen.queryByRole('dialog', { name: 'Ayarlar' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(settings);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('still shows on a keyboard focus', async () => {
    toBoard();
    const settings = screen.getByRole('button', { name: 'Ayarlar' });
    fireEvent.keyDown(window, { key: 'Tab' });
    fireEvent.focus(settings);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Ayarlar');
  });
});
