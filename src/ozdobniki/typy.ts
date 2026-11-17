import type { KonturSymbolu } from '../silnik/scena';

/**
 * Element biblioteki ozdobników (SPEC 5). Wbudowane mają identyfikator `wb:…` i żyją w kodzie
 * (`katalog.ts`, motywy w `motywy.ts`); własne (z projektu) dojdą w kolejnych etapach M2b.
 */
export type RodzajElementu = 'motyw' | 'naroznik' | 'zakonczenie' | 'srodek' | 'ksztalt' | 'ramka9';

/**
 * Ustawienia ramki 9-slice (element rodzaju `ramka9`). Wcięcia w jednostkach źródła: piksele PNG
 * albo jednostki rysunku SVG (`szer` × `wys` elementu) – wyznaczają cztery rogi, cztery boki i środek.
 */
export interface UstawieniaRamki9 {
  /** `obraz` – zasób PNG projektu (element nie ma konturów, `szer`/`wys` = piksele); `svg` – kontury elementu. */
  zrodlo: { typ: 'obraz'; zasob: string } | { typ: 'svg' };
  wciecia: { gora: number; prawo: number; dol: number; lewo: number };
  /** Boki: jeden rozciągnięty kawałek albo kawałki powtórzone równo (całkowita liczba, lekko rozciągnięte). */
  boki: 'rozciagnij' | 'powtarzaj';
  /** Środek: rozciągnięty na całe wnętrze albo pominięty (karta widoczna przez ramkę). */
  srodek: 'wypelnij' | 'pomin';
}

export interface ElementOzdobny {
  /** Wbudowane: `wb:pnacze`; własne: identyfikator zasobu. */
  id: string;
  /** Nazwa własnego elementu; wbudowane jej nie mają (nazwa z i18n po identyfikatorze). */
  nazwa?: string;
  rodzaj: RodzajElementu;
  /** Rysunek w jednostkach pola `szer` × `wys` (oś Y w dół), spłaszczony do M/L/C/Z. */
  szer: number;
  wys: number;
  /** Części rysunku; kolor `'kolor'` = kolorowalny (bierze kolor z ustawień ozdoby). */
  kontury: KonturSymbolu[];
  /**
   * Tylko motyw: kostka narożna – kwadrat `wys` × `wys` rysowany dla lewego górnego rogu
   * (zewnętrzne krawędzie przy górze i po lewej), odbijany na cztery rogi ramki.
   */
  kostka?: KonturSymbolu[];
  /**
   * Tylko własne (z biblioteki projektu): `jednolity` – wszystkie wypełnienia i obrysy mają kolor
   * z miejsca użycia (rysunek kolorowalny), `oryginal` – kolory z pliku. Kontury trzymają kolory
   * pliku (albo `'kolor'` dla `currentColor`), więc tryb można przełączać bez straty.
   */
  kolorowanie?: 'jednolity' | 'oryginal';
  /** Tylko rodzaj `ramka9`: źródło, wcięcia, boki i środek. */
  ramka9?: UstawieniaRamki9;
  /**
   * Tylko własny kształt wartości: prostokąt na tekst jako ułamki rysunku (x, y, szerokość,
   * wysokość w zakresie 0–1); domyślnie 15 % marginesu z każdej strony.
   */
  tresc?: { x: number; y: number; szer: number; wys: number };
}
