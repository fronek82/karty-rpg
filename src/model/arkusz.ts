import type { Mm } from './jednostki';
import type { Odstepy, StylTekstu } from './szablon';

/** Format papieru (wymiary w orientacji pionowej). */
export const PAPIERY = {
  A4: { szer: 210, wys: 297 },
  Letter: { szer: 215.9, wys: 279.4 },
} as const satisfies Record<string, { szer: Mm; wys: Mm }>;
export type Papier = keyof typeof PAPIERY;

export interface TytulArkusza {
  tekst: string;
  /** `gora` – poziomo nad siatką; `lewo` – pionowo wzdłuż lewej krawędzi, czytany od dołu. */
  polozenie: 'gora' | 'lewo';
  styl: StylTekstu;
  /** Odstęp między tytułem a siatką (mm). */
  odstep: Mm;
}

export interface LinieCiecia {
  grubosc: Mm;
  kolor: string;
  /** Kreska i przerwa (mm); wzór wyśrodkowany na każdym boku slotu. */
  kreska: Mm;
  przerwa: Mm;
}

/** Nożyczki na przedłużeniu linii cięcia, poza siatką, skierowane do środka. */
export interface Nozyczki {
  linia: 'pozioma' | 'pionowa';
  /** Numer linii siatki (0 = pierwsza krawędź). */
  indeks: number;
  /** Na początku (lewo/góra) czy na końcu (prawo/dół) linii. */
  strona: 'poczatek' | 'koniec';
  rozmiar: Mm;
  /** Odstęp od siatki (mm). */
  odstep: Mm;
}

export interface UstawieniaArkusza {
  papier: Papier;
  orientacja: 'pionowa' | 'pozioma';
  marginesy: Odstepy;
  tytul?: TytulArkusza;
  /** Nagłówki grup nad kolumnami (gdy talia ma grupy). */
  grupy?: {
    styl: StylTekstu;
    stylOpisu: StylTekstu;
    /** Odstęp między grupami (mm). */
    odstep: Mm;
    /** Odstęp między opisem a kartami (mm). */
    odstepOdKart: Mm;
  };
  linie: LinieCiecia;
  nozyczki?: Nozyczki;
  /** Skala szarości (kolory kart zamieniane na szarości). */
  czarnoBialy?: boolean;
  /**
   * Ręczne położenie lewego górnego rogu siatki (mm od rogu strony). Bez tego siatka jest
   * wyrównana do prawego dolnego rogu obszaru po marginesach, tytule i nagłówkach.
   */
  poczatekSiatki?: { x: Mm; y: Mm };
}

/** Ręczne przypięcie egzemplarza karty do pozycji (w slotach). */
export interface PrzypietaKarta {
  kartaId: string;
  kolumna: number;
  rzad: number;
  /** Numer strony od 0 (domyślnie 0). */
  strona?: number;
}

export interface Arkusz {
  id: string;
  nazwa: string;
  taliaId: string;
  ustawienia: UstawieniaArkusza;
  /** Przypięte egzemplarze; pozostałe karty rozmieszczane automatycznie w wolnych miejscach. */
  przypiete?: PrzypietaKarta[];
}

/** Wymiary strony w mm z uwzględnieniem orientacji. */
export function wymiaryStrony(u: Pick<UstawieniaArkusza, 'papier' | 'orientacja'>): {
  szer: Mm;
  wys: Mm;
} {
  const p = PAPIERY[u.papier];
  return u.orientacja === 'pionowa' ? { szer: p.szer, wys: p.wys } : { szer: p.wys, wys: p.szer };
}
