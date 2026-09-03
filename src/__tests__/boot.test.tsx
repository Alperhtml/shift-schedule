import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { createSchedule } from '../engine/schedule';
import { encodeHash } from '../engine/codec';
import { solve } from '../engine/solver';
import { STORAGE_KEY } from '../state/persistence';
import type { Schedule } from '../engine/types';

function filled(): Schedule {
  const s = createSchedule('2026-09-07', 5);
  s.interns = s.interns.map((i, k) => ({ ...i, realName: k === 0 ? 'Ayşe' : '' }));
  s.assignments = solve(s, { seed: 4, moves: 3000, restarts: 1 }).assignments;
  return s;
}

describe('boot from a share link', () => {
  beforeEach(() => {
    localStorage.clear();
    location.hash = '';
  });
  afterEach(() => {
    location.hash = '';
  });

  it('loads silently onto the board when there is no draft', async () => {
    const s = filled();
    location.hash = `#${encodeHash(s)}`;
    render(<App />);
    expect(await screen.findByText('Program bağlantıdan yüklendi')).toBeInTheDocument();
    expect(screen.getByLabelText('Denetim')).toBeInTheDocument();
    expect(screen.getAllByText('Ayşe').length).toBeGreaterThan(0);
  });

  it('asks before replacing a draft that has content', async () => {
    const draft = createSchedule('2026-09-14', 4);
    draft.assignments = [{ internId: 'intern-1', dayIndex: 2, type: 'DAY', locked: false }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule: draft, ui: { lang: 'tr', theme: 'system', step: 'board', view: 'calendar' } }));
    location.hash = `#${encodeHash(filled())}`;
    render(<App />);
    expect(await screen.findByText('Mevcut taslağın yerine bağlantıdaki program açılsın mı?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yükle' }));
    expect(await screen.findByText('Program bağlantıdan yüklendi')).toBeInTheDocument();
  });

  it('reports a corrupted link and still shows a working app', async () => {
    location.hash = '#v1.20260907.4.1..notagrid';
    render(<App />);
    expect(await screen.findByText('Bağlantı okunamadı')).toBeInTheDocument();
    expect(screen.getByText('Dönem')).toBeInTheDocument();
  });

  it('restores the stored draft on a plain reload', () => {
    const draft = createSchedule('2026-09-14', 7);
    draft.interns = draft.interns.map(i => ({ ...i, realName: `Dr ${i.index}` }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schedule: draft, ui: { lang: 'en', theme: 'dark', step: 'board', view: 'matrix' } }));
    render(<App />);
    expect(screen.getByRole('radio', { name: 'Matrix' })).toBeInTheDocument();
    expect(screen.getAllByText('Dr 7').length).toBeGreaterThan(0);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
