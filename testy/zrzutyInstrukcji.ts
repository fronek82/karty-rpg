/** Wspólne stałe zrzutów ekranu do instrukcji (generator i test obecności korzystają z tego samego pliku). */

export const JEZYKI_ZRZUTOW = ['pl', 'en'] as const;
export type JezykZrzutu = (typeof JEZYKI_ZRZUTOW)[number];

/** Nazwy plików (bez rozszerzenia) w `public/instrukcja-zrzuty/<język>/`. */
export const NAZWY_ZRZUTOW = [
  'start',
  'mausritter',
  'edytor-kartki',
  'edytor-szablonu',
  'ustawienia',
] as const;

/** Rozmiar okna przeglądarki, a więc i zrzutu (deviceScaleFactor 1). */
export const ROZMIAR_ZRZUTU = { width: 1440, height: 900 } as const;

/** Najwyżej tyle bajtów na jeden plik PNG (repozytorium ma zostać lekkie). */
export const MAKS_BAJTOW_ZRZUTU = 250 * 1024;

export const KATALOG_ZRZUTOW = 'public/instrukcja-zrzuty';

export const sciezkaZrzutu = (jezyk: JezykZrzutu, nazwa: string) =>
  `${KATALOG_ZRZUTOW}/${jezyk}/${nazwa}.png`;
