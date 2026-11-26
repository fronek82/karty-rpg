import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokeny.css', import.meta.url), 'utf8');

/** Zmienne CSS z bloku o podanym selektorze (z wielostopniowym rozwiązaniem odwołań var(--x)). */
function tokeny(selektor: RegExp): Record<string, string> {
  const blok = new RegExp(`${selektor.source}\\s*\\{([^}]*)\\}`).exec(css);
  if (!blok) throw new Error(`Brak bloku ${selektor.source} w tokeny.css`);
  const wynik: Record<string, string> = {};
  for (const m of blok[1]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) wynik[m[1]!] = m[2]!.trim();
  for (let runda = 0; runda < 4; runda++) {
    for (const [k, v] of Object.entries(wynik)) {
      const ref = /^var\(--([\w-]+)\)$/.exec(v);
      if (ref && wynik[ref[1]!]) wynik[k] = wynik[ref[1]!]!;
    }
  }
  return wynik;
}

const jasny = tokeny(/\[data-theme='light'\]/);
const ciemny = tokeny(/\[data-theme='dark'\]/);

function luminancja(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Oczekiwano #rrggbb, jest: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function kontrast(a: string, b: string): number {
  const [x, y] = [luminancja(a), luminancja(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

const TOKENY_NIEKOLOROWE = new Set(['color-scheme', 'riso-mieszanie']);

/** Wymagane tokeny UI2 „drukarnia riso” z sekcji 3.1 docs/plan-UI2.md. */
const PALETA_RISO_JASNY: Record<string, string> = {
  tlo: '#f3f0e8',
  'tlo-pasek': '#ede9e0',
  'tlo-robocze': '#dcd8ce',
  powierzchnia: '#ffffff',
  tekst: '#111111',
  'tekst-2': '#5a5852',
  'linia-2': '#c9c4b8',
  akcent: '#e8b4a8',
  'riso-roz': '#d98c8c',
  'riso-niebieski': '#5d7fa3',
  'riso-ochra': '#e3c77a',
  'riso-szalwia': '#9db59a',
  zaznaczenie: '#3f6a93',
  'linia-pomocnicza': '#1a9bb5',
};

const PALETA_RISO_CIEMNY: Record<string, string> = {
  tlo: '#17171a',
  'tlo-pasek': '#1e1e22',
  'tlo-robocze': '#2a2a2f',
  powierzchnia: '#202024',
  tekst: '#e9e4d8',
  'tekst-2': '#a9a498',
  'linia-2': '#3a3a40',
  akcent: '#b8675a',
  'riso-roz': '#b8675a',
  'riso-niebieski': '#3f6a93',
  'riso-ochra': '#b8973f',
  'riso-szalwia': '#5f8a5c',
  zaznaczenie: '#8fb0d1',
  'linia-pomocnicza': '#4fc3db',
};

describe('tokeny motywów UI2 (drukarnia riso)', () => {
  it('oba motywy definiują dokładnie ten sam zestaw tokenów', () => {
    expect(Object.keys(ciemny).sort()).toEqual(Object.keys(jasny).sort());
  });

  it('wartości tokenów kolorów to #rrggbb (poza cieniami i trybem mieszania)', () => {
    for (const motyw of [jasny, ciemny])
      for (const [k, v] of Object.entries(motyw))
        if (!k.startsWith('cien') && !TOKENY_NIEKOLOROWE.has(k))
          expect(v, k).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('motyw jasny ma komplet tokenów riso z planu UI2 (sekcja 3.1)', () => {
    for (const [klucz, oczekiwany] of Object.entries(PALETA_RISO_JASNY)) {
      expect(jasny[klucz]?.toLowerCase(), klucz).toBe(oczekiwany);
    }
    expect(jasny['riso-mieszanie']).toBe('multiply');
  });

  it('motyw ciemny ma komplet tokenów riso z planu UI2 (sekcja 3.1)', () => {
    for (const [klucz, oczekiwany] of Object.entries(PALETA_RISO_CIEMNY)) {
      expect(ciemny[klucz]?.toLowerCase(), klucz).toBe(oczekiwany);
    }
    expect(ciemny['riso-mieszanie']).toBe('screen');
  });

  it('czcionki interfejsu UI2 (Archivo Black, Archivo, IBM Plex Mono) są zadeklarowane lokalnie', () => {
    expect(css).toContain("font-family: 'Archivo Black'");
    expect(css).toContain("font-family: 'Archivo'");
    expect(css).toContain("font-family: 'IBM Plex Mono'");
    expect(css).not.toContain('fonts.googleapis.com');
  });

  it('oba motywy: główny tekst na wszystkich tłach roboczych – AAA (>= 7:1)', () => {
    for (const m of [jasny, ciemny]) {
      for (const tlo of [m.tlo!, m['tlo-pasek']!, m['tlo-robocze']!, m.powierzchnia!]) {
        expect(kontrast(m.tekst!, tlo)).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('oba motywy: tekst drugorzędny (--tekst-2) na tle, pasku i powierzchni – AA (>= 4,5:1)', () => {
    for (const m of [jasny, ciemny]) {
      for (const tlo of [m.tlo!, m['tlo-pasek']!, m.powierzchnia!]) {
        expect(kontrast(m['tekst-2']!, tlo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('oba motywy: główny przycisk (--przycisk-tekst na --przycisk) i link – AA lub AAA', () => {
    for (const m of [jasny, ciemny]) {
      expect(kontrast(m['przycisk-tekst']!, m.przycisk!)).toBeGreaterThanOrEqual(7);
      expect(kontrast(m.link!, m.tlo!)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(m.link!, m['tlo-pasek']!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('oba motywy: zaznaczenie, ostrzeżenie i „dobrze” czytelne jako elementy graficzne (>= 3:1)', () => {
    for (const m of [jasny, ciemny]) {
      expect(kontrast(m.zaznaczenie!, m.tlo!)).toBeGreaterThanOrEqual(3);
      expect(kontrast(m.zaznaczenie!, m.powierzchnia!)).toBeGreaterThanOrEqual(3);
      expect(kontrast(m.zle!, m.tlo!)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(m.dobrze!, m.tlo!)).toBeGreaterThanOrEqual(3);
    }
  });

  it('oba motywy: nakładki na białym papierze karty – co najmniej 3:1', () => {
    for (const m of [jasny, ciemny]) {
      expect(m.papier!.toLowerCase()).toBe('#ffffff');
      for (const k of [
        'zaznaczenie-papier',
        'zaznaczenie-karty',
        'dobrze-papier',
        'zle-papier',
        'prowadnica',
      ]) {
        expect(kontrast(m[k]!, m.papier!), k).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('oba motywy: dymek podpowiedzi (--tekst-podpowiedzi na --tlo-podpowiedzi) – AAA', () => {
    for (const m of [jasny, ciemny]) {
      expect(kontrast(m['tekst-podpowiedzi']!, m['tlo-podpowiedzi']!)).toBeGreaterThanOrEqual(7);
    }
  });
});
