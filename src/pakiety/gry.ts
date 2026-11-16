import type { Pakiet } from './typy';

/**
 * Gry na ekranie startowym. Dostępna gra ma pakiet (szablony, typy kart, gotowe układy) –
 * kolejną dodaje się jako kolejny wpis i od razu dostaje swój kafelek. Gry planowane są
 * pokazywane na stronie „inna gra” z informacją, w którym kamieniu milowym się pojawią.
 */
export interface Gra {
  id: string;
  nazwa: string;
  opis: string;
  /** Pakiet ładowany przy wyborze gry (osobny fragment kodu). */
  pakiet?: () => Promise<Pakiet>;
  /** Kamień milowy, w którym gra jest planowana (gdy jeszcze niedostępna). */
  planowana?: string;
}

export const gry: Gra[] = [
  {
    id: 'mausritter',
    nazwa: 'Mausritter',
    opis: 'Karty ekwipunku i stanów w siatce slotów – broń, zbroje, przedmioty, zaklęcia, stany.',
    pakiet: () => import('./mausritter').then((m) => m.pakietMausritter),
  },
  {
    id: 'dnd',
    nazwa: 'Dungeons & Dragons',
    opis: 'Karty czarów: kolorowa karta z panelami, kolory wg klasy, długie opisy.',
    planowana: 'M3',
  },
  {
    id: 'warhammer',
    nazwa: 'Warhammer',
    opis: 'Bloki statystyk: tabela cech, pergamin z postrzępioną krawędzią.',
    planowana: 'M3',
  },
  {
    id: 'jedyny-pierscien',
    nazwa: 'Jedyny Pierścień',
    opis: 'Karty wrogów: wartości w rombach, styl szkicowy.',
    planowana: 'M3',
  },
  {
    id: 'wlasne',
    nazwa: 'Własne karty',
    opis: 'Dowolny rozmiar karty i własny szablon w edytorze.',
    planowana: 'M2',
  },
];

export const graDostepna = (g: Gra): g is Gra & { pakiet: () => Promise<Pakiet> } => !!g.pakiet;
