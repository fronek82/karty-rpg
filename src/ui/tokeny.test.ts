import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokeny.css', import.meta.url), 'utf8');

/** Zmienne CSS z bloku o podanym selektorze (z rozwiązaniem odwołań var(--x)). */
function tokeny(selektor: RegExp): Record<string, string> {
  const blok = new RegExp(`${selektor.source}\\s*\\{([^}]*)\\}`).exec(css);
  if (!blok) throw new Error(`Brak bloku ${selektor.source} w tokeny.css`);
  const wynik: Record<string, string> = {};
  for (const m of blok[1]!.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) wynik[m[1]!] = m[2]!.trim();
  for (const [k, v] of Object.entries(wynik)) {
    const ref = /^var\(--([\w-]+)\)$/.exec(v);
    if (ref) wynik[k] = wynik[ref[1]!]!;
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

/** Barwa (0–360) i nasycenie (0–1) koloru #rrggbb. */
function barwa(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const l = (max + min) / 2;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(2 * l - 1)) };
}

function kontrast(a: string, b: string): number {
  const [x, y] = [luminancja(a), luminancja(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

describe('tokeny motywów', () => {
  it('oba motywy definiują te same tokeny', () => {
    expect(Object.keys(ciemny).sort()).toEqual(Object.keys(jasny).sort());
  });

  it('wartości kolorów to #rrggbb (poza cieniami)', () => {
    for (const motyw of [jasny, ciemny])
      for (const [k, v] of Object.entries(motyw))
        if (!k.startsWith('cien') && k !== 'color-scheme') expect(v, k).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('jasny: tekst na tle i na panelu – AAA', () => {
    expect(kontrast(jasny.tekst!, jasny.tlo!)).toBeGreaterThanOrEqual(7);
    expect(kontrast(jasny.tekst!, jasny['tlo-panelu']!)).toBeGreaterThanOrEqual(7);
  });

  it('jasny: link w tekście ciągłym (#1F6C92) – AA na tle i panelu', () => {
    expect(jasny.link!.toLowerCase()).toBe('#1f6c92');
    expect(kontrast(jasny.link!, jasny.tlo!)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(jasny.link!, jasny['tlo-panelu']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('jasny: link dla większych elementów (#2A7FA8) – co najmniej 3:1', () => {
    expect(jasny['link-duzy']!.toLowerCase()).toBe('#2a7fa8');
    expect(kontrast(jasny['link-duzy']!, jasny.tlo!)).toBeGreaterThanOrEqual(3);
  });

  it('jasny: biały na akcencie i na pasku – granica AA (4,5)', () => {
    expect(kontrast('#ffffff', jasny.akcent!)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(jasny['pasek-tekst']!, jasny.pasek!)).toBeGreaterThanOrEqual(4.5);
  });

  it('jasny: wyróżnienie (bordo) na tle – AAA', () => {
    expect(kontrast(jasny.wyroznienie!, jasny.tlo!)).toBeGreaterThanOrEqual(7);
  });

  it('ciemny: tekst, przygaszony tekst i link na tle – AA lub więcej', () => {
    expect(kontrast(ciemny.tekst!, ciemny.tlo!)).toBeGreaterThanOrEqual(7);
    expect(kontrast(ciemny['tekst-przygaszony']!, ciemny.tlo!)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(ciemny.link!, ciemny.tlo!)).toBeGreaterThanOrEqual(7);
    expect(kontrast(ciemny.link!, ciemny['tlo-panelu']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('ciemny: bez różu – bordo #8E2C48, wyróżnienie i tytuł złote #E9A645', () => {
    expect(ciemny.bordo!.toLowerCase()).toBe('#8e2c48');
    expect(ciemny.wyroznienie!.toLowerCase()).toBe('#e9a645');
    expect(ciemny.tytul!.toLowerCase()).toBe('#e9a645');
  });

  it('ciemny: złoty na ciemnym tle i panelu – AA', () => {
    expect(kontrast(ciemny.wyroznienie!, ciemny.tlo!)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(ciemny.wyroznienie!, ciemny['tlo-panelu']!)).toBeGreaterThanOrEqual(4.5);
  });

  it('ciemny: beż na bordo – AA dla dużego tekstu (3:1) i zbliżony do AA', () => {
    expect(kontrast(ciemny['bordo-tekst']!, ciemny.bordo!)).toBeGreaterThanOrEqual(3);
  });

  it('ciemny: biały na akcencie (przycisk główny) – AA', () => {
    expect(kontrast(ciemny['akcent-tekst']!, ciemny.akcent!)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(ciemny['pasek-tekst']!, ciemny.pasek!)).toBeGreaterThanOrEqual(4.5);
  });

  it('oba motywy: zaznaczenie i ostrzeżenie czytelne jako elementy graficzne (3:1) na panelu', () => {
    for (const m of [jasny, ciemny]) {
      expect(kontrast(m.zaznaczenie!, m['tlo-panelu']!)).toBeGreaterThanOrEqual(3);
      expect(kontrast(m.zle!, m['tlo-panelu']!)).toBeGreaterThanOrEqual(3);
      expect(kontrast(m.dobrze!, m['tlo-panelu']!)).toBeGreaterThanOrEqual(3);
    }
  });

  it('jasny: czerwień ostrzeżeń i przygaszony tekst – AA na tle i panelu', () => {
    for (const tlo of [jasny.tlo!, jasny['tlo-panelu']!]) {
      expect(kontrast(jasny.zle!, tlo)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(jasny['tekst-przygaszony']!, tlo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('oba motywy: tekst zaznaczonego przycisku segmentowego (akcent) – AA', () => {
    for (const m of [jasny, ciemny])
      expect(kontrast(m['akcent-tekst']!, m.akcent!)).toBeGreaterThanOrEqual(4.5);
  });

  it('ciemny: czerwień ostrzeżeń czytelna na tle i panelu – AA', () => {
    for (const tlo of [ciemny.tlo!, ciemny['tlo-panelu']!])
      expect(kontrast(ciemny.zle!, tlo)).toBeGreaterThanOrEqual(4.5);
  });

  it('ciemny: żaden token nie ma odcienia różu (barwa 300–345°), poza jawnymi wyjątkami', () => {
    // Wyjątki: bordo to wymagany kolor ozdób (#8E2C48); prowadnica leży wyłącznie na białym
    // papierze karty (świadomy wyjątek, B120).
    const wyjatki = new Set(['bordo', 'prowadnica']);
    // Kontrola detektora: wyjątki faktycznie są różowawe.
    expect(barwa(ciemny.prowadnica!).h).toBeGreaterThan(300);
    const roz = Object.entries(ciemny)
      .filter(([k, v]) => /^#[0-9a-f]{6}$/i.test(v) && !wyjatki.has(k))
      .filter(([, v]) => {
        const { h, s } = barwa(v);
        return s > 0.2 && h >= 300 && h <= 345;
      })
      .map(([k]) => k);
    expect(roz).toEqual([]);
  });
  it('start: menu (bordo, granat), tytuł i przygaszony napis – kontrast w obu motywach', () => {
    for (const m of [jasny, ciemny]) {
      // Napis na kolorowych paskach menu startowego (bordo i --kolor-4, biały lub beż).
      expect(kontrast(m['bordo-tekst']!, m.bordo!)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(m['akcent-tekst']!, m['kolor-4']!)).toBeGreaterThanOrEqual(4.5);
      // Tytuł (duża czcionka, 3:1) na tle strony.
      expect(kontrast(m.tytul!, m.tlo!)).toBeGreaterThanOrEqual(4.5);
      // Obrys strefy upuszczania i opis importu.
      expect(kontrast(m['tekst-przygaszony']!, m.tlo!)).toBeGreaterThanOrEqual(4.5);
      expect(kontrast(m['obramowanie-karty']!, m['tlo-panelu']!)).toBeGreaterThanOrEqual(1.5);
    }
  });
});
