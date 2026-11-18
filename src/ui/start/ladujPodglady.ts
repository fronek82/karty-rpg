import { useEffect, useSyncExternalStore } from 'react';
import { jezyk, type Jezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import type { Pakiet } from '../../pakiety/typy';
import { ID_PUSTEJ } from './idPodgladow';
import type { Podglad } from './podglady';

/**
 * Harmonogram i pamięć podglądów ekranu gry. Silnik i fontkit (`podglady.ts`) ładują się
 * leniwie, podglądy liczą się po jednym z oddaniem wątku między krokami (interfejs nie zamarza),
 * a wyniki zostają w pamięci modułu – powrót na ekran pokazuje je od razu.
 */

export type WynikPodgladu = { podglad: Podglad } | { blad: string };

const wyniki = new Map<string, WynikPodgladu>();
const trwajace = new Map<string, Promise<void>>();
const zasobyPakietow = new Map<string, Promise<unknown>>();
const sluchacze = new Set<() => void>();
let wersja = 0;

const klucz = (pakietId: string, j: Jezyk, id: string) => `${pakietId}|${j}|${id}`;

function powiadom() {
  wersja++;
  for (const s of [...sluchacze]) s();
}

function subskrybuj(cb: () => void) {
  sluchacze.add(cb);
  return () => void sluchacze.delete(cb);
}

/** Oddaje wątek przeglądarce (wejście użytkownika, malowanie) przed następnym krokiem. */
const oddajWatek = () => new Promise<void>((r) => setTimeout(r, 0));

async function pobierz(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

/** Czasy ostatniego liczenia (ms od początku) – pomiar wydajności w testach e2e i w planie. */
export const znacznikStart = 'podglady-start';
export const znacznikKoniec = 'podglady-gotowe';

async function licz(pakiet: Pakiet, j: Jezyk): Promise<void> {
  performance.mark(znacznikStart);
  const modul = await import('./podglady');
  let zasoby = zasobyPakietow.get(pakiet.id) as
    Promise<Awaited<ReturnType<typeof modul.wczytajZasobyPakietu>>> | undefined;
  if (!zasoby) {
    zasoby = modul.wczytajZasobyPakietu(
      pakiet,
      (plik) => `${import.meta.env.BASE_URL}czcionki/${plik}`,
      pobierz,
    );
    zasobyPakietow.set(pakiet.id, zasoby);
    // Nieudane wczytanie nie zostaje w pamięci – następne wejście spróbuje ponownie.
    zasoby.catch(() => zasobyPakietow.delete(pakiet.id));
  }
  const { projekt, zasoby: zasobyProjektu } = await zasoby;
  const kroki = modul.krokiPodgladow(
    pakiet,
    modul.lokalizowanyProjekt(projekt, pakiet),
    zasobyProjektu,
  );
  for (const krok of kroki) {
    await oddajWatek();
    // Język zmieniony w trakcie – tych wyników nikt już nie czeka (nowe liczenie ruszy samo).
    if (jezyk() !== j) return;
    let wynik: WynikPodgladu;
    try {
      wynik = { podglad: krok.licz() };
    } catch (e) {
      wynik = { blad: e instanceof Error ? e.message : String(e) };
    }
    wyniki.set(klucz(pakiet.id, j, krok.id), wynik);
    powiadom();
  }
  performance.mark(znacznikKoniec);
}

/** Zaczyna liczyć podglądy pakietu w danym języku (raz; kolejne wywołania czekają na to samo). */
export function uruchomPodglady(pakiet: Pakiet, j: Jezyk = jezyk()): Promise<void> {
  const k = `${pakiet.id}|${j}`;
  let p = trwajace.get(k);
  if (!p) {
    p = licz(pakiet, j).catch((e: unknown) => {
      // Błąd wczytania zasobów – każdy podgląd pokaże komunikat; ponowna próba po powrocie.
      const blad = e instanceof Error ? e.message : String(e);
      for (const id of [ID_PUSTEJ, ...pakiet.gotoweUklady.map((u) => u.id)])
        wyniki.set(klucz(pakiet.id, j, id), { blad });
      trwajace.delete(k);
      powiadom();
    });
    trwajace.set(k, p);
  }
  return p;
}

/** Wynik z pamięci (undefined – jeszcze się liczy). */
export function wynikPodgladu(pakietId: string, j: Jezyk, id: string): WynikPodgladu | undefined {
  return wyniki.get(klucz(pakietId, j, id));
}

/** Hook: uruchamia liczenie i odświeża komponent w miarę gotowości podglądów. */
export function usePodglady(pakiet: Pakiet | undefined) {
  const j = useJezyk();
  useSyncExternalStore(subskrybuj, () => wersja);
  useEffect(() => {
    if (pakiet) void uruchomPodglady(pakiet, j);
  }, [pakiet, j]);
  return (id: string) => (pakiet ? wynikPodgladu(pakiet.id, j, id) : undefined);
}

/** Tylko do testów: czyści pamięć podglądów. */
export function wyczyscPodgladyDoTestow() {
  wyniki.clear();
  trwajace.clear();
  zasobyPakietow.clear();
  wersja++;
}
