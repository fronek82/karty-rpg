import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { jezyk, type Jezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import type { Pakiet } from '../../pakiety/typy';
import type { Podglad } from './podglady';

/**
 * Harmonogram i pamięć podglądów ekranu gry. Silnik i fontkit (`podglady.ts`) ładują się
 * leniwie, podglądy liczą się po jednym z oddaniem wątku między krokami (interfejs nie zamarza),
 * a wyniki zostają w pamięci modułu – powrót na ekran pokazuje je od razu. Subskrypcja jest
 * osobna dla każdego podglądu, więc gotowy kafelek nie przerysowuje reszty ekranu.
 */

export type WynikPodgladu = { podglad: Podglad } | { blad: string };

const wyniki = new Map<string, WynikPodgladu>();
/** Błąd wczytania zasobów (czcionki, obraz) – jeden na pakiet i język. */
const bledyLadowania = new Map<string, string>();
const trwajace = new Map<string, Promise<void>>();
const zasobyPakietow = new Map<string, Promise<unknown>>();
const sluchacze = new Map<string, Set<() => void>>();

const klucz = (pakietId: string, j: Jezyk, id: string) => `${pakietId}|${j}|${id}`;
const kluczLadowania = (pakietId: string, j: Jezyk) => `${pakietId}|${j}`;

function powiadom(k: string) {
  for (const s of [...(sluchacze.get(k) ?? [])]) s();
}

function subskrybuj(k: string) {
  return (cb: () => void) => {
    let zbior = sluchacze.get(k);
    if (!zbior) sluchacze.set(k, (zbior = new Set()));
    zbior.add(cb);
    return () => void zbior.delete(cb);
  };
}

/** Oddaje wątek przeglądarce (wejście użytkownika, malowanie) przed następnym krokiem. */
const oddajWatek = () => new Promise<void>((r) => setTimeout(r, 0));

async function pobierz(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

/** Znaczniki `performance.mark` – pomiar wydajności w testach e2e i w planie. */
export const znacznikStart = 'podglady-start';
export const znacznikKoniec = 'podglady-gotowe';

/** Liczy wszystkie kroki; zwraca false, gdy przerwano (zmiana języka w trakcie). */
async function licz(pakiet: Pakiet, j: Jezyk): Promise<boolean> {
  performance.clearMarks(znacznikStart);
  performance.clearMarks(znacznikKoniec);
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
    // Nieudane wczytanie nie zostaje w pamięci – następna próba pobierze pliki od nowa.
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
    // Język zmieniony w trakcie – tych wyników nikt już nie czeka (po powrocie liczą się od nowa).
    if (jezyk() !== j) return false;
    let wynik: WynikPodgladu;
    try {
      wynik = { podglad: krok.licz() };
    } catch (e) {
      wynik = { blad: e instanceof Error ? e.message : String(e) };
    }
    const k = klucz(pakiet.id, j, krok.id);
    wyniki.set(k, wynik);
    powiadom(k);
  }
  performance.mark(znacznikKoniec);
  return true;
}

/** Zaczyna liczyć podglądy pakietu w danym języku (raz; kolejne wywołania czekają na to samo). */
export function uruchomPodglady(pakiet: Pakiet, j: Jezyk = jezyk()): Promise<void> {
  const kl = kluczLadowania(pakiet.id, j);
  let p = trwajace.get(kl);
  if (!p) {
    p = (async () => {
      let policzone = false;
      try {
        policzone = await licz(pakiet, j);
      } catch (e) {
        bledyLadowania.set(kl, e instanceof Error ? e.message : String(e));
        powiadom(kl);
      } finally {
        // Przerwane lub nieudane liczenie nie zostawia wiszącej obietnicy – następne wejście
        // (powrót do języka, „Spróbuj ponownie”) liczy od nowa.
        if (!policzone) trwajace.delete(kl);
      }
    })();
    bledyLadowania.delete(kl);
    powiadom(kl);
    trwajace.set(kl, p);
  }
  return p;
}

/** „Spróbuj ponownie” po błędzie wczytania. */
export function ponowPodglady(pakiet: Pakiet, j: Jezyk = jezyk()): Promise<void> {
  bledyLadowania.delete(kluczLadowania(pakiet.id, j));
  return uruchomPodglady(pakiet, j);
}

/** Wynik z pamięci (undefined – jeszcze się liczy). */
export function wynikPodgladu(pakietId: string, j: Jezyk, id: string): WynikPodgladu | undefined {
  return wyniki.get(klucz(pakietId, j, id));
}

export function bladLadowania(pakietId: string, j: Jezyk): string | undefined {
  return bledyLadowania.get(kluczLadowania(pakietId, j));
}

/** Hook: uruchamia liczenie podglądów pakietu (bez subskrypcji wyników – robią to kafelki). */
export function useUruchomPodglady(pakiet: Pakiet | undefined) {
  const j = useJezyk();
  useEffect(() => {
    if (pakiet) void uruchomPodglady(pakiet, j);
  }, [pakiet, j]);
}

/** Hook: wynik jednego podglądu; odświeża tylko komponent, który go używa. */
export function useWynikPodgladu(pakietId: string | undefined, id: string) {
  const j = useJezyk();
  const k = pakietId ? klucz(pakietId, j, id) : '';
  return useSyncExternalStore(
    useMemo(() => subskrybuj(k), [k]),
    () => (pakietId ? wyniki.get(k) : undefined),
    () => undefined,
  );
}

/** Hook: komunikat o błędzie wczytania zasobów podglądów. */
export function useBladLadowania(pakietId: string | undefined) {
  const j = useJezyk();
  const k = pakietId ? kluczLadowania(pakietId, j) : '';
  return useSyncExternalStore(
    useMemo(() => subskrybuj(k), [k]),
    () => (pakietId ? bledyLadowania.get(k) : undefined),
    () => undefined,
  );
}

/** Tylko do testów: czyści pamięć podglądów. */
export function wyczyscPodgladyDoTestow() {
  wyniki.clear();
  bledyLadowania.clear();
  trwajace.clear();
  zasobyPakietow.clear();
}
