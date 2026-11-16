import type { Arkusz, UstawieniaArkusza } from '../model/arkusz';
import type { Szablon, Talia } from '../model/szablon';

/** Obraz dołączony do pakietu (plik w katalogu pakietu). */
export interface ZasobPakietu {
  id: string;
  /** Adres pliku (w aplikacji – z importu Vite; w testach – ścieżka). */
  plik: string;
  szerokosc: number;
  wysokosc: number;
  format: 'png' | 'jpg';
}

/** Czcionka domyślna dla roli (np. `tytul`), plik z `public/czcionki/`. */
export interface CzcionkaPakietu {
  rola: string;
  rodzina: string;
  warianty: Partial<Record<'normalny' | 'pogrubiony' | 'kursywa' | 'pogrubiona-kursywa', string>>;
}

/** Rozmiar karty w slotach z nazwą dla użytkownika (np. „ciężka”). */
export interface RozmiarTypu {
  kolumny: number;
  rzedy: number;
  nazwa?: string;
}

/**
 * Typ karty w menu edytora kartki (np. „Broń”): szablon(y) i rozmiary – pierwszy jest domyślny.
 * Kilka wariantów (np. przedmiot / sakiewka) daje podwybór w menu.
 */
export interface TypKarty {
  id: string;
  nazwa: string;
  /** Znak lub emoji przy nazwie w menu. */
  ikona: string;
  warianty: { szablonId: string; nazwa: string; dane?: Record<string, string> }[];
  rozmiary: RozmiarTypu[];
}

/** Gotowy układ z pakietu – arkusze ładowane na kartki jako zwykłe karty. */
export interface GotowyUklad {
  id: string;
  nazwa: string;
  arkusze: string[];
}

/** Gotowy zestaw szablonów i talii do wczytania jako nowy projekt. */
export interface Pakiet {
  id: string;
  nazwa: string;
  opis: string;
  /** Atrybucja wyświetlana przy pakiecie (szczegóły w LICENCJE.md pakietu). */
  atrybucja: string;
  czcionki: CzcionkaPakietu[];
  szablony: Szablon[];
  talie: Talia[];
  arkusze: Arkusz[];
  zasoby: ZasobPakietu[];
  /** Typy kart w menu edytora kartki. */
  typyKart: TypKarty[];
  gotoweUklady: GotowyUklad[];
  /** Nowa, pusta kartka: nazwa i ustawienia (papier, tytuł, linie, styl nagłówków grup). */
  nowaKartka: { nazwa: string; ustawienia: UstawieniaArkusza };
}
