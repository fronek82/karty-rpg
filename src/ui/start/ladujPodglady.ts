import { useEffect } from 'react';
import { jezyk, type Jezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import type { Pakiet } from '../../pakiety/typy';
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
 * Podglądy ekranu gry z pakietu: silnik i fontkit (`podglady.ts`) ładują się leniwie, a harmonogram,
 * pamięć i subskrypcje są wspólne z ekranem własnych kart (`pamiecPodgladow.ts`).
 */

export type { WynikPodgladu };
export { znacznikKoniec, znacznikStart } from './pamiecPodgladow';

const zasobyPakietow = new Map<string, Promise<unknown>>();

/** Kroki liczenia podglądów pakietu (zasoby pakietu pobierane raz). */
function przygotuj(pakiet: Pakiet) {
  return async () => {
    const modul = await import('./podglady');
    let zasoby = zasobyPakietow.get(pakiet.id) as
      Promise<Awaited<ReturnType<typeof modul.wczytajZasobyPakietu>>> | undefined;
    if (!zasoby) {
      zasoby = modul.wczytajZasobyPakietu(pakiet, adresCzcionki, pobierzBajty);
      zasobyPakietow.set(pakiet.id, zasoby);
      // Nieudane wczytanie nie zostaje w pamięci – następna próba pobierze pliki od nowa.
      zasoby.catch(() => zasobyPakietow.delete(pakiet.id));
    }
    const { projekt, zasoby: zasobyProjektu } = await zasoby;
    return modul.krokiPodgladow(pakiet, modul.lokalizowanyProjekt(projekt, pakiet), zasobyProjektu);
  };
}

/** Zaczyna liczyć podglądy pakietu w danym języku (raz; kolejne wywołania czekają na to samo). */
export function uruchomPodglady(pakiet: Pakiet, j: Jezyk = jezyk()): Promise<void> {
  return uruchomLiczenie(pakiet.id, j, przygotuj(pakiet));
}

/** „Spróbuj ponownie” po błędzie wczytania. */
export function ponowPodglady(pakiet: Pakiet, j: Jezyk = jezyk()): Promise<void> {
  return ponowLiczenie(pakiet.id, j, przygotuj(pakiet));
}

/** Wynik z pamięci (undefined – jeszcze się liczy). */
export function wynikPodgladu(pakietId: string, j: Jezyk, id: string): WynikPodgladu | undefined {
  return wynikZPamieci(pakietId, j, id);
}

export function bladLadowania(pakietId: string, j: Jezyk): string | undefined {
  return bladZPamieci(pakietId, j);
}

/** Hook: uruchamia liczenie podglądów pakietu (bez subskrypcji wyników – robią to kafelki). */
export function useUruchomPodglady(pakiet: Pakiet | undefined) {
  const j = useJezyk();
  useEffect(() => {
    if (pakiet) void uruchomPodglady(pakiet, j);
  }, [pakiet, j]);
}

/** Hook: wynik jednego podglądu; odświeża tylko komponent, który go używa. */
export const useWynikPodgladu = useWynikZrodla;

/** Hook: komunikat o błędzie wczytania zasobów podglądów. */
export const useBladLadowania = useBladZrodla;

/** Tylko do testów: czyści pamięć podglądów. */
export function wyczyscPodgladyDoTestow() {
  wyczyscPamiecPodgladow();
  zasobyPakietow.clear();
}
