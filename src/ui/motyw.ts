import { useSyncExternalStore } from 'react';
import { KLUCZ_MOTYWU } from '../wspolne/ustawienia';

export { KLUCZ_MOTYWU };

/** Wybór użytkownika: jawnie jasny lub ciemny albo zgodnie z ustawieniem systemu. */
export type PreferencjaMotywu = 'light' | 'dark' | 'system';
export type Motyw = 'light' | 'dark';

const ZAPYTANIE_CIEMNE = '(prefers-color-scheme: dark)';

/** Wybór z tej sesji strony, gdy zapis do localStorage się nie udał (np. tryb prywatny). */
let pamiecSesji: PreferencjaMotywu | undefined;

export function czyPreferencja(v: unknown): v is PreferencjaMotywu {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** Zapamiętany wybór; przy braku, błędnej wartości lub zablokowanym localStorage – „system”. */
export function odczytajPreferencje(): PreferencjaMotywu {
  if (pamiecSesji) return pamiecSesji;
  try {
    const v = window.localStorage.getItem(KLUCZ_MOTYWU);
    return czyPreferencja(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

function systemCiemny(): boolean {
  try {
    return window.matchMedia(ZAPYTANIE_CIEMNE).matches;
  } catch {
    return false;
  }
}

/** Motyw faktycznie użyty dla danego wyboru. */
export function motywDla(pref: PreferencjaMotywu, ciemnySystem: boolean): Motyw {
  if (pref === 'system') return ciemnySystem ? 'dark' : 'light';
  return pref;
}

/** Ustawia data-theme na <html>. */
export function zastosujMotyw(motyw: Motyw): void {
  document.documentElement.dataset.theme = motyw;
}

function migawka(): Motyw {
  return motywDla(odczytajPreferencje(), systemCiemny());
}

const sluchacze = new Set<() => void>();

function powiadom(): void {
  zastosujMotyw(migawka());
  sluchacze.forEach((s) => s());
}

/** Zapisuje wybór (best-effort) i od razu stosuje motyw. */
export function ustawPreferencje(pref: PreferencjaMotywu): void {
  pamiecSesji = undefined;
  try {
    window.localStorage.setItem(KLUCZ_MOTYWU, pref);
  } catch {
    pamiecSesji = pref;
  }
  powiadom();
}

let nasluchuje = false;

function nasluchujZmian(): void {
  if (nasluchuje) return;
  nasluchuje = true;
  try {
    window.matchMedia(ZAPYTANIE_CIEMNE).addEventListener('change', powiadom);
  } catch {
    // Brak matchMedia – zostaje motyw jasny.
  }
  // Zmiana wyboru w innej karcie przeglądarki.
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === KLUCZ_MOTYWU) powiadom();
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Zawsze przy starcie (skrypt w index.html robi to wcześniej; tu na wypadek jego braku).
  zastosujMotyw(migawka());
  nasluchujZmian();
}

function subskrybuj(cb: () => void): () => void {
  sluchacze.add(cb);
  return () => sluchacze.delete(cb);
}

/** Aktualny motyw i funkcja jego zmiany; odświeża się przy zmianie ustawienia systemu. */
export function useMotyw(): { motyw: Motyw; ustaw: (m: Motyw) => void } {
  const motyw = useSyncExternalStore(subskrybuj, migawka, () => 'light' as Motyw);
  return { motyw, ustaw: ustawPreferencje };
}
