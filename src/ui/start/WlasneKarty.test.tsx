// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KAFELKI_SZABLONOW, PRZYKLADY } from '../../przyklady';

const zapiszProjektZPrzykladu = vi.fn();
const nowyProjektZAwersuZProjektu = vi.fn();
const pozycje = vi.fn();
vi.mock('../bazaUI', () => ({
  zapiszProjektZPrzykladu: (...a: unknown[]) => zapiszProjektZPrzykladu(...a),
  nowyProjektZSzablonu: vi.fn(),
  nowyProjektZAwersuZProjektu: (...a: unknown[]) => nowyProjektZAwersuZProjektu(...a),
  nowyProjektZRewersuZProjektu: vi.fn(),
  baza: () => ({ miniatury: async () => new Map([['szablon:p:s0', '<svg/>']]) }),
}));
vi.mock('../useProjekt', () => ({ poOstatnimZapisie: () => Promise.resolve() }));
vi.mock('./mojeSzablony', async (oryginal) => ({
  ...(await oryginal<typeof import('./mojeSzablony')>()),
  wczytajPozycjeSzablonow: () => pozycje(),
  dorysujMiniatury: async () => new Map(),
}));
vi.mock('./ladujPrzyklady', () => ({
  useUruchomPodgladyPrzykladow: () => {},
  useWynikPrzykladu: () => undefined,
  useBladPodgladowPrzykladow: () => undefined,
  ponowPodgladyPrzykladow: () => Promise.resolve(),
}));
vi.mock('./GaleriaOnline', () => ({
  GaleriaOnline: () => null,
}));

import { WlasneKarty } from './WlasneKarty';

const awers = (i: number) => ({
  klucz: `szablon:p:s${i}`,
  rodzaj: 'awers' as const,
  nazwa: `Mój ${i}`,
  zmieniono: `2026-11-${String(20 - i).padStart(2, '0')}`,
  href: '',
  awers: {
    projektId: 'p',
    projektNazwa: 'P',
    szablonId: `s${i}`,
    szablonNazwa: `Mój ${i}`,
    kluczTresci: `k${i}`,
  },
  szablonPodglad: { projektId: 'p', szablonId: `s${i}` },
});

beforeEach(() => {
  zapiszProjektZPrzykladu.mockReset();
  nowyProjektZAwersuZProjektu.mockReset();
  pozycje.mockReset();
  pozycje.mockResolvedValue([]);
  window.location.hash = '';
});
afterEach(cleanup);

