// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
afterEach(cleanup);

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

  it('język: PL wciśnięty, EN wyłączony', () => {
    render(<NarzedziaPaska />);
    expect(screen.getByRole('button', { name: 'PL' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: 'EN' }) as HTMLButtonElement).disabled).toBe(true);
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
