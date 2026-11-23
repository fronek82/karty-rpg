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
  /** Karty gry są jednostronne – Edytor kart nie pokazuje wyboru ani listy rewersów. */
  bezRewersow?: boolean;
  /** Karty gry wypełnia się w edytorze – bez importu danych z CSV/XLSX. */
  bezImportuTabeli?: boolean;
}

export const gry: Gra[] = [
  {
    id: 'mausritter',
    nazwa: 'Mausritter',
    nazwaDo: 'Mausrittera',
    opis: 'Karty ekwipunku i stanów w siatce slotów – broń, zbroje, przedmioty, zaklęcia, stany.',
    pakiet: () => import('./mausritter').then((m) => m.pakietMausritter),
    bezRewersow: true,
    bezImportuTabeli: true,
  },
];

/** Gra z rejestru o danym id pakietu (projekty własne i nieznane pakiety – `undefined`). */
export function graPakietu(idPakietu: string | undefined): Gra | undefined {
  return idPakietu === undefined ? undefined : gry.find((g) => g.id === idPakietu);
}
