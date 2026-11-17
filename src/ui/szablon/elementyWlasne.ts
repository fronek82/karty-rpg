import { createContext, useContext } from 'react';
import {
  MOTYWY_WBUDOWANE,
  NAROZNIKI_WBUDOWANE,
  SRODKI_WBUDOWANE,
  ZAKONCZENIA_WBUDOWANE,
  type ElementOzdobny,
  type RodzajElementu,
} from '../../ozdobniki';

/** Własne elementy biblioteki ozdobników projektu – dostępne w panelach edytora szablonu. */
export const ElementyWlasneKontekst = createContext<{
  elementy: readonly ElementOzdobny[];
  /** Adres strony „Biblioteka ozdobników” projektu. */
  adresBiblioteki: string;
}>({ elementy: [], adresBiblioteki: '#/' });

export const useElementyWlasne = () => useContext(ElementyWlasneKontekst).elementy;
export const useAdresBiblioteki = () => useContext(ElementyWlasneKontekst).adresBiblioteki;

const WBUDOWANE: Partial<Record<RodzajElementu, ElementOzdobny[]>> = {
  naroznik: NAROZNIKI_WBUDOWANE,
  motyw: MOTYWY_WBUDOWANE,
  zakonczenie: ZAKONCZENIA_WBUDOWANE,
  srodek: SRODKI_WBUDOWANE,
};

/** Elementy danego rodzaju do list wyboru: wbudowane, potem własne projektu. */
export function elementyRodzaju(
  rodzaj: RodzajElementu,
  wlasne: readonly ElementOzdobny[],
): ElementOzdobny[] {
  return [...(WBUDOWANE[rodzaj] ?? []), ...wlasne.filter((e) => e.rodzaj === rodzaj)];
}
