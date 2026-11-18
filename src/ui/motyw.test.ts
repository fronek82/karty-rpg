// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Modul = typeof import('./motyw');

let zmianaSystemu: (() => void) | undefined;
let systemCiemny = false;

function zrobMatchMedia() {
  window.matchMedia = ((q: string) => ({
    matches: systemCiemny,
    media: q,
    addEventListener: (_: string, cb: () => void) => {
      zmianaSystemu = cb;
    },
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

async function wczytaj(): Promise<Modul> {
  vi.resetModules();
  return import('./motyw');
}

const theme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  systemCiemny = false;
  zmianaSystemu = undefined;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  zrobMatchMedia();
});

afterEach(() => vi.restoreAllMocks());

describe('czyPreferencja i motywDla', () => {
  it('rozpoznaje tylko trzy wartości', async () => {
    const m = await wczytaj();
    for (const v of ['light', 'dark', 'system']) expect(m.czyPreferencja(v)).toBe(true);
    for (const v of ['', 'Dark', null, undefined, 1]) expect(m.czyPreferencja(v)).toBe(false);
  });

  it('wybór jawny wygrywa z systemem, „system” idzie za systemem', async () => {
    const m = await wczytaj();
    expect(m.motywDla('light', true)).toBe('light');
    expect(m.motywDla('dark', false)).toBe('dark');
    expect(m.motywDla('system', true)).toBe('dark');
    expect(m.motywDla('system', false)).toBe('light');
  });
});

describe('stosowanie motywu', () => {
  it('przy imporcie ustawia data-theme według systemu', async () => {
    systemCiemny = true;
    await wczytaj();
    expect(theme()).toBe('dark');
  });

  it('przy imporcie używa zapamiętanego wyboru', async () => {
    localStorage.setItem('karty.motyw', 'light');
    systemCiemny = true;
    await wczytaj();
    expect(theme()).toBe('light');
  });

  it('błędna wartość w localStorage = „system”', async () => {
    localStorage.setItem('karty.motyw', 'różowy');
    const m = await wczytaj();
    expect(m.odczytajPreferencje()).toBe('system');
  });

  it('ustawPreferencje zapisuje i stosuje', async () => {
    const m = await wczytaj();
    m.ustawPreferencje('dark');
    expect(localStorage.getItem('karty.motyw')).toBe('dark');
    expect(theme()).toBe('dark');
  });

  it('wyjątek przy odczycie localStorage: motyw według systemu', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('zablokowane');
    });
    systemCiemny = true;
    const m = await wczytaj();
    expect(m.odczytajPreferencje()).toBe('system');
    expect(theme()).toBe('dark');
  });

  it('wyjątek przy zapisie: wybór pamiętany do końca sesji strony', async () => {
    const m = await wczytaj();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('pełne');
    });
    m.ustawPreferencje('dark');
    expect(m.odczytajPreferencje()).toBe('dark');
    expect(theme()).toBe('dark');
    m.ustawPreferencje('light');
    expect(theme()).toBe('light');
  });

  it('zdarzenie change z matchMedia przełącza motyw w trybie „system”', async () => {
    await wczytaj();
    expect(theme()).toBe('light');
    systemCiemny = true;
    zmianaSystemu?.();
    expect(theme()).toBe('dark');
  });

  it('jawny wybór nie reaguje na zmianę systemu', async () => {
    const m = await wczytaj();
    m.ustawPreferencje('light');
    systemCiemny = true;
    zmianaSystemu?.();
    expect(theme()).toBe('light');
  });

  it('zdarzenie storage z innej karty zmienia motyw', async () => {
    await wczytaj();
    localStorage.setItem('karty.motyw', 'dark');
    window.dispatchEvent(new StorageEvent('storage', { key: 'karty.motyw' }));
    expect(theme()).toBe('dark');
    // Inny klucz jest ignorowany.
    localStorage.setItem('karty.motyw', 'light');
    window.dispatchEvent(new StorageEvent('storage', { key: 'inny' }));
    expect(theme()).toBe('dark');
  });
});
