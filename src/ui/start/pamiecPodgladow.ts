import { useMemo, useSyncExternalStore } from 'react';
import { jezyk, type Jezyk } from '../../i18n';
import { useJezyk } from '../../i18n/react';
import type { KrokPodgladu, Podglad } from './podglady';

/**
 * Wspólna pamięć i harmonogram podglądów ekranów startowych (gra z pakietu, własne karty).
 * Podglądy liczą się po jednym z oddaniem wątku między krokami (interfejs nie zamarza), wyniki
 * zostają w pamięci modułu pod kluczem źródło+język+id – powrót na ekran pokazuje je od razu.
 * Subskrypcja jest osobna dla każdego podglądu, więc gotowy kafelek nie przerysowuje reszty ekranu.
 * Moduł nie importuje silnika (ładuje go dopiero źródło podglądów przez `import()`).
 */

export type WynikPodgladu = { podglad: Podglad } | { blad: string };

/**
 * Źródło podglądów przygotowuje (leniwie) listę kroków liczenia dla danego języka; `undefined`
 * oznacza przerwanie (język zmienił się w trakcie przygotowania, więc teksty byłyby w złym języku).
 */
export type PrzygotujKroki = () => Promise<KrokPodgladu[] | undefined>;

const wyniki = new Map<string, WynikPodgladu>();
/** Błąd wczytania zasobów (czcionki, obraz) – jeden na źródło i język. */
const bledyLadowania = new Map<string, string>();
const trwajace = new Map<string, Promise<void>>();
const sluchacze = new Map<string, Set<() => void>>();

const klucz = (zrodlo: string, j: Jezyk, id: string) => `${zrodlo}|${j}|${id}`;
const kluczLadowania = (zrodlo: string, j: Jezyk) => `${zrodlo}|${j}`;

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

/** Pobranie pliku jako bajty (czcionki i obrazy z katalogu aplikacji). */
export async function pobierzBajty(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

/** Adres pliku czcionki aplikacji (Vite dopisuje bazę, np. `/karty-rpg/`). */
export const adresCzcionki = (plik: string) => `${import.meta.env.BASE_URL}czcionki/${plik}`;

/** Znaczniki `performance.mark` – pomiar wydajności w testach e2e i w planie. */
export const znacznikStart = 'podglady-start';
export const znacznikKoniec = 'podglady-gotowe';

/** Liczy wszystkie kroki; zwraca false, gdy przerwano (zmiana języka w trakcie). */
async function licz(zrodlo: string, j: Jezyk, przygotuj: PrzygotujKroki): Promise<boolean> {
  performance.clearMarks(znacznikStart);
  performance.clearMarks(znacznikKoniec);
  performance.mark(znacznikStart);
  const kroki = await przygotuj();
  if (!kroki) return false;
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
    const k = klucz(zrodlo, j, krok.id);
    wyniki.set(k, wynik);
    powiadom(k);
  }
  performance.mark(znacznikKoniec);
  return true;
}

/** Zaczyna liczyć podglądy źródła w danym języku (raz; kolejne wywołania czekają na to samo). */
export function uruchomLiczenie(
  zrodlo: string,
  j: Jezyk,
  przygotuj: PrzygotujKroki,
): Promise<void> {
  const kl = kluczLadowania(zrodlo, j);
  let p = trwajace.get(kl);
  if (!p) {
    p = (async () => {
      let policzone = false;
      try {
        policzone = await licz(zrodlo, j, przygotuj);
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
export function ponowLiczenie(zrodlo: string, j: Jezyk, przygotuj: PrzygotujKroki): Promise<void> {
  bledyLadowania.delete(kluczLadowania(zrodlo, j));
  return uruchomLiczenie(zrodlo, j, przygotuj);
}

/** Wynik z pamięci (undefined – jeszcze się liczy). */
export function wynikZPamieci(zrodlo: string, j: Jezyk, id: string): WynikPodgladu | undefined {
  return wyniki.get(klucz(zrodlo, j, id));
}

export function bladZPamieci(zrodlo: string, j: Jezyk): string | undefined {
  return bledyLadowania.get(kluczLadowania(zrodlo, j));
}

/** Hook: wynik jednego podglądu; odświeża tylko komponent, który go używa. */
export function useWynikPodgladu(zrodlo: string | undefined, id: string) {
  const j = useJezyk();
  const k = zrodlo ? klucz(zrodlo, j, id) : '';
  return useSyncExternalStore(
    useMemo(() => subskrybuj(k), [k]),
    () => (zrodlo ? wyniki.get(k) : undefined),
    () => undefined,
  );
}

/** Hook: komunikat o błędzie wczytania zasobów podglądów. */
export function useBladLadowania(zrodlo: string | undefined) {
  const j = useJezyk();
  const k = zrodlo ? kluczLadowania(zrodlo, j) : '';
  return useSyncExternalStore(
    useMemo(() => subskrybuj(k), [k]),
    () => (zrodlo ? bledyLadowania.get(k) : undefined),
    () => undefined,
  );
}

/** Tylko do testów: czyści pamięć podglądów. */
export function wyczyscPamiecPodgladow() {
  wyniki.clear();
  bledyLadowania.clear();
  trwajace.clear();
}
