// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nowyProjektZRewersem = vi.fn();
vi.mock('../baza', () => ({
  nowyProjektZRewersem: (...a: unknown[]) => nowyProjektZRewersem(...a),
}));

import { WybierzStroneSzablonu } from './WybierzStroneSzablonu';

beforeEach(() => {
  nowyProjektZRewersem.mockReset();
  window.location.hash = '';
});
afterEach(cleanup);

describe('WybierzStroneSzablonu', () => {
  it('pokazuje Awers (link do kreatora) i Rewers (przycisk)', () => {
    render(<WybierzStroneSzablonu />);
    expect(screen.getByRole('link', { name: /^Awers/ }).getAttribute('href')).toBe(
      '#/wlasne/nowy/awers',
    );
    expect(screen.getByRole('button', { name: /^Rewers/ })).toBeTruthy();
  });

  it('dwuklik na Rewers tworzy jeden projekt i otwiera edytor rewersu', async () => {
    let koniec!: (v: { id: string; rewersId: string }) => void;
    nowyProjektZRewersem.mockReturnValue(new Promise((r) => (koniec = r)));
    render(<WybierzStroneSzablonu />);
    const btn = screen.getByRole('button', { name: /^Rewers/ });
    const linkAwers = screen.getByRole('link', { name: /^Awers/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(nowyProjektZRewersem).toHaveBeenCalledTimes(1);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(linkAwers.getAttribute('aria-disabled')).toBe('true');

    await act(async () => koniec({ id: 'p1', rewersId: 'r1' }));
    await waitFor(() => expect(window.location.hash).toBe('#/projekt/p1/rewers/r1'));
  });

  it('błąd tworzenia rewersu: komunikat, odblokowanie i przywrócenie fokusu na przycisk', async () => {
    nowyProjektZRewersem.mockRejectedValueOnce(new Error('brak miejsca'));
    render(<WybierzStroneSzablonu />);
    const btn = screen.getByRole('button', { name: /^Rewers/ });
    fireEvent.click(btn);
    expect((await screen.findByRole('alert')).textContent).toContain('brak miejsca');
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(btn));
  });

  it('odmontowanie w trakcie tworzenia nie zmienia adresu hash', async () => {
    let koniec!: (v: { id: string; rewersId: string }) => void;
    nowyProjektZRewersem.mockReturnValue(new Promise((r) => (koniec = r)));
    const { unmount } = render(<WybierzStroneSzablonu />);
    fireEvent.click(screen.getByRole('button', { name: /^Rewers/ }));
    unmount();
    await act(async () => koniec({ id: 'p2', rewersId: 'r2' }));
    expect(window.location.hash).toBe('');
  });
});
