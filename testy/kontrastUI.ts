import type { Locator, Page } from '@playwright/test';

/**
 * Pomiar kontrastu WCAG elementów strony przez getComputedStyle (bez axe i innych zależności).
 *
 * Kolor tekstu i tło są „efektywne”: kolor z kanałem alfa (np. z color-mix) i przezroczystość
 * elementu oraz jego przodków (opacity) są składane z tłem, tak jak maluje je przeglądarka.
 * Tło to złożenie tła elementu i kolejnych przodków aż do pierwszego nieprzezroczystego.
 *
 * Obrysy: `border` liczymy z `border-top-color` (nie ze skrótu `border-color`), względem tła
 * zewnętrznego (rodzica) i własnego tła elementu – wynikiem jest gorsza z dwóch wartości.
 * Fokus (`outline`): względem tła zewnętrznego, a przy ujemnym `outline-offset` (obrys rysowany
 * wewnątrz elementu) względem własnego tła.
 *
 * OGRANICZENIA: pomiar nie widzi `background-image` (gradienty, obrazy – np. kolor karty na
 * podglądzie), `filter`, `mix-blend-mode`, `backdrop-filter` ani pseudoelementów. Jeśli któryś
 * przodek (do pierwszego nieprzezroczystego tła) ma `background-image`, pomiar kończy się błędem
 * – wtedy trzeba podać jawne tło (`opcje.tlo`, „rgb(r, g, b)”). Przezroczystość przodków
 * stosujemy do koloru elementu, nie do tła (tła z opacity < 1 są rzadkie i nie występują w testach).
 */

export type Pomiar = {
  /** Efektywny kolor tekstu lub obrysu (rgb). */
  tekst: string;
  /** Efektywne tło (rgb) – dla obrysu to gorsze z dwóch teł (zewnętrzne, własne). */
  tlo: string;
  /** Kontrast tekstu (obrysu) z tłem. */
  kontrast: number;
};

export type Opcje = {
  /** Jawne tło „rgb(r, g, b)”, gdy tło wynika z obrazu/gradientu (np. kolor karty). */
  tlo?: string;
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

type Rodzaj = 'tekst' | 'obrys' | 'fokus';
type Wynik = { kolor: string; tla: string[] };

/** Funkcja wykonywana w przeglądarce (musi być samowystarczalna). */
function wPrzegladarce(el: Element, arg: { rodzaj: Rodzaj; tlo?: string }): Wynik {
  type Kolor = { r: number; g: number; b: number; a: number };
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
  const naTle = (k: Kolor, tlo: Kolor): Kolor => ({
    r: k.r * k.a + tlo.r * (1 - k.a),
    g: k.g * k.a + tlo.g * (1 - k.a),
    b: k.b * k.a + tlo.b * (1 - k.a),
    a: 1,
  });
  const rgb = (c: Kolor) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  const tloOd = (start: Element): string => {
    if (arg.tlo) return arg.tlo;
    const warstwy: Kolor[] = [];
    for (let e: Element | null = start; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none')
        throw new Error(
          `Tło z obrazu/gradientu (${e.tagName.toLowerCase()}.${e.className}) – podaj jawne tło (opcje.tlo)`,
        );
      const t = parsuj(cs.backgroundColor);
      if (t.a > 0) warstwy.push(t);
      if (t.a >= 1) break;
    }
    let tlo: Kolor = { r: 255, g: 255, b: 255, a: 1 };
    for (const w of warstwy.reverse()) tlo = naTle(w, tlo);
    return rgb(tlo);
  };
  const cs = getComputedStyle(el);
  const zewn = el.parentElement ?? el;
  let wlasciwosc: string;
  let tla: Element[];
  if (arg.rodzaj === 'tekst') {
    wlasciwosc = 'color';
    tla = [el];
  } else if (arg.rodzaj === 'obrys') {
    wlasciwosc = 'border-top-color';
    tla = [zewn, el];
  } else {
    wlasciwosc = 'outline-color';
    tla = [parseFloat(cs.outlineOffset) < 0 ? el : zewn];
  }
  const tlaRgb = tla.map(tloOd);
  // Przezroczystość elementu i przodków mnoży kanał alfa koloru.
  let krycie = 1;
  for (let e: Element | null = el; e; e = e.parentElement)
    krycie *= Number(getComputedStyle(e).opacity);
  const k = parsuj(cs.getPropertyValue(wlasciwosc));
  // Kolor składamy na pierwszym (zewnętrznym) tle; dla kontrastu z innym tłem – osobno poniżej.
  return { kolor: JSON.stringify({ ...k, a: k.a * krycie }), tla: tlaRgb };
}

async function zmierz(el: Locator, rodzaj: Rodzaj, opcje: Opcje): Promise<Pomiar> {
  const w = await el.evaluate(wPrzegladarce, { rodzaj, ...(opcje.tlo ? { tlo: opcje.tlo } : {}) });
  const k = JSON.parse(w.kolor) as { r: number; g: number; b: number; a: number };
  let najgorszy: Pomiar | undefined;
  for (const tlo of w.tla) {
    const [tr = 255, tg = 255, tb = 255] = (tlo.match(/\d+/g) ?? []).map(Number);
    const sklad = (x: number, t: number) => Math.round(x * k.a + t * (1 - k.a));
    const tekst = `rgb(${sklad(k.r, tr)}, ${sklad(k.g, tg)}, ${sklad(k.b, tb)})`;
    const p = { tekst, tlo, kontrast: kontrastRgb(tekst, tlo) };
    if (!najgorszy || p.kontrast < najgorszy.kontrast) najgorszy = p;
  }
  return najgorszy!;
}

/** Kontrast tekstu elementu (kolor `color`) z jego efektywnym tłem. */
export const kontrastTekstu = (el: Locator, opcje: Opcje = {}) => zmierz(el, 'tekst', opcje);

/** Kontrast obrysu (`border-top-color`) elementu z tłem zewnętrznym i własnym (gorsze z dwóch). */
export const kontrastObrysu = (el: Locator, opcje: Opcje = {}) => zmierz(el, 'obrys', opcje);

/** Kontrast obrysu fokusu (`outline-color`) z tłem oraz jego styl i grubość. */
export async function pomiarFokusu(
  el: Locator,
  opcje: Opcje = {},
): Promise<Pomiar & { styl: string; szerokosc: number }> {
  const w = await el.evaluate((e) => {
    const cs = getComputedStyle(e);
    return { styl: cs.outlineStyle, szerokosc: parseFloat(cs.outlineWidth) };
  });
  return { ...(await zmierz(el, 'fokus', opcje)), ...w };
}

/**
 * Przełącza przeglądarkę w tryb klawiatury (żeby :focus-visible działało po `focus()`) bez
 * Tab/strzałek, które zmieniają fokus albo zamykają menu: wciska klawisz funkcyjny bez
 * znaczenia dla aplikacji.
 */
export async function trybKlawiatury(page: Page) {
  await page.keyboard.press('F8');
}
