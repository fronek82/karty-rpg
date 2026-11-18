import type { GotowyUklad, TypKarty } from '../typy';

/** Typy kart w menu „Dodaj kartę” (pierwszy rozmiar – domyślny). */
export const typyKartMausrittera: TypKarty[] = [
  {
    id: 'bron',
    nazwa: 'Broń',
    ikona: '⚔',
    warianty: [{ szablonId: 'mausritter-bron', nazwa: 'Broń' }],
    rozmiary: [
      { kolumny: 1, rzedy: 1 },
      { kolumny: 1, rzedy: 2, id: 'ciezka', nazwa: 'ciężka' },
    ],
  },
  {
    id: 'zbroja',
    nazwa: 'Zbroja',
    ikona: '🛡',
    warianty: [{ szablonId: 'mausritter-zbroja', nazwa: 'Zbroja' }],
    rozmiary: [
      { kolumny: 1, rzedy: 2, id: 'ciezka', nazwa: 'ciężka' },
      { kolumny: 2, rzedy: 1, id: 'lekka', nazwa: 'lekka' },
    ],
  },
  {
    id: 'ekwipunek',
    nazwa: 'Ekwipunek',
    ikona: '🎒',
    warianty: [
      { szablonId: 'mausritter-przedmiot', nazwa: 'Przedmiot' },
      { szablonId: 'mausritter-sakiewka', nazwa: 'Sakiewka' },
    ],
    rozmiary: [
      { kolumny: 1, rzedy: 1 },
      { kolumny: 2, rzedy: 1 },
      { kolumny: 1, rzedy: 2 },
    ],
  },
  {
    id: 'zaklecie',
    nazwa: 'Zaklęcie',
    ikona: '★',
    warianty: [{ szablonId: 'mausritter-zaklecie', nazwa: 'Zaklęcie' }],
    rozmiary: [{ kolumny: 1, rzedy: 1 }],
  },
  {
    id: 'stan',
    nazwa: 'Stan',
    ikona: '✚',
    warianty: [{ szablonId: 'mausritter-stan', nazwa: 'Stan' }],
    rozmiary: [{ kolumny: 1, rzedy: 1 }],
  },
  {
    id: 'pusta',
    nazwa: 'Pusta karta',
    ikona: '▢',
    warianty: [{ szablonId: 'mausritter-pusta', nazwa: 'Pusta karta' }],
    rozmiary: [
      { kolumny: 1, rzedy: 1 },
      { kolumny: 2, rzedy: 1 },
      { kolumny: 1, rzedy: 2 },
      { kolumny: 2, rzedy: 2 },
    ],
  },
];

export const gotoweUkladyMausrittera: GotowyUklad[] = [
  { id: 'bron', nazwa: 'Broń i pancerze', arkusze: ['mausritter-arkusz-bron'] },
  { id: 'wyposazenie', nazwa: 'Wyposażenie', arkusze: ['mausritter-arkusz-wyposazenie'] },
  { id: 'stany', nazwa: 'Stany', arkusze: ['mausritter-arkusz-stany'] },
  {
    id: 'wszystkie',
    nazwa: 'Wszystkie trzy',
    arkusze: ['mausritter-arkusz-bron', 'mausritter-arkusz-wyposazenie', 'mausritter-arkusz-stany'],
  },
];
