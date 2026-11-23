import type { ZakladkaBiblioteki } from './StronaBiblioteki';

/**
 * Adres zakładki strony Biblioteki z powrotem (przycisk „Gotowe”) – np. do edytora, z którego
 * otwarto bibliotekę. Bez `powrot` – zwykła strona Biblioteki.
 */
export const adresBiblioteki = (zakladka: ZakladkaBiblioteki, powrot?: string): string =>
  `#/biblioteki/${zakladka}${powrot ? `?powrot=${encodeURIComponent(powrot)}` : ''}`;

/** Bieżący adres strony (hash) jako powrót z Biblioteki. */
export const biezacyAdres = (): string =>
  typeof window === 'undefined' ? '#/' : window.location.hash || '#/';

/** Bezpieczny adres powrotu z parametru (tylko trasy aplikacji `#/…`). */
export function adresPowrotu(zapytanie: string | undefined): string | undefined {
  const v = new URLSearchParams(zapytanie ?? '').get('powrot');
  return v && v.startsWith('#/') ? v : undefined;
}
