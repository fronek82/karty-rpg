// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jezyk, KLUCZ_JEZYKA, odczytajJezyk, t, ustawJezyk } from './index';
import { useJezyk } from './react';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  ustawJezyk('pl');
});

function Licznik() {
  useJezyk();
  const [n, ustawN] = useState(0);
  return (
    <button type="button" onClick={() => ustawN(n + 1)}>
      {t('kartka.duplikuj')} {n}
    </button>
  );
}

describe('język w przeglądarce', () => {
  it('ustawJezyk zapisuje wybór, ustawia lang dokumentu i tytuł', () => {
    ustawJezyk('en');
    expect(localStorage.getItem(KLUCZ_JEZYKA)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Cards');
    expect(odczytajJezyk()).toBe('en');
    ustawJezyk('pl');
    expect(document.documentElement.lang).toBe('pl');
    expect(document.title).toBe('Karty');
  });

  it('bez zapisu – język z navigator.language (pl → PL, reszta EN)', () => {
    const orig = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language')!;
    try {
      Object.defineProperty(navigator, 'language', { value: 'pl-PL', configurable: true });
      localStorage.removeItem(KLUCZ_JEZYKA);
      // ustawJezyk w afterEach zostawia wpis – tu go nie ma, więc działa wartość domyślna.
      expect(odczytajJezyk()).toBe('pl');
      Object.defineProperty(navigator, 'language', { value: 'en-GB', configurable: true });
      expect(odczytajJezyk()).toBe('en');
      localStorage.setItem(KLUCZ_JEZYKA, 'pl');
      expect(odczytajJezyk()).toBe('pl');
      localStorage.setItem(KLUCZ_JEZYKA, 'xx');
      expect(odczytajJezyk()).toBe('en');
    } finally {
      delete (navigator as unknown as Record<string, unknown>).language;
      Object.defineProperty(Navigator.prototype, 'language', orig);
    }
  });

  it('zablokowany localStorage: wybór działa do końca sesji strony', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('zablokowane');
    };
    try {
      ustawJezyk('en');
      expect(jezyk()).toBe('en');
      expect(odczytajJezyk()).toBe('en');
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  it('zmiana języka przerysowuje komponent bez utraty jego stanu', () => {
    render(<Licznik />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('Duplikuj 2');
    act(() => ustawJezyk('en'));
    expect(screen.getByRole('button').textContent).toBe('Duplicate 2');
  });
});
