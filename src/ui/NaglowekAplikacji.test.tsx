// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jezyk, ustawJezyk } from '../i18n';
import { NaglowekAplikacji, NarzedziaPaska } from './NaglowekAplikacji';

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  ustawJezyk('pl');
});

const otworzMenu = (nazwa = /Ustawienia/) => {
  const przycisk = screen.getByRole('button', { name: nazwa });
  fireEvent.click(przycisk);
  return przycisk;
};

describe('NarzedziaPaska', () => {
  it('pokazuje link Biblioteki i przycisk Ustawienia, a po rozwinięciu tylko konfigurację i instrukcję', () => {
    render(<NarzedziaPaska />);
    expect(screen.getByRole('link', { name: 'Biblioteki' }).getAttribute('href')).toBe(
      '#/biblioteki',
    );
    const przycisk = screen.getByRole('button', { name: /Ustawienia/ });
    expect(przycisk.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: /Instrukcja/ })).toBeNull();

    fireEvent.click(przycisk);
    expect(przycisk.getAttribute('aria-expanded')).toBe('true');

    expect(screen.getByRole('button', { name: 'Motyw jasny' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Motyw ciemny' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'PL' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'EN' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kolory przycisków' })).toBeTruthy();
    // N7: biblioteki (czcionki, obrazy) nie są już w Ustawieniach.
    expect(screen.queryByRole('button', { name: /Wgrywanie/ })).toBeNull();
    const link = screen.getByRole('link', { name: /Instrukcja/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('Escape zamyka menu i zwraca fokus na przycisk Ustawienia', () => {
    render(<NarzedziaPaska />);
    const przycisk = otworzMenu();
    expect(przycisk.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(przycisk.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(przycisk);
  });

  it('język: oba przyciski aktywne, PL wciśnięty, atrybut lang na przyciskach', () => {
    render(<NarzedziaPaska />);
    otworzMenu();
    const pl = screen.getByRole('button', { name: 'PL' }) as HTMLButtonElement;
    const en = screen.getByRole('button', { name: 'EN' }) as HTMLButtonElement;
    expect(pl.getAttribute('aria-pressed')).toBe('true');
    expect(en.getAttribute('aria-pressed')).toBe('false');
    expect(pl.disabled).toBe(false);
    expect(en.disabled).toBe(false);
    expect(pl.getAttribute('lang')).toBe('pl');
    expect(en.getAttribute('lang')).toBe('en');
  });

  it('przełączenie na EN: napisy, aria-pressed, lang dokumentu i pamięć wyboru', () => {
    render(<NarzedziaPaska />);
    otworzMenu();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(jezyk()).toBe('en');
    expect(localStorage.getItem('karty.jezyk')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'PL' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('link', { name: /Guide/ }).getAttribute('href')).toBe(
      'instrukcja/?lang=en',
    );
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Libraries' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PL' }));
    expect(document.documentElement.lang).toBe('pl');
    expect(localStorage.getItem('karty.jezyk')).toBe('pl');
    expect(screen.getByRole('link', { name: /Instrukcja/ }).getAttribute('href')).toBe(
      'instrukcja/?lang=pl',
    );
  });

  it('zmiana wyboru w innej karcie (zdarzenie storage) przełącza język', () => {
    render(<NarzedziaPaska />);
    otworzMenu();
    localStorage.setItem('karty.jezyk', 'en');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'karty.jezyk', newValue: 'en' }));
    });
    expect(jezyk()).toBe('en');
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('motyw: aria-pressed podąża za wyborem i zapisuje go', () => {
    render(<NarzedziaPaska />);
    otworzMenu();
    const jasny = screen.getByRole('button', { name: 'Motyw jasny' });
    const ciemny = screen.getByRole('button', { name: 'Motyw ciemny' });
    expect(jasny.getAttribute('aria-pressed')).toBe('true');
    expect(ciemny.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(ciemny);
    expect(jasny.getAttribute('aria-pressed')).toBe('false');
    expect(ciemny.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('karty.motyw')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(jasny);
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('link Biblioteki przechodzi przez straż wyjścia edytora', () => {
    const adresy: string[] = [];
    render(
      <NarzedziaPaska sprawdzWyjscie={(e, adres) => (e.preventDefault(), adresy.push(adres))} />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Biblioteki' }));
    expect(adresy).toEqual(['#/biblioteki']);
  });

  it('okno kolorów przycisków z menu Ustawienia w portalu z pułapką fokusu', async () => {
    const { container } = render(<NaglowekAplikacji />);
    otworzMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Kolory przycisków' }));
    const dialogKolorow = await screen.findByRole(
      'dialog',
      { name: 'Kolory przycisków' },
      { timeout: 5000 },
    );
    // Dialog renderowany przez portal w document.body (poza <header>).
    expect(container.querySelector('header')!.contains(dialogKolorow)).toBe(false);
    const zamknij = screen.getByRole('button', { name: 'Zamknij okno' });
    expect(document.activeElement).toBe(zamknij);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(dialogKolorow.contains(document.activeElement)).toBe(true);
    expect(dialogKolorow).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mausritter: Żywy cyjan (#1eabb8)' }));
    expect(document.documentElement.style.getPropertyValue('--krok-gra-1')).toBe('#1eabb8');
    fireEvent.click(screen.getByRole('button', { name: 'Przywróć domyślne' }));
    expect(document.documentElement.style.getPropertyValue('--krok-gra-1')).toBe('');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('NaglowekAplikacji', () => {
  it('nazwa aplikacji po lewej, narzędzia na końcu', () => {
    const { container } = render(<NaglowekAplikacji />);
    const dzieci = [...container.querySelector('header')!.children];
    expect(dzieci[0]!.textContent).toBe('Karty');
    expect(dzieci.at(-1)!.className).toContain('narzedzia-paska');
  });
});