describe('WlasneKarty', () => {
  it('kafelki: pusta karta i wszystkie przykłady; bez „Nowy szablon od zera” i biblioteki globalnej', async () => {
    render(<WlasneKarty />);
    expect(document.querySelectorAll('[data-podglad]')).toHaveLength(1 + PRZYKLADY.length);
    expect(KAFELKI_SZABLONOW).toHaveLength(1 + PRZYKLADY.length);
    expect(screen.queryByRole('link', { name: /Nowy szablon od zera/ })).toBeNull();
    expect(screen.queryByText(/Globalna biblioteka/)).toBeNull();
    expect(screen.getByRole('button', { name: /Importuj szablon/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pusta karta' })).toBeTruthy();
    expect(await screen.findByText(/Nie masz jeszcze własnych szablonów/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pokaż wszystkie' })).toBeNull();
  });

  it('„Moje szablony” są przed przykładami: najwyżej 8 ostatnich, „Pokaż wszystkie”, klik tworzy projekt', async () => {
    pozycje.mockResolvedValue(Array.from({ length: 10 }, (_, i) => awers(i)));
    nowyProjektZAwersuZProjektu.mockResolvedValue('nowy');
    render(<WlasneKarty />);
    const moje = await screen.findByRole('region', { name: /Moje szablony/ });
    await waitFor(() => expect(moje.querySelectorAll('[data-moj-szablon]')).toHaveLength(8));
    const przyklady = screen.getByRole('region', { name: /Przykładowe szablony/ });
    expect(moje.compareDocumentPosition(przyklady) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(moje.querySelector('img.miniatura-wlasna')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Mój 3/ }));
    await waitFor(() => expect(nowyProjektZAwersuZProjektu).toHaveBeenCalledWith('p', 's3'));
    await waitFor(() => expect(window.location.hash).toBe('#/projekt/nowy'));

    sessionStorage.clear();
    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystkie' }));
    expect(sessionStorage.getItem('karty.zakladkaStart')).toBe('szablony');
    expect(window.location.hash).toBe('#/');
  });

  it('klik tworzy projekt z przykładu i otwiera edytor; podwójny klik – jeden projekt', async () => {
    let koniec!: (id: string) => void;
    zapiszProjektZPrzykladu.mockReturnValue(new Promise<string>((r) => (koniec = r)));
    render(<WlasneKarty />);
    const kafelek = screen.getByRole('button', { name: 'Karta z opisem' });
    fireEvent.click(kafelek);
    fireEvent.click(kafelek);
    await waitFor(() => expect(zapiszProjektZPrzykladu).toHaveBeenCalledTimes(1));
    await act(async () => koniec('p1'));
    await waitFor(() => expect(window.location.hash).toBe('#/projekt/p1'));
  });

  it('błąd tworzenia: komunikat, kafelki znów działają', async () => {
    zapiszProjektZPrzykladu.mockRejectedValueOnce(new Error('brak miejsca'));
    render(<WlasneKarty />);
    const kafelek = screen.getByRole('button', { name: 'Blok statystyk' });
    fireEvent.click(kafelek);
    expect((await screen.findByRole('alert')).textContent).toContain('brak miejsca');
    await waitFor(() => expect((kafelek as HTMLButtonElement).disabled).toBe(false));
    // Po błędzie fokus wraca na kafelek (na czas tworzenia był wyłączony).
    await waitFor(() => expect(document.activeElement).toBe(kafelek));
  });

  it('odmontowanie w trakcie tworzenia: bez nawigacji po zakończeniu', async () => {
    let koniec!: (id: string) => void;
    zapiszProjektZPrzykladu.mockReturnValue(new Promise<string>((r) => (koniec = r)));
    const { unmount } = render(<WlasneKarty />);
    fireEvent.click(screen.getByRole('button', { name: 'Karta ozdobna' }));
    await waitFor(() => expect(zapiszProjektZPrzykladu).toHaveBeenCalledTimes(1));
    unmount();
    await act(async () => koniec('p3'));
    expect(window.location.hash).toBe('');
  });

  it('kafelek ma opis z rozmiarem, a wspólna podpowiedź jest raz w opisie grupy', () => {
    render(<WlasneKarty />);
    const kafelek = screen.getByRole('button', { name: 'Blok statystyk' });
    expect(kafelek.getAttribute('aria-describedby')).toBe('szablon-statystyki-rozmiar');
    expect(document.getElementById('szablon-statystyki-rozmiar')!.textContent).toBe('88×63 mm');
    const grupa = screen.getByRole('region', { name: /Przykładowe szablony/ });
    expect(grupa.getAttribute('aria-describedby')).toBe('wlasne-podpowiedz');
    expect(document.getElementById('wlasne-podpowiedz')!.textContent).toBe(
      'Kliknij, aby zacząć od tego szablonu',
    );
  });

  it('plik projektu w „Importuj szablon”: podpowiedź zamiast importu', async () => {
    const { strToU8, zipSync } = await import('fflate');
    const bajty = zipSync({ 'projekt.json': strToU8('{}') });
    render(<WlasneKarty />);
    const pole = screen.getByTestId('plik-szablonu-start') as HTMLInputElement;
    const plik = new File([bajty as BlobPart], 'moj.kartyrpg');
    Object.defineProperty(plik, 'arrayBuffer', { value: async () => bajty.buffer });
    fireEvent.change(pole, { target: { files: [plik] } });
    expect((await screen.findByRole('alert')).textContent).toBe(
      'To jest plik projektu. Użyj „Importuj pliki…” na ekranie startowym.',
    );
  });
});
