/** Wspólne przekształcenia nazw (identyfikatory, klucze, nazwy plików, porównywanie nagłówków). */

/** Usuwa znaki diakrytyczne (rozkład NFD) i zamienia ł/Ł na l/L – baza identyfikatorów. */
export const bezZnakowDiakrytycznych = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L');

/**
 * Nazwa do porównań bez względu na wielkość liter i znaki diakrytyczne (np. nagłówki kolumn
 * importowanej tabeli): przycięta, małymi literami, bez diakrytyków.
 */
export const normalizujNazwe = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ł/g, 'l');
