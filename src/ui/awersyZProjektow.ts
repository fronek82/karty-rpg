import { useEffect, useMemo, useState } from 'react';
import { eksportujSzablon, importujSzablon } from '../dane/archiwum';
import type { WpisAwersuZProjektu } from '../dane/baza';
import { kluczTresciSzablonu, type Szablon } from '../model/szablon';
import { baza } from './baza';

export const PRZEDROSTEK_AWERSU_INNEGO = '__inny_awers__:';

export const kluczAwersuZProjektu = (a: Pick<WpisAwersuZProjektu, 'projektId' | 'szablonId'>) =>
  `${a.projektId}:${a.szablonId}`;

export const etykietaAwersuZProjektu = (a: WpisAwersuZProjektu): string =>
  a.projektNazwa === a.szablonNazwa ? a.projektNazwa : `${a.projektNazwa} — ${a.szablonNazwa}`;

/**
 * Lista szablonów awersów dostępnych w innych projektach zapisanych w przeglądarce, bez
 * identycznych kopii i z pominięciem tych, których identyczna kopia jest już w bieżącym projekcie.
 * Szablony o tej samej nazwie, ale innej treści, zostają na liście.
 */
export function useAwersyZProjektow(
  projektId: string,
  szablonyWProjekcie: readonly Szablon[],
): WpisAwersuZProjektu[] {
  const [awersy, ustawAwersy] = useState<WpisAwersuZProjektu[]>([]);
  const podpisTresci = useMemo(
    () =>
      JSON.stringify(
        szablonyWProjekcie
          .filter((s) => s.korzen.dzieci.length > 0)
          .map(kluczTresciSzablonu)
          .sort(),
      ),
    [szablonyWProjekcie],
  );

  useEffect(() => {
    const tresciWProjekcie = new Set(JSON.parse(podpisTresci) as string[]);
    let aktywny = true;
    void baza()
      .szablonyAwersowZProjektow(projektId, tresciWProjekcie)
      .then((lista) => {
        if (aktywny) ustawAwersy(lista);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [projektId, podpisTresci]);

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
