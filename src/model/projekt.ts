import type { Arkusz } from './arkusz';
import type { Szablon, Talia, WariantCzcionki } from './szablon';

/** Numer wersji schematu zapisu projektu (plik `.kartyrpg` i IndexedDB). Zwiększać z migracją. */
export const WERSJA_SCHEMATU = 1;

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
