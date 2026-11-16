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
  /**
   * `styl.rozmiar` to rozmiar największy: dłuższy tytuł jest zmniejszany, żeby zmieścił się wzdłuż
   * boku siatki (z miejscem na nożyczki na początku tej krawędzi).
   */
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

/**
 * Nożyczki na przedłużeniu linii cięcia, poza siatką, skierowane do środka; od nożyczek
 * do krawędzi siatki biegnie przerywana linia prowadząca.
 */
export interface Nozyczki {
  linia: 'pozioma' | 'pionowa';
  /** Numer linii siatki (0 = pierwsza krawędź). */
  indeks: number;
  /** Na początku (lewo/góra) czy na końcu (prawo/dół) linii. */
  strona: 'poczatek' | 'koniec';
  rozmiar: Mm;
  /** Odstęp od siatki do nożyczek (mm) – długość linii prowadzącej. */
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
    /** Odstęp między opisem a górną linią cięcia kart (mm). */
    odstepOdKart: Mm;
  };
  linie: LinieCiecia;
  nozyczki?: Nozyczki;
  /** Rozmiar slotu siatki; bez tego – z pierwszej karty w trybie slotów (pusta kartka go potrzebuje). */
  slot?: { szerokosc: Mm; wysokosc: Mm };
  /**
   * Skala szarości: kolory tekstu, linii i wypełnień zamieniane na szarości. Obrazy rastrowe
   * zamienia warstwa wczytująca zasoby (UI, E7) – silnik i PDF dostają już szare pliki.
   */
  czarnoBialy?: boolean;
  /**
   * Ręczne położenie lewego górnego rogu siatki (mm od rogu strony). Bez tego siatka zaczyna się
   * w lewym górnym rogu obszaru po marginesach, tytule i pasie nagłówków grup.
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

/**
 * Nagłówek grupy nad kolumnami (np. „Ranna” nad stanami), ustawiany ręcznie w edytorze kartki.
 * Styl z `UstawieniaArkusza.grupy`. `odstepPrzed` przesuwa kolumny od `kolumna` w prawo
 * (na tej stronie) – jak odstępy między grupami w oryginalnym arkuszu stanów.
 */
export interface NaglowekGrupy {
  id: string;
  strona: number;
  kolumna: number;
  kolumny: number;
  naglowek: string;
  opis?: string;
  odstepPrzed?: Mm;
}

export interface Arkusz {
  id: string;
  nazwa: string;
  taliaId: string;
  /** Najmniejsza liczba stron (strony mogą być puste – edytor kartki). */
  liczbaStron?: number;
  /** Ręczne nagłówki grup (zamiast automatycznych grup talii). */
  naglowki?: NaglowekGrupy[];
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
