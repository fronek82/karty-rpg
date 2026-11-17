import type { Mm } from './jednostki';
import type { Odstepy, StylTekstu } from './szablon';

/** Format papieru (wymiary w orientacji pionowej). */
export const PAPIERY = {
  A4: { szer: 210, wys: 297 },
  Letter: { szer: 215.9, wys: 279.4 },
  A5: { szer: 148, wys: 210 },
  /** Odbitki fotograficzne (rozmiary z punktów foto). */
  'foto-10x15': { szer: 102, wys: 152 },
  'foto-13x18': { szer: 127, wys: 178 },
  'foto-15x21': { szer: 152, wys: 210 },
} as const satisfies Record<string, { szer: Mm; wys: Mm }>;
/** Format papieru; `wlasny` – wymiary w `UstawieniaArkusza.wymiaryPapieru`. */
export type Papier = keyof typeof PAPIERY | 'wlasny';

/** Formaty zdjęciowe – punkty foto przycinają brzegi, więc mają strefę bezpieczeństwa. */
export const czyFormatZdjeciowy = (p: Papier) => p.startsWith('foto-');
/** Dopuszczalna różnica wymiaru karty i slotu kartki (mm). */
export const TOLERANCJA_ROZMIARU: Mm = 0.5;

/**
 * Dopasowanie karty do slotu kartki (arkusze perforowane, których sloty są trochę większe niż
 * karta). Brak pola w zapisanej kartce = zachowanie sprzed M2b-1: tolerancja `TOLERANCJA_ROZMIARU`.
 */
export interface DopasowanieDoSlotu {
  /** O ile karta może być mniejsza od slotu w każdym wymiarze i wciąż „pasuje” (mm, 0–5). */
  luz: Mm;
  /** Gdzie w slocie leży karta mniejsza od slotu. */
  polozenie: 'srodek' | 'lewy-gorny';
  /** Pod kartą prostokąt slotu w kolorze tła karty (przesunięcie druku nie odsłania papieru). */
  tloDoSlotu: boolean;
  /** Linie cięcia i obrysy wydruku testowego wokół slotu albo wokół karty. */
  linie: 'slot' | 'karta';
}

/** Dopasowanie nowych kartek: luz 1 mm (63×88 mieści się w slocie 63,5×89). */
export const DOPASOWANIE_DOMYSLNE: DopasowanieDoSlotu = {
  luz: 1,
  polozenie: 'srodek',
  tloDoSlotu: false,
  linie: 'slot',
};
export const LUZ_MAKS: Mm = 5;

/**
 * Jedno miejsce sprawdzania, czy karta o danym wymiarze pasuje do slotu: mniejsza o co najwyżej
 * `luz` (bez dopasowania – `TOLERANCJA_ROZMIARU`), większa o co najwyżej `TOLERANCJA_ROZMIARU`.
 */
export function pasujeDoSlotu(
  wymiar: { szerokosc: Mm; wysokosc: Mm },
  slot: { szerokosc: Mm; wysokosc: Mm },
  dopasowanie?: Pick<DopasowanieDoSlotu, 'luz'>,
): boolean {
  const luz = dopasowanie?.luz ?? TOLERANCJA_ROZMIARU;
  const ok = (karta: Mm, s: Mm) => {
    const roznica = s - karta; // dodatnia – karta mniejsza od slotu
    return roznica <= luz + 1e-6 && -roznica <= TOLERANCJA_ROZMIARU + 1e-6;
  };
  return ok(wymiar.szerokosc, slot.szerokosc) && ok(wymiar.wysokosc, slot.wysokosc);
}

/** Lewy górny róg karty o rozmiarze `rozmiar` w obszarze slotu (środek albo lewy górny róg). */
export function polozenieKarty(
  obszar: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  rozmiar: { szer: Mm; wys: Mm },
  dopasowanie?: Pick<DopasowanieDoSlotu, 'polozenie'>,
): { x: Mm; y: Mm } {
  if (dopasowanie?.polozenie === 'lewy-gorny') return { x: obszar.x, y: obszar.y };
  return {
    x: obszar.x + Math.max(0, (obszar.szer - rozmiar.szer) / 2),
    y: obszar.y + Math.max(0, (obszar.wys - rozmiar.wys) / 2),
  };
}

/**
 * Mieszane rozmiary kart na kartce (M2b-2): każda karta ma swój wymiar z szablonu, a układ tworzą
 * pasy (cięcie gilotynowe). Bez tego pola (`jeden`) – stała siatka slotów jak dotąd.
 */
export type RozmiaryKart = 'jeden' | 'mieszane';

export interface OpcjeMieszane {
  /** `najwieksze` – od najwyższych i najszerszych; `wlasna` – wg `Arkusz.kolejnosc` (potem reszta). */
  kolejnosc: 'najwieksze' | 'wlasna';
  /** Obracanie kart o 90°, gdy to oszczędza papier. */
  obracaj: boolean;
  /** Karty tego samego rozmiaru trafiają obok siebie (do pasa z kartami tej samej wysokości). */
  grupujRozmiary: boolean;
  /** Odstęp między kartami w pasie i między pasami (mm). */
  odstep: Mm;
}

