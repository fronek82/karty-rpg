import type { Mm } from './jednostki';

/** Kolor w zapisie `#rrggbb`. */
export type Kolor = string;

/**
 * Rozmiar elementu wzdłuż jednej osi:
 * - `{ mm }` – stały,
 * - `{ procent }` – procent miejsca dostępnego dla dziecka: wnętrza rodzica (bez paddingu);
 *   w osi poprzecznej i w warstwach – pomniejszonego o marginesy dziecka,
 * - `{ wypelnij }` – udział w wolnym miejscu z wagą,
 * - `'auto'` – dopasuj do treści.
 */
export type Rozmiar = { mm: Mm } | { procent: number } | { wypelnij: number } | 'auto';

export interface Odstepy {
  gora: Mm;
  prawo: Mm;
  dol: Mm;
  lewo: Mm;
}

export type WyrownanieOsi = 'poczatek' | 'srodek' | 'koniec';
export type StylLinii = 'ciagla' | 'przerywana' | 'kropkowana';

export interface Obramowanie {
  grubosc: Mm;
  kolor: Kolor;
  styl?: StylLinii;
  /** Które krawędzie rysować; domyślnie wszystkie (wtedy z zaokrągleniem `promien`). */
  krawedzie?: Partial<Record<keyof Odstepy, boolean>>;
}

interface WezelBazowy {
  /** Identyfikator unikalny w obrębie szablonu. */
  id: string;
  szerokosc?: Rozmiar;
  wysokosc?: Rozmiar;
  /** Margines zewnętrzny (mm) – jedna liczba dla wszystkich stron albo osobno. */
  margines?: Mm | Partial<Odstepy>;
  /** Padding wewnętrzny (mm). */
  padding?: Mm | Partial<Odstepy>;
  /**
   * Położenie w rodzicu. W osi poprzecznej wiersza/kolumny oraz w obu osiach warstw:
   * brak wyrównania = rozciągnij na całe miejsce, wyrównanie = rozmiar wg treści.
   */
  wyrownanie?: { poziomo?: WyrownanieOsi; pionowo?: WyrownanieOsi };
  tlo?: Kolor;
  obramowanie?: Obramowanie;
  /** Zaokrąglenie rogów tła i obramowania (mm); przy kształcie „sciety” – wielkość ścięcia. */
  promien?: Mm;
  /**
   * Najmniejszy rozmiar (mm) – np. kwadratowa ramka wartości. Obowiązuje przy rozmiarze wg treści,
   * rozciąganiu i wypełnianiu (także kosztem wyjścia poza rodzica); rozmiar stały (mm, %) ma pierwszeństwo.
   */
  minSzerokosc?: Mm;
  minWysokosc?: Mm;
}

/** Wiersz (dzieci obok siebie), kolumna (jedno pod drugim) lub warstwy (jedno na drugim). */
export interface Kontener extends WezelBazowy {
  typ: 'wiersz' | 'kolumna' | 'warstwy';
  dzieci: Wezel[];
  /** Odstęp między dziećmi (mm). */
  odstep?: Mm;
  /** Rozłożenie dzieci w osi głównej, gdy zostaje wolne miejsce. */
  rozklad?: WyrownanieOsi | 'miedzy';
}

export type WariantCzcionki = 'normalny' | 'pogrubiony' | 'kursywa' | 'pogrubiona-kursywa';

export interface StylTekstu {
  /** Rola czcionki w projekcie (np. `tytul`, `tresc`) albo nazwa rodziny. */
  czcionka: string;
  wariant?: WariantCzcionki;
  /** Rozmiar czcionki (mm, wysokość kwadratu em). Do zapisu w punktach służy `pt()`. */
  rozmiar: Mm;
  /** Auto-dopasowanie: zmniejszaj do tego rozmiaru, aż tekst się zmieści. */
  minRozmiar?: Mm;
  kolor?: Kolor;
  wyrownanie?: 'lewo' | 'srodek' | 'prawo';
  wyrownaniePionowe?: WyrownanieOsi;
  /** Wysokość wiersza jako wielokrotność rozmiaru (domyślnie 1,2). */
  interlinia?: number;
  wielkieLitery?: boolean;
  /** Dodatkowy odstęp między literami (mm). */
  odstepLiter?: Mm;
}

export type GdyPuste = 'pokaz-ramke' | 'ukryj';

interface PoleBazowe extends WezelBazowy {
  /** Klucz w danych karty; bez klucza pole pokazuje wartość stałą z szablonu. */
  klucz?: string;
  /**
   * Gdy brak wartości: `pokaz-ramke` – zachowaj miejsce, tło i obramowanie (domyślnie),
   * `ukryj` – pole znika i nie zajmuje miejsca.
   */
  gdyPuste?: GdyPuste;
}

