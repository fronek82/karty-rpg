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

describe('NarzedziaPaska', () => {
  it('kolejność w DOM (= kolejność Tab): Instrukcja, PL, EN, motyw jasny, motyw ciemny', () => {
    render(<NarzedziaPaska />);
    const nazwy = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')]
      .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map((e) => e.getAttribute('aria-label') ?? e.textContent);
    expect(nazwy).toEqual(['Instrukcja (nowe okno)', 'PL', 'EN', 'Motyw jasny', 'Motyw ciemny']);
  });

  it('Instrukcja otwiera się w nowym oknie bez dostępu do opener', () => {
    render(<NarzedziaPaska />);
    const a = screen.getByRole('link', { name: /Instrukcja/ });
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('język: oba przyciski aktywne, PL wciśnięty, atrybut lang na przyciskach', () => {
    render(<NarzedziaPaska />);
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
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(jezyk()).toBe('en');
    expect(localStorage.getItem('karty.jezyk')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'PL' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('link', { name: /Guide/ }).getAttribute('href')).toBe('instrukcja/');
    expect(screen.getByRole('button', { name: 'Light theme' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'PL' }));
    expect(document.documentElement.lang).toBe('pl');
    expect(localStorage.getItem('karty.jezyk')).toBe('pl');
    expect(screen.getByRole('link', { name: /Instrukcja/ })).toBeTruthy();
  });

  it('zmiana wyboru w innej karcie (zdarzenie storage) przełącza język', () => {
    render(<NarzedziaPaska />);
    localStorage.setItem('karty.jezyk', 'en');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'karty.jezyk', newValue: 'en' }));
    });
    expect(jezyk()).toBe('en');
    expect(screen.getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('motyw: aria-pressed podąża za wyborem i zapisuje go', () => {
    render(<NarzedziaPaska />);
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
});

describe('NaglowekAplikacji', () => {
  it('nazwa aplikacji po lewej, narzędzia na końcu', () => {
    const { container } = render(<NaglowekAplikacji />);
    const dzieci = [...container.querySelector('header')!.children];
    expect(dzieci[0]!.textContent).toBe('Karty RPG');
    expect(dzieci.at(-1)!.className).toContain('narzedzia-paska');
  });
});
