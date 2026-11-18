/** Czyste funkcje wyboru języka i motywu strony instrukcji (bez DOM – testowane osobno). */
import { jezykDomyslny } from '../wspolne/ustawienia';

export type Jezyk = 'pl' | 'en';
export type Motyw = 'light' | 'dark';

export const czyJezyk = (v: unknown): v is Jezyk => v === 'pl' || v === 'en';

/** Język: `?lang=` w adresie, potem zapamiętany wybór, potem ustawienie przeglądarki (D8). */
export function wybierzJezyk(
  szukaj: string,
  zapisany: string | null,
  jezykPrzegladarki: string | undefined,
): Jezyk {
  const z = new URLSearchParams(szukaj).get('lang');
  if (czyJezyk(z)) return z;
  if (czyJezyk(zapisany)) return zapisany;
  return jezykDomyslny(jezykPrzegladarki);
}

/** Motyw dla zapamiętanego wyboru (`light`, `dark`, `system` lub brak) i ustawienia systemu. */
export function wybierzMotyw(zapisany: string | null, systemCiemny: boolean): Motyw {
  if (zapisany === 'light' || zapisany === 'dark') return zapisany;
  return systemCiemny ? 'dark' : 'light';
}
