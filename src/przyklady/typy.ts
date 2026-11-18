import type { Mm } from '../model/jednostki';
import type { Szablon } from '../model/szablon';

/**
 * Przykładowy szablon z danymi jednej karty. Teksty (nazwy, etykiety, dane) powstają w języku
 * interfejsu z chwili wywołania – po utworzeniu projektu są zwykłą treścią projektu.
 */
export interface Przyklad {
  szablon: Szablon;
  /** Wartości pól karty (według kluczy szablonu). */
  dane: Record<string, string>;
}

/** Identyfikatory kafelków: pusta karta i przykłady. */
export type IdPrzykladu = 'pusta' | 'opis' | 'statystyki' | 'potwor' | 'ozdobna' | 'swobodna';

/** Opis przykładu na ekranie „Stwórz własne karty”; sam szablon ładuje się leniwie. */
export interface OpisPrzykladu {
  /** Stały identyfikator; nazwa w interfejsie to klucz `przyklad.<id>.nazwa`. */
  id: IdPrzykladu;
  /** Rozmiar karty – tylko do szkieletu podglądu (test pilnuje zgodności z szablonem). */
  rozmiar: { szerokosc: Mm; wysokosc: Mm };
  laduj: () => Promise<Przyklad>;
}