/** Opcje mieszanych rozmiarów dla nowych kartek (odstęp 0 – wspólne linie cięcia). */
export const MIESZANE_DOMYSLNE: OpcjeMieszane = {
  kolejnosc: 'najwieksze',
  obracaj: false,
  grupujRozmiary: true,
  odstep: 0,
};

/** Slot, gdy nie ma go z czego wziąć (karta pokerowa 63×88 mm). */
export const SLOT_DOMYSLNY = { szerokosc: 63, wysokosc: 88 } as const;

/** Domyślny margines bezpieczeństwa formatów zdjęciowych (mm). */
export const MARGINES_BEZPIECZENSTWA_FOTO: Mm = 3;

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

/**
 * Własny układ arkusza (np. gotowe arkusze z perforowanymi kartami): stała siatka kolumny × rzędy,
 * położenie pierwszej karty od lewego górnego rogu kartki i odstępy między kartami. Rozmiar
 * karty – `UstawieniaArkusza.slot`. Tytuł, nagłówki grup i nożyczki nie są wtedy rysowane.
 */
export interface UkladArkusza {
  kolumny: number;
  rzedy: number;
  /** Od górnej i lewej krawędzi kartki do pierwszej karty (mm). */
  gora: Mm;
  lewo: Mm;
  /** Odstęp między kolumnami i między rzędami (mm). */
  odstepPoziomy: Mm;
  odstepPionowy: Mm;
  /** Linie cięcia wokół każdej karty (arkusze perforowane zwykle ich nie potrzebują). */
  linieCiecia: boolean;
}

/** Zapisany układ użytkownika („Moje układy”): papier, rozmiar karty i siatka. */
export interface PresetUkladu {
  id: string;
  nazwa: string;
  papier: Papier;
  wymiaryPapieru?: { szer: Mm; wys: Mm };
  orientacja: 'pionowa' | 'pozioma';
  slot: { szerokosc: Mm; wysokosc: Mm };
  uklad: UkladArkusza;
  /** Dopasowanie karty do slotu dobrane pod ten arkusz; brak – luz kartki bez zmian. */
  dopasowanie?: DopasowanieDoSlotu;
}

/** Wymiary siatki własnego układu (mm) i marginesy, które zostają po prawej i na dole. */
export function wymiaryUkladu(
  uklad: UkladArkusza,
  slot: { szerokosc: Mm; wysokosc: Mm },
  strona: { szer: Mm; wys: Mm },
): { szer: Mm; wys: Mm; prawo: Mm; dol: Mm } {
  const szer =
    uklad.kolumny * slot.szerokosc + Math.max(0, uklad.kolumny - 1) * uklad.odstepPoziomy;
  const wys = uklad.rzedy * slot.wysokosc + Math.max(0, uklad.rzedy - 1) * uklad.odstepPionowy;
  return { szer, wys, prawo: strona.szer - uklad.lewo - szer, dol: strona.wys - uklad.gora - wys };
}

export interface UstawieniaArkusza {
  papier: Papier;
  /** Wymiary własnego papieru (w orientacji pionowej) – gdy `papier` to `wlasny`. */
  wymiaryPapieru?: { szer: Mm; wys: Mm };
  orientacja: 'pionowa' | 'pozioma';
  /**
   * Strefa przy krawędzi kartki, w którą karta nie powinna wchodzić (np. przycięcie w punkcie
   * foto) – karta w strefie daje ostrzeżenie; strefa widoczna w edytorze.
   */
  marginesBezpieczenstwa?: Mm;
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
  /** Własny układ arkusza (stała siatka z odstępami); bez tego – układ automatyczny. */
  uklad?: UkladArkusza;
  /** Luz, położenie, tło i linie karty w slocie; brak – tolerancja 0,5 mm jak przed M2b-1. */
  dopasowanie?: DopasowanieDoSlotu;
  /** `mieszane` – karty o różnych rozmiarach w pasach; brak = `jeden` (siatka slotów). */
  rozmiary?: RozmiaryKart;
  /** Opcje trybu `mieszane`; brak – `MIESZANE_DOMYSLNE`. */
  mieszane?: OpcjeMieszane;
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
  /**
   * Kolejność kart (identyfikatory) w trybie mieszanym z kolejnością własną; karty spoza listy
   * idą na końcu w kolejności talii. Przypięcia slotów są w tym trybie ignorowane.
   */
  kolejnosc?: string[];
  /** Przypięte egzemplarze; pozostałe karty rozmieszczane automatycznie w wolnych miejscach. */
  przypiete?: PrzypietaKarta[];
}

/** Wymiary strony w mm z uwzględnieniem orientacji. */
export function wymiaryStrony(
  u: Pick<UstawieniaArkusza, 'papier' | 'orientacja' | 'wymiaryPapieru'>,
): {
  szer: Mm;
  wys: Mm;
} {
  const p =
    u.papier === 'wlasny' ? (u.wymiaryPapieru ?? PAPIERY.A4) : (PAPIERY[u.papier] ?? PAPIERY.A4);
  return u.orientacja === 'pionowa' ? { szer: p.szer, wys: p.wys } : { szer: p.wys, wys: p.szer };
}
