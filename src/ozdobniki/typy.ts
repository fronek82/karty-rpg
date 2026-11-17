import type { KonturSymbolu } from '../silnik/scena';

/**
 * Element biblioteki ozdobników (SPEC 5). Wbudowane mają identyfikator `wb:…` i żyją w kodzie
 * (`katalog.ts`); własne (z projektu) dojdą w kolejnych etapach M2b.
 */
export type RodzajElementu = 'motyw' | 'naroznik' | 'zakonczenie' | 'srodek' | 'ksztalt' | 'ramka9';

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
}
