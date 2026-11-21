// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pakietMausritter } from '../../pakiety/mausritter';

const nowyProjektZPakietu = vi.fn();
vi.mock('../baza', () => ({ nowyProjektZPakietu: (...a: unknown[]) => nowyProjektZPakietu(...a) }));
vi.mock('./ladujPodglady', () => ({
  useUruchomPodglady: () => {},
  useWynikPodgladu: () => undefined,
  useBladLadowania: () => undefined,
  ponowPodglady: () => Promise.resolve(),
}));
vi.mock('../../pakiety/gry', () => ({
  gry: [
    {
      id: 'mausritter',
      nazwa: 'Mausritter',
      nazwaDo: 'Mausrittera',
      opis: '',
      pakiet: () => Promise.resolve(pakietMausritter),
    },
  ],
}));

import { WyborGry } from './WyborGry';

beforeEach(() => {
  nowyProjektZPakietu.mockReset();
  window.location.hash = '';
});
afterEach(cleanup);

describe('WyborGry', () => {
  it('błąd tworzenia projektu: komunikat, a kafelki znów działają', async () => {
    nowyProjektZPakietu.mockRejectedValueOnce(new Error('brak miejsca'));
    render(<WyborGry id="mausritter" />);
    fireEvent.click(screen.getByRole('button', { name: 'Zacznij od gotowego układu' }));
    const kafelek = await screen.findByRole('button', { name: 'Stany' });
    await waitFor(() => expect((kafelek as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(kafelek);
    expect((await screen.findByRole('alert')).textContent).toContain('brak miejsca');
    await waitFor(() => expect((kafelek as HTMLButtonElement).disabled).toBe(false));
    nowyProjektZPakietu.mockResolvedValueOnce('p1');
    fireEvent.click(kafelek);
    await waitFor(() => expect(window.location.hash).toBe('#/projekt/p1'));
    expect(nowyProjektZPakietu).toHaveBeenCalledTimes(2);
  });

  it('podwójne kliknięcie tworzy jeden projekt', async () => {
    let koniec!: (id: string) => void;
    nowyProjektZPakietu.mockReturnValue(new Promise<string>((r) => (koniec = r)));
    render(<WyborGry id="mausritter" />);
    fireEvent.click(screen.getByRole('button', { name: 'Zacznij od gotowego układu' }));
    const kafelek = await screen.findByRole('button', { name: 'Stany' });
    await waitFor(() => expect((kafelek as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(kafelek);
    fireEvent.click(kafelek);
    fireEvent.click(screen.getByRole('button', { name: 'Wyposażenie' }));
    expect(nowyProjektZPakietu).toHaveBeenCalledTimes(1);
    await act(async () => koniec('p2'));
  });

  it('przełączanie w menu filtruje środek (tylko pusta kartka albo tylko gotowe układy)', async () => {
    render(<WyborGry id="mausritter" />);
    const pusta = await screen.findByRole('button', { name: 'Pusta kartka' });
    const uklady = screen.getByRole('button', { name: 'Zacznij od gotowego układu' });
    expect(pusta.getAttribute('aria-current')).toBe('true');
    expect(uklady.getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: /Gotowe układy/ })).toBeNull();

    fireEvent.click(uklady);
    expect(uklady.getAttribute('aria-current')).toBe('true');
    expect(pusta.getAttribute('aria-current')).toBeNull();
    expect(uklady.getAttribute('aria-describedby')).toContain('skrot-uklady-stan');
    expect(screen.getByRole('heading', { level: 2, name: /Gotowe układy/ })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeNull();
  });
});
