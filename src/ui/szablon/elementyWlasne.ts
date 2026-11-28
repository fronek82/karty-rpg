import { createContext, useContext } from 'react';
import { ELEMENTY_WBUDOWANE, type ElementOzdobny, type RodzajElementu } from '../../ozdobniki';

/** Elementy ozdobne do wyborów (widok projektu + biblioteka użytkownika) i adres strony Biblioteki. */
export const ElementyWlasneKontekst = createContext<{
  elementy: readonly ElementOzdobny[];
  /** Adres zakładki „Ozdobniki” strony Biblioteki (z powrotem do edytora). */
  adresBiblioteki: string;
  /** Adres obrazu z zasobów projektu (miniatury ramek 9-slice z PNG). */
  adresObrazu?: (zasob: string) => string | undefined;
  /** Straż wyjścia edytora (niezapisane zmiany) dla linków do strony Biblioteki. */
  sprawdzWyjscie?: (e: import('react').MouseEvent, adres: string) => void;
}>({ elementy: [], adresBiblioteki: '#/' });

/** Obsługa kliknięcia linku do Biblioteki – pyta o niezapisane zmiany edytora. */
export const useWyjscieDoBiblioteki = () => {
  const { sprawdzWyjscie, adresBiblioteki } = useContext(ElementyWlasneKontekst);
  return (e: import('react').MouseEvent) => sprawdzWyjscie?.(e, adresBiblioteki);
};

export const useElementyWlasne = () => useContext(ElementyWlasneKontekst).elementy;
export const useAdresObrazu = () => useContext(ElementyWlasneKontekst).adresObrazu;
export const useAdresBiblioteki = () => useContext(ElementyWlasneKontekst).adresBiblioteki;

/** Elementy danego rodzaju do list wyboru: wbudowane, potem własne projektu. */
export function elementyRodzaju(
  rodzaj: RodzajElementu,
  wlasne: readonly ElementOzdobny[],
): ElementOzdobny[] {
  return [
    ...ELEMENTY_WBUDOWANE.filter((e) => e.rodzaj === rodzaj),
    ...wlasne.filter((e) => e.rodzaj === rodzaj),
  ];
}
