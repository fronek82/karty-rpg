import type { ElementOzdobny } from '../ozdobniki/typy';
import type { Arkusz } from './arkusz';
import type { Rewers, Szablon, Talia, WariantCzcionki } from './szablon';

/**
 * Numer wersji schematu zapisu projektu (plik `.kartyrpg` i IndexedDB). Zwiększać z migracją.
 * 1 – M1 (talie z ilościami, arkusze z przypięciami i grupami talii).
 * 2 – edytor kartki: `liczbaStron`, ręczne nagłówki, slot w ustawieniach, `pakiet` projektu.
 * 3 – M2: ramka karty, romb i etykieta wartości, separator, tabela, formatowanie i styl akapitów.
 * 4 – M2-2: formaty papieru (A5, zdjęciowe, własny), margines bezpieczeństwa kartki.
 * 5 – M2-3: nazwy węzłów szablonu, dane przykładowe szablonu.
 * 6 – M2-4: tabela z wieloma wierszami i opcjonalnymi nagłówkami, kształty kwadrat/tarcza/sześciokąt.
 * 7 – M2-6: własny układ arkusza (`ustawienia.uklad`).
 * 8 – M2b-1: `ustawienia.dopasowanie` (luz karty w slocie), `dopasowanie` w presetach układów.
 * 9 – M2b-2: mieszane rozmiary kart (`ustawienia.rozmiary`, `ustawienia.mieszane`, `Arkusz.kolejnosc`).
 * 10 – M2b-3: styl linii `podwojna` (+ `przerwa`), `narozniki` na ramce karty i węzłach szablonu.
 * 11 – M2b-4: `ozdoba` (motyw powtarzalny zamiast linii) na ramce karty i węzłach szablonu.
 * 12 – M2b-5: separator ozdobny (`rysunek`, `zakonczenia`, `srodek`, `dlugosc`, `odstepOdOzdoby`).
 * 13 – M2b-6: `biblioteka.ozdobniki` (własne SVG), kształt wartości `wlasny` (+ `ksztaltElement`);
 *      plik szablonu niesie użyte elementy (`biblioteka`).
 * 14 – M2b-7: ramka 9-slice – `ozdoba.rodzaj: 'ramka9'` (ramka karty i węzły) i element biblioteki
 *      rodzaju `ramka9` (`ramka9`: źródło PNG z zasobów projektu albo SVG, wcięcia, boki, środek).
 * 15 – M2b-8: tryb swobodny – kontener `swobodny` i `pozycja` węzła (x, y, kotwica, obrót 0/90/180/270).
 * 16 – M2b-9: `Szablon.podklad` (podkład ze wzoru pod podglądem edytora: zasób obrazu projektu,
 *      przezroczystość, widoczność); poza plikiem szablonu, nigdy w scenie, PDF ani eksporcie obrazów.
 * 17 – M2c-1: `Arkusz.wlasnySzablonId` dla własnej kartki w projekcie pakietowym.
 * 23 – M4-1: rewersy projektu i opcjonalne przypisania na talii, szablonie i karcie.
 * 24 – M4-2: tryb tekstury tła rewersu (`teksturaTryb`) i grafika SVG z biblioteki na polu ikony (`element`).
 * 25 – M4-3: tekst po łuku (`PoleTekst.luk`), krycie warstwy (`krycie`) oraz krycie i zabarwienie tekstury tła rewersu.
 * 26 – M4-4: ustawienia druku dwustronnego arkusza (`UstawieniaArkusza.dwustronny`).
 * 27 – M4-5: ustawienia trybu drukarni arkusza (`UstawieniaArkusza.drukarnia`: spad, znaczniki cięcia, układ).
 * 28 – N4: wartość w kształcie – `zachowajProporcje`, `ramiona`, nowe figury, etykieta obok kształtu.
 */
export const WERSJA_SCHEMATU = 28;

export type ZrodloCzcionki = 'wbudowana' | 'google' | 'wlasna';

export interface OpisObrazu {
  rodzaj: 'obraz';
  /** Identyfikator zasobu – litery, cyfry, `_`, `-`, `.`, `/` (w nazwie pliku w archiwum kodowany). */
  id: string;
  nazwa: string;
  format: 'png' | 'jpg';
  szerokosc: number;
  wysokosc: number;
}

export interface OpisCzcionki {
  rodzaj: 'czcionka';
  id: string;
  /** Nazwa pliku, z którego czcionkę wgrano. */
  nazwa: string;
  rodzina: string;
  wariant: WariantCzcionki;
  format: 'ttf' | 'otf' | 'woff' | 'woff2';
  /** Źródło decyduje o ostrzeżeniu o licencji przy udostępnianiu szablonu. */
  zrodlo: ZrodloCzcionki;
}

export type OpisZasobu = OpisObrazu | OpisCzcionki;

/** Projekt: biblioteka zasobów, szablony, talie i arkusze. Bajty zasobów trzymane osobno. */
export interface Projekt {
  wersja: number;
  id: string;
  nazwa: string;
  /** Daty w formacie ISO 8601. */
  utworzono: string;
  zmieniono: string;
  /** Role czcionek (np. `tytul`, `tresc`) → rodzina czcionki z biblioteki. */
  role: Record<string, string>;
  zasoby: OpisZasobu[];
  szablony: Szablon[];
  rewersy?: Rewers[];
  talie: Talia[];
  arkusze: Arkusz[];
  /** Pakiet gry, z którego pochodzą szablony i typy kart (np. `mausritter`). */
  pakiet?: string;
  /**
   * Biblioteka ozdobników projektu: własne elementy z zaimportowanych plików SVG (kontury
   * spłaszczone do M/L/C/Z, bez surowego SVG). Brak pola = projekt bez własnych elementów.
   */
  biblioteka?: { ozdobniki: ElementOzdobny[] };
}

/** Bajty zasobów projektu według identyfikatora. */
export type DaneZasobow = Map<string, Uint8Array>;
