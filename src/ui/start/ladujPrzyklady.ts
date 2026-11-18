import { useEffect } from 'react';
import { jezyk, type Jezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import { KAFELKI_SZABLONOW } from '../../przyklady';
import {
  adresCzcionki,
  bladZPamieci,
  pobierzBajty,
  ponowLiczenie,
  uruchomLiczenie,
  useBladLadowania as useBladZrodla,
  useWynikPodgladu as useWynikZrodla,
  wyczyscPamiecPodgladow,
  wynikZPamieci,
  type WynikPodgladu,
} from './pamiecPodgladow';

/**
 * Podglądy przykładowych szablonów (ekran „Stwórz własne karty”): ta sama pamięć, harmonogram
 * i szkielety co podglądy gry. Moduły przykładów i silnik ładują się leniwie przy pierwszym
 * liczeniu; wyniki zostają w pamięci pod źródłem „przyklady” i językiem.
 */

export const ZRODLO_PRZYKLADOW = 'przyklady';

let czcionki: Promise<unknown> | undefined;

/** Kroki liczenia podglądów (czcionki pobierane raz; nieudane pobranie nie zostaje w pamięci). */
async function przygotuj(j: Jezyk) {
  const modul = await import('./podgladyPrzykladow');
  if (!czcionki) {
    czcionki = modul.wczytajCzcionkiPrzykladow(adresCzcionki, pobierzBajty);
    czcionki.catch(() => (czcionki = undefined));
  }
  const zasoby = (await czcionki) as Awaited<ReturnType<typeof modul.wczytajCzcionkiPrzykladow>>;
  const przyklady = await Promise.all(
    KAFELKI_SZABLONOW.map(async (o) => ({ id: o.id, przyklad: await o.laduj() })),
  );
  // Język zmieniony w trakcie ładowania: teksty przykładów powstały w innym języku niż klucz
  // wyniku – przerywamy, wynik nie trafia pod zły klucz (po powrocie liczy się od nowa).
  if (jezyk() !== j) return undefined;
  return modul.krokiPrzykladow(przyklady, zasoby);
}

/** Zaczyna liczyć podglądy w danym języku (raz; kolejne wywołania czekają na to samo). */
export function uruchomPodgladyPrzykladow(j: Jezyk = jezyk()): Promise<void> {
  return uruchomLiczenie(ZRODLO_PRZYKLADOW, j, () => przygotuj(j));
}

/** „Spróbuj ponownie” po błędzie wczytania. */
export function ponowPodgladyPrzykladow(j: Jezyk = jezyk()): Promise<void> {
  return ponowLiczenie(ZRODLO_PRZYKLADOW, j, () => przygotuj(j));
}

export function wynikPrzykladu(j: Jezyk, id: string): WynikPodgladu | undefined {
  return wynikZPamieci(ZRODLO_PRZYKLADOW, j, id);
}

export function bladPodgladowPrzykladow(j: Jezyk): string | undefined {
  return bladZPamieci(ZRODLO_PRZYKLADOW, j);
}

/** Hook: uruchamia liczenie (po zmianie języka – od nowa). */
export function useUruchomPodgladyPrzykladow() {
  const j = useJezyk();
  useEffect(() => {
    void uruchomPodgladyPrzykladow(j);
  }, [j]);
}

/** Hook: wynik jednego podglądu; odświeża tylko komponent, który go używa. */
export const useWynikPrzykladu = (id: string) => useWynikZrodla(ZRODLO_PRZYKLADOW, id);

/** Hook: komunikat o błędzie wczytania zasobów podglądów. */
export const useBladPodgladowPrzykladow = () => useBladZrodla(ZRODLO_PRZYKLADOW);

/** Tylko do testów: czyści pamięć wyników i zapomina pobrane czcionki. */
export function wyczyscPodgladyPrzykladowDoTestow() {
  wyczyscPamiecPodgladow();
  czcionki = undefined;
}
