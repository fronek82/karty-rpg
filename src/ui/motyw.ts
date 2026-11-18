import { useSyncExternalStore } from 'react';

/** Wybór użytkownika: jawnie jasny lub ciemny albo zgodnie z ustawieniem systemu. */
export type PreferencjaMotywu = 'light' | 'dark' | 'system';
export type Motyw = 'light' | 'dark';

/** Klucz w localStorage (ten sam odczytuje skrypt w index.html i, później, instrukcja). */
export const KLUCZ_MOTYWU = 'karty.motyw';

const ZAPYTANIE_CIEMNE = '(prefers-color-scheme: dark)';

export function czyPreferencja(v: unknown): v is PreferencjaMotywu {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** Zapamiętany wybór; przy braku, błędnej wartości lub zablokowanym localStorage – „system”. */
export function odczytajPreferencje(): PreferencjaMotywu {
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

const sluchacze = new Set<() => void>();
let obserwujeSystem = false;

function powiadom(): void {
  zastosujMotyw(migawka());
  sluchacze.forEach((s) => s());
}

/** Zapisuje wybór (best-effort) i od razu stosuje motyw. */
export function ustawPreferencje(pref: PreferencjaMotywu): void {
  try {
    window.localStorage.setItem(KLUCZ_MOTYWU, pref);
  } catch {
    // Tryb prywatny lub zablokowana pamięć: motyw działa do końca sesji strony.
    pamiecSesji = pref;
  }
  powiadom();
}

let pamiecSesji: PreferencjaMotywu | undefined;

function biezacaPreferencja(): PreferencjaMotywu {
  try {
    const v = window.localStorage.getItem(KLUCZ_MOTYWU);
    if (czyPreferencja(v)) return v;
  } catch {
    return pamiecSesji ?? 'system';
  }
  return 'system';
}

function subskrybuj(cb: () => void): () => void {
  sluchacze.add(cb);
  if (!obserwujeSystem) {
    obserwujeSystem = true;
    try {
      window.matchMedia(ZAPYTANIE_CIEMNE).addEventListener('change', powiadom);
    } catch {
      // Brak matchMedia – zostaje motyw jasny.
    }
  }
  return () => sluchacze.delete(cb);
}

function migawka(): Motyw {
  return motywDla(biezacaPreferencja(), systemCiemny());
}

/** Aktualny motyw i funkcja jego zmiany; odświeża się przy zmianie ustawienia systemu. */
export function useMotyw(): { motyw: Motyw; ustaw: (m: Motyw) => void } {
  const motyw = useSyncExternalStore(subskrybuj, migawka, () => 'light' as Motyw);
  return { motyw, ustaw: ustawPreferencje };
}
