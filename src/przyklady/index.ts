import type { OpisPrzykladu } from './typy';

/**
 * Przykładowe szablony ekranu „Stwórz własne karty”: ogólne klocki edytora, bez zasad i nazw
 * konkretnych gier. Definicje to osobne moduły ładowane leniwie (`import()`), więc nie zwiększają
 * wejściowego pakietu aplikacji. Nazwa w interfejsie: klucz `przyklad.<id>.nazwa`.
 */

/** Pierwszy kafelek: neutralna pusta karta 63×88 mm bez pól. */
export const PUSTA_KARTA: OpisPrzykladu = {
  id: 'pusta',
  rozmiar: { szerokosc: 63, wysokosc: 88 },
  laduj: () => import('./pusta').then((m) => m.przyklad()),
};

export const PRZYKLADY: readonly OpisPrzykladu[] = [
  {
    id: 'opis',
    rozmiar: { szerokosc: 63, wysokosc: 88 },
    laduj: () => import('./kartaZOpisem').then((m) => m.przyklad()),
  },
  {
    id: 'statystyki',
    rozmiar: { szerokosc: 88, wysokosc: 63 },
    laduj: () => import('./blokStatystyk').then((m) => m.przyklad()),
  },
  {
    id: 'potwor',
    rozmiar: { szerokosc: 63, wysokosc: 88 },
    laduj: () => import('./kartaPotwora').then((m) => m.przyklad()),
  },
  {
    id: 'ozdobna',
    rozmiar: { szerokosc: 63, wysokosc: 88 },
    laduj: () => import('./kartaOzdobna').then((m) => m.przyklad()),
  },
  {
    id: 'swobodna',
    rozmiar: { szerokosc: 63, wysokosc: 88 },
    laduj: () => import('./kartaSwobodna').then((m) => m.przyklad()),
  },
];

/** Wszystkie kafelki ekranu w kolejności pokazywania: pusta karta, potem przykłady. */
export const KAFELKI_SZABLONOW: readonly OpisPrzykladu[] = [PUSTA_KARTA, ...PRZYKLADY];
