import { useEffect, useState } from 'react';
import { eksportujSzablon, importujSzablon } from '../dane/archiwum';
import type { WpisAwersuZProjektu } from '../dane/baza';
import { baza } from './baza';

export const PRZEDROSTEK_AWERSU_INNEGO = '__inny_awers__:';

export const kluczAwersuZProjektu = (a: Pick<WpisAwersuZProjektu, 'projektId' | 'szablonId'>) =>
  `${a.projektId}:${a.szablonId}`;

export const etykietaAwersuZProjektu = (a: WpisAwersuZProjektu): string =>
  a.projektNazwa === a.szablonNazwa ? a.projektNazwa : `${a.projektNazwa} — ${a.szablonNazwa}`;

/** Lista szablonów awersów dostępnych w innych projektach zapisanych w przeglądarce. */
export function useAwersyZProjektow(
  projektId: string,
  liczbaSzablonow: number,
): WpisAwersuZProjektu[] {
  const [awersy, ustawAwersy] = useState<WpisAwersuZProjektu[]>([]);

  useEffect(() => {
    void liczbaSzablonow;
    let aktywny = true;
    void baza()
      .szablonyAwersowZProjektow(projektId)
      .then((lista) => {
        if (aktywny) ustawAwersy(lista);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [projektId, liczbaSzablonow]);

  return awersy;
}

/**
 * Wczytuje szablon awersu z innego projektu jako paczkę (z zasobami), odłączając jego rewers
 * jeszcze przed eksportem – dzięki temu nie przenosi nieużywanych zasobów rewersu ani nie
 * nadpisuje rewersów w bieżącym projekcie.
 */
export async function wczytajPaczkeAwersuBezRewersu(
  wpis: Pick<WpisAwersuZProjektu, 'projektId' | 'szablonId'>,
) {
  const { projekt: zrodlo, zasoby: zrodloZasoby } = await baza().wczytaj(wpis.projektId);
  const zrodloBezRewersu = {
    ...zrodlo,
    szablony: zrodlo.szablony.map((s) => {
      if (s.id !== wpis.szablonId) return s;
      const bez = { ...s };
      delete bez.rewersId;
      return bez;
    }),
  };
  const paczka = importujSzablon(
    eksportujSzablon(zrodloBezRewersu, zrodloZasoby, wpis.szablonId).bajty,
  );
  const wynik = { ...paczka, szablon: { ...paczka.szablon } };
  delete wynik.rewers;
  delete wynik.szablon.rewersId;
  return wynik;
}
