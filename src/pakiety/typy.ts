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
  zasoby: ZasobPakietu[];
}
