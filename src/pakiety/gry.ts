import type { Pakiet } from './typy';

/**
 * Gry na ekranie startowym. Każda ma pakiet (szablony, typy kart, gotowe układy) – kolejną
 * dodaje się jako kolejny wpis i od razu dostaje swój kafelek. Karty do gier spoza rejestru
 * robi się od zera w edytorze własnych kart (kafelek „Stwórz własne karty”).
 */
export interface Gra {
  id: string;
  nazwa: string;
  /** Nazwa w dopełniaczu na kafelku „Stwórz karty do …”. */
  nazwaDo: string;
  opis: string;
  /** Pakiet ładowany przy wyborze gry (osobny fragment kodu). */
  pakiet: () => Promise<Pakiet>;
}

export const gry: Gra[] = [
  {
    id: 'mausritter',
    nazwa: 'Mausritter',
    nazwaDo: 'Mausrittera',
    opis: 'Karty ekwipunku i stanów w siatce slotów – broń, zbroje, przedmioty, zaklęcia, stany.',
    pakiet: () => import('./mausritter').then((m) => m.pakietMausritter),
  },
];
