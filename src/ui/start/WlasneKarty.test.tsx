// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KAFELKI_SZABLONOW, PRZYKLADY } from '../../przyklady';

const nowyProjektZPrzykladu = vi.fn();
vi.mock('../baza', () => ({
  nowyProjektZPrzykladu: (...a: unknown[]) => nowyProjektZPrzykladu(...a),
  nowyProjektZSzablonu: vi.fn(),
}));
vi.mock('./ladujPrzyklady', () => ({
  useUruchomPodgladyPrzykladow: () => {},
  useWynikPrzykladu: () => undefined,
  useBladPodgladowPrzykladow: () => undefined,
  ponowPodgladyPrzykladow: () => Promise.resolve(),
}));

import { WlasneKarty } from './WlasneKarty';

beforeEach(() => {
  nowyProjektZPrzykladu.mockReset();
  window.location.hash = '';
});
afterEach(cleanup);

describe('WlasneKarty', () => {
  it('kafelki: pusta karta i wszystkie przykłady, menu z dwiema pozycjami', () => {
    render(<WlasneKarty />);
    expect(document.querySelectorAll('[data-podglad]')).toHaveLength(1 + PRZYKLADY.length);
    expect(KAFELKI_SZABLONOW).toHaveLength(1 + PRZYKLADY.length);
    expect(screen.getByRole('link', { name: /Nowy szablon od zera/ }).getAttribute('href')).toBe(
      '#/wlasne/nowy',
    );
    expect(screen.getByRole('button', { name: /Importuj szablon/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pusta karta' })).toBeTruthy();
  });

  it('klik tworzy projekt z przykładu i otwiera edytor; podwójny klik – jeden projekt', async () => {
    let koniec!: (id: string) => void;
    nowyProjektZPrzykladu.mockReturnValue(new Promise<string>((r) => (koniec = r)));
    render(<WlasneKarty />);
    const kafelek = screen.getByRole('button', { name: 'Karta z opisem' });
    fireEvent.click(kafelek);
    fireEvent.click(kafelek);
    await waitFor(() => expect(nowyProjektZPrzykladu).toHaveBeenCalledTimes(1));
    await act(async () => koniec('p1'));
    await waitFor(() => expect(window.location.hash).toBe('#/projekt/p1'));
  });

  it('błąd tworzenia: komunikat, kafelki znów działają', async () => {
    nowyProjektZPrzykladu.mockRejectedValueOnce(new Error('brak miejsca'));
    render(<WlasneKarty />);
    const kafelek = screen.getByRole('button', { name: 'Blok statystyk' });
    fireEvent.click(kafelek);
    expect((await screen.findByRole('alert')).textContent).toContain('brak miejsca');
    await waitFor(() => expect((kafelek as HTMLButtonElement).disabled).toBe(false));
  });
});
