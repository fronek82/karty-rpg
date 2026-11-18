import type { Locator } from '@playwright/test';

/**
 * Pomiar kontrastu WCAG elementów strony przez getComputedStyle (bez axe i innych zależności).
 *
 * Kolor tekstu i tło są „efektywne”: kolor z kanałem alfa (np. z color-mix) i przezroczystość
 * elementu oraz jego przodków (opacity) są składane z tłem, tak jak maluje je przeglądarka.
 * Tło to złożenie tła elementu i kolejnych przodków aż do pierwszego nieprzezroczystego.
 */

export type Pomiar = {
  /** Efektywny kolor tekstu (rgb). */
  tekst: string;
  /** Efektywne tło (rgb). */
  tlo: string;
  /** Kontrast tekstu z tłem. */
  kontrast: number;
};

/** Kontrast WCAG dwóch kolorów „rgb(r, g, b)” (bez alfa). */
export function kontrastRgb(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/-?\d+(\.\d+)?/g) ?? []).slice(0, 3).map((x) => {
      const v = Number(x) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

/** Funkcje wykonywane w przeglądarce (muszą być samowystarczalne). */
type Kolor = { r: number; g: number; b: number; a: number };

function wPrzegladarce(el: Element, wlasciwosc: 'color' | 'outline-color' | 'border-color') {
  const parsuj = (c: string): Kolor => {
    const liczby = (c.match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (c.startsWith('color(')) {
      // color(srgb r g b / a) – składowe 0…1 (wynik color-mix).
      const [r = 0, g = 0, b = 0, a = 1] = liczby;
      return { r: r * 255, g: g * 255, b: b * 255, a };
    }
    const [r = 0, g = 0, b = 0, a = 1] = liczby;
    return { r, g, b, a };
  };
  const naBialo = (k: Kolor, tlo: Kolor): Kolor => ({
    r: k.r * k.a + tlo.r * (1 - k.a),
    g: k.g * k.a + tlo.g * (1 - k.a),
    b: k.b * k.a + tlo.b * (1 - k.a),
    a: 1,
  });
  // Tło: od elementu w górę do pierwszego nieprzezroczystego; reszta to biel strony. Obrys
  // (border, outline) leży na tle rodzica, więc dla niego zaczynamy od rodzica.
  const warstwy: Kolor[] = [];
  const start = wlasciwosc === 'color' ? el : (el.parentElement ?? el);
  for (let e: Element | null = start; e; e = e.parentElement) {
    const t = parsuj(getComputedStyle(e).backgroundColor);
    if (t.a > 0) warstwy.push(t);
    if (t.a >= 1) break;
  }
  let tlo: Kolor = { r: 255, g: 255, b: 255, a: 1 };
  for (const w of warstwy.reverse()) tlo = naBialo(w, tlo);
  // Przezroczystość elementu i przodków mnoży kanał alfa tekstu.
  let krycie = 1;
  for (let e: Element | null = el; e; e = e.parentElement)
    krycie *= Number(getComputedStyle(e).opacity);
  const k = parsuj(getComputedStyle(el).getPropertyValue(wlasciwosc));
  const tekst = naBialo({ ...k, a: k.a * krycie }, tlo);
  const rgb = (c: Kolor) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  return { tekst: rgb(tekst), tlo: rgb(tlo) };
}

/** Kontrast tekstu elementu (kolor `color`) z jego efektywnym tłem. */
export async function kontrastTekstu(el: Locator): Promise<Pomiar> {
  const w = await el.evaluate(wPrzegladarce, 'color' as const);
  return { ...w, kontrast: kontrastRgb(w.tekst, w.tlo) };
}

/** Kontrast obrysu (`border-color`) elementu z tłem – np. pole formularza na panelu. */
export async function kontrastObrysu(el: Locator): Promise<Pomiar> {
  const w = await el.evaluate(wPrzegladarce, 'border-color' as const);
  return { ...w, kontrast: kontrastRgb(w.tekst, w.tlo) };
}

/** Kontrast obrysu fokusu (`outline-color`) z tłem oraz jego styl i grubość. */
export async function pomiarFokusu(
  el: Locator,
): Promise<Pomiar & { styl: string; szerokosc: number }> {
  const w = await el.evaluate((e) => {
    const cs = getComputedStyle(e);
    return { styl: cs.outlineStyle, szerokosc: parseFloat(cs.outlineWidth) };
  });
  const k = await el.evaluate(wPrzegladarce, 'outline-color' as const);
  return { ...k, ...w, kontrast: kontrastRgb(k.tekst, k.tlo) };
}
