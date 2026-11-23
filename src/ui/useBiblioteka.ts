import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import {
  elementZWpisu,
  type RodzajWpisuBiblioteki,
  type WpisBiblioteki,
} from '../dane/bibliotekaUzytkownika';
import { czyWbudowany, ELEMENTY_WBUDOWANE } from '../ozdobniki/katalog';
import type { ElementOzdobny } from '../ozdobniki';
import { baza } from './bazaUI';

/** Ostatnio odczytane listy (wspólne dla komponentów – kolejne montowanie startuje z danymi). */
const pamiec = new Map<RodzajWpisuBiblioteki, WpisBiblioteki[]>();

/**
 * Wpisy biblioteki użytkownika danego rodzaju (bez bajtów), na żywo (`liveQuery` – zmiany z innych
 * kart i ze strony Biblioteki). `undefined` – jeszcze wczytywane.
 */
export function useBiblioteka(rodzaj: RodzajWpisuBiblioteki): WpisBiblioteki[] | undefined {
  const [wpisy, ustawWpisy] = useState(() => pamiec.get(rodzaj));
  useEffect(() => {
    const sub = liveQuery(() => baza().wpisyBiblioteki(rodzaj)).subscribe({
      next: (lista) => {
        pamiec.set(rodzaj, lista);
        ustawWpisy(lista);
      },
      error: (e: unknown) => console.warn('Biblioteka: odczyt nie powiódł się', e),
    });
    return () => sub.unsubscribe();
  }, [rodzaj]);
  return wpisy;
}

/** Elementy ozdobne do wyborów: systemowe (wbudowane) i z biblioteki użytkownika (na żywo). */
export function useElementyOzdobne(): {
  systemowe: readonly ElementOzdobny[];
  wlasne: ElementOzdobny[];
} {
  const wpisy = useBiblioteka('ozdobnik');
  const wlasne = useMemo(
    () => (wpisy ?? []).flatMap((w) => (w.element ? [elementZWpisu(w)!] : [])),
    [wpisy],
  );
  return { systemowe: ELEMENTY_WBUDOWANE, wlasne };
}

/** Elementy podzielone na grupy wyboru: „Systemowe” i „Moja biblioteka”. */
export function grupyElementow(elementy: readonly ElementOzdobny[]): {
  systemowe: ElementOzdobny[];
  wlasne: ElementOzdobny[];
} {
  return {
    systemowe: elementy.filter((e) => czyWbudowany(e.id)),
    wlasne: elementy.filter((e) => !czyWbudowany(e.id)),
  };
}

/**
 * Elementy widoku projektu uzupełnione o elementy biblioteki dodane po otwarciu projektu
 * (biblioteka wygrywa – zmiany na stronie Biblioteki widać od razu).
 */
export function polaczElementy(
  zWidoku: readonly ElementOzdobny[],
  zBiblioteki: readonly ElementOzdobny[],
): ElementOzdobny[] {
  if (zBiblioteki.length === 0) return [...zWidoku];
  const ids = new Set(zBiblioteki.map((e) => e.id));
  return [...zWidoku.filter((e) => !ids.has(e.id)), ...zBiblioteki];
}
