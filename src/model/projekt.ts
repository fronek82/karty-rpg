import type { Arkusz } from './arkusz';
import type { Szablon, Talia, WariantCzcionki } from './szablon';

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
 */
export const WERSJA_SCHEMATU = 8;

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
  talie: Talia[];
  arkusze: Arkusz[];
  /** Pakiet gry, z którego pochodzą szablony i typy kart (np. `mausritter`). */
  pakiet?: string;
}

/** Bajty zasobów projektu według identyfikatora. */
export type DaneZasobow = Map<string, Uint8Array>;

export function rozszerzenieZasobu(opis: OpisZasobu): string {
  return opis.format;
}
