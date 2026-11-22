import { useEffect, useMemo, useState } from 'react';
import { eksportujSzablon, importujSzablon } from '../dane/archiwum';
import type { WpisAwersuZProjektu } from '../dane/baza';
import type { Szablon } from '../model/szablon';
import { baza } from './baza';

export const PRZEDROSTEK_AWERSU_INNEGO = '__inny_awers__:';

export const normalizujNazweSzablonu = (nazwa: string): string => nazwa.trim().toLowerCase();

export const kluczAwersuZProjektu = (a: Pick<WpisAwersuZProjektu, 'projektId' | 'szablonId'>) =>
  `${a.projektId}:${a.szablonId}`;

export const etykietaAwersuZProjektu = (a: WpisAwersuZProjektu): string =>
  a.projektNazwa === a.szablonNazwa ? a.projektNazwa : `${a.projektNazwa} — ${a.szablonNazwa}`;

/**
 * Lista szablonów awersów dostępnych w innych projektach zapisanych w przeglądarce,
 * bez duplikatów po nazwie i z pominięciem nazw już obecnych w bieżącym projekcie.
 */
export function useAwersyZProjektow(
  projektId: string,
  szablonyWProjekcie: readonly Szablon[],
): WpisAwersuZProjektu[] {
  const [awersy, ustawAwersy] = useState<WpisAwersuZProjektu[]>([]);
  const podpisNazw = useMemo(
    () =>
      szablonyWProjekcie
        .filter((s) => s.korzen.dzieci.length > 0)
        .map((s) => normalizujNazweSzablonu(s.nazwa))
        .sort()
        .join('\0'),
    [szablonyWProjekcie],
  );

  useEffect(() => {
    const nazwyWProjekcie = new Set(podpisNazw ? podpisNazw.split('\0') : []);
    let aktywny = true;
    void baza()
      .szablonyAwersowZProjektow(projektId, nazwyWProjekcie)
      .then((lista) => {
        if (aktywny) ustawAwersy(lista);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [projektId, podpisNazw]);

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