export interface PoleTekst extends PoleBazowe {
  typ: 'tekst';
  /** Tekst stały (gdy brak klucza) albo domyślny (gdy w danych pusto). */
  tekst?: string;
  styl: StylTekstu;
  /** Łamanie na wiele wierszy (domyślnie tak). */
  wieleWierszy?: boolean;
  etykieta?: {
    tekst: string;
    /** `nad` – osobny wiersz nad wartością; `przed` – w tej samej linii przed tekstem. */
    pozycja: 'nad' | 'przed';
    styl?: Partial<StylTekstu>;
  };
}

/** Krótka wartość (np. `k6`, `-1 obr`) w ramce o zadanym kształcie. */
export interface PoleWartosc extends PoleBazowe {
  typ: 'wartosc';
  tekst?: string;
  styl: StylTekstu;
  /** `sciety` – prostokąt ze ściętymi rogami (wielkość ścięcia w `promien`). */
  ksztalt: 'prostokat' | 'kolo' | 'sciety';
}

export interface PoleObraz extends PoleBazowe {
  typ: 'obraz';
  /** Stały zasób, gdy brak klucza (identyfikator z biblioteki projektu). */
  zasob?: string;
  dopasowanie: 'dopasuj' | 'wypelnij' | 'rozciagnij';
  /** Punkt zaczepienia kadru, 0–1 w każdej osi (domyślnie środek). */
  kadr?: { x: number; y: number };
}

/** Kółka/kwadraty do zamalowania. Wartość z danych (liczba) nadpisuje liczbę znaczników. */
export interface PoleZnaczniki extends PoleBazowe {
  typ: 'znaczniki';
  kolumny: number;
  rzedy: number;
  ksztalt: 'kolo' | 'kwadrat';
  srednica: Mm;
  odstep: Mm;
  grubosc: Mm;
  kolor?: Kolor;
}

/** Pusta ramka do pisania ołówkiem z opcjonalnym stałym sufiksem (np. `/ 250p`). */
export interface PoleWpis extends PoleBazowe {
  typ: 'wpis';
  sufiks?: string;
  styl: StylTekstu;
}

export type NazwaIkony = 'gwiazdka';

export interface PoleIkona extends PoleBazowe {
  typ: 'ikona';
  ikona: NazwaIkony;
  rozmiar: Mm;
  kolor?: Kolor;
}

export type Pole = PoleTekst | PoleWartosc | PoleObraz | PoleZnaczniki | PoleWpis | PoleIkona;
export type Wezel = Kontener | Pole;

export type RozmiarKarty =
  | {
      tryb: 'sloty';
      slot: { szerokosc: Mm; wysokosc: Mm };
      /** Domyślny rozmiar karty w slotach (karta może go zmienić). */
      kolumny: number;
      rzedy: number;
    }
  | { tryb: 'mm'; szerokosc: Mm; wysokosc: Mm };

export interface Szablon {
  id: string;
  nazwa: string;
  rozmiar: RozmiarKarty;
  promienRogow?: Mm;
  tlo?: Kolor;
  korzen: Kontener;
}

export interface Karta {
  id: string;
  szablonId: string;
  /** Wartości pól według kluczy szablonu. */
  dane: Record<string, string>;
  /** Liczba sztuk do druku. */
  ilosc: number;
  /** Rozmiar w slotach (tylko szablony w trybie slotów). */
  rozmiar?: { kolumny: number; rzedy: number };
}

/** Grupa kart w talii – na arkuszu dostaje nagłówek z opisem nad kolumnami (np. stany). */
export interface GrupaKart {
  id: string;
  naglowek: string;
  opis?: string;
  /** Identyfikatory kart należących do grupy (w kolejności). */
  karty: string[];
}

/** Talia – zbiór kart (na razie bez rewersu – M4). */
export interface Talia {
  id: string;
  nazwa: string;
  karty: Karta[];
  grupy?: GrupaKart[];
}

export function czyKontener(wezel: Wezel): wezel is Kontener {
  return wezel.typ === 'wiersz' || wezel.typ === 'kolumna' || wezel.typ === 'warstwy';
}

/** Wymiary karty w mm. */
export function wymiaryKarty(
  szablon: Szablon,
  karta?: Pick<Karta, 'rozmiar'>,
): {
  szer: Mm;
  wys: Mm;
} {
  const r = szablon.rozmiar;
  if (r.tryb === 'mm') return { szer: r.szerokosc, wys: r.wysokosc };
  const kolumny = karta?.rozmiar?.kolumny ?? r.kolumny;
  const rzedy = karta?.rozmiar?.rzedy ?? r.rzedy;
  return { szer: kolumny * r.slot.szerokosc, wys: rzedy * r.slot.wysokosc };
}

export function rozwinOdstepy(o: Mm | Partial<Odstepy> | undefined): Odstepy {
  if (o === undefined) return { gora: 0, prawo: 0, dol: 0, lewo: 0 };
  if (typeof o === 'number') return { gora: o, prawo: o, dol: o, lewo: o };
  return { gora: o.gora ?? 0, prawo: o.prawo ?? 0, dol: o.dol ?? 0, lewo: o.lewo ?? 0 };
}
