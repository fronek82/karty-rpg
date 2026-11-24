import type { Projekt } from '../model/projekt';
import type { Kolor } from '../model/szablon';

/** Najwięcej kolorów zapisanych w palecie projektu (`Projekt.paleta`). */
export const MAKS_KOLOROW_PALETY = 64;

/** Najwięcej kolorów na liście „Użyte w projekcie”. */
export const LIMIT_KOLOROW_UZYTYCH = 24;

/** Pola z treścią kart (teksty), a nie z wyglądem – nie zaglądamy do nich. */
const POMIJANE_KLUCZE = new Set(['przyklad', 'parametry']);

/**
 * Klucze pól typu `Kolor` w modelu (`kolor`, `kolorDomyslny`, `tlo`, `tloNaglowka`, `domyslny`
 * w `KolorZDanych`…). Teksty pod innymi kluczami (np. napis „#123”) nie są kolorami.
 */
const KLUCZ_KOLORU = /kolor|^tlo|^domyslny$/i;

/** `#rgb` / `#rrggbb` (dowolna wielkość liter) → `#rrggbb` małymi literami; inne – `undefined`. */
export function normalizujKolor(wartosc: string): Kolor | undefined {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(wartosc.trim());
  if (!m) return undefined;
  const h = m[1]!.toLowerCase();
  return h.length === 3 ? `#${[...h].map((c) => c + c).join('')}` : `#${h}`;
}

/**
 * Kolory użyte w przodach i tyłach projektu, od najczęstszego (przy równej liczbie – w kolejności
 * pierwszego wystąpienia), najwyżej `LIMIT_KOLOROW_UZYTYCH`.
 */
export function koloryUzyte(projekt: Pick<Projekt, 'szablony' | 'rewersy'>): Kolor[] {
  const liczby = new Map<Kolor, number>();
  const przejdz = (x: unknown): void => {
    if (Array.isArray(x)) {
      for (const y of x) przejdz(y);
    } else if (x && typeof x === 'object') {
      for (const [klucz, y] of Object.entries(x)) {
        if (typeof y === 'string') {
          const k = KLUCZ_KOLORU.test(klucz) ? normalizujKolor(y) : undefined;
          if (k) liczby.set(k, (liczby.get(k) ?? 0) + 1);
        } else if (!POMIJANE_KLUCZE.has(klucz)) przejdz(y);
      }
    }
  };
  przejdz(projekt.szablony);
  przejdz(projekt.rewersy ?? []);
  // Sortowanie stabilne – przy remisie zostaje kolejność pierwszego wystąpienia.
  return [...liczby.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT_KOLOROW_UZYTYCH)
    .map(([k]) => k);
}

/** Dodaje kolor na koniec palety (bez powtórzeń); przy pełnej palecie wypada najstarszy. */
export function dodajDoPalety(projekt: Projekt, kolor: string): Projekt {
  const k = normalizujKolor(kolor);
  if (!k || projekt.paleta?.includes(k)) return projekt;
  return { ...projekt, paleta: [...(projekt.paleta ?? []), k].slice(-MAKS_KOLOROW_PALETY) };
}

/** Usuwa kolor z palety; pusta paleta znika z projektu. */
export function usunZPalety(projekt: Projekt, kolor: string): Projekt {
  const k = normalizujKolor(kolor);
  if (!k || !projekt.paleta?.includes(k)) return projekt;
  const wynik: Projekt = { ...projekt, paleta: projekt.paleta.filter((x) => x !== k) };
  if (wynik.paleta?.length === 0) delete wynik.paleta;
  return wynik;
}
