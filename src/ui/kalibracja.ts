import type { Mm } from '../model/jednostki';

/** Kalibracja drukarki (przesunięcie wydruku) – cecha drukarki, więc w tej przeglądarce. */
const KLUCZ = 'karty-rpg:kalibracja';
const KLUCZ_REWERS = 'karty-rpg:kalibracja-rewers';
export const MAKS_PRZESUNIECIA: Mm = 20;

export interface Kalibracja {
  x: Mm;
  y: Mm;
}

const wGranicach = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAKS_PRZESUNIECIA ? v : 0;

function odczytaj(klucz: string): Kalibracja {
  try {
    const d = JSON.parse(localStorage.getItem(klucz) ?? '{}') as Partial<Kalibracja>;
    return { x: wGranicach(d.x), y: wGranicach(d.y) };
  } catch {
    return { x: 0, y: 0 };
  }
}

function zapisz(klucz: string, k: Kalibracja): void {
  try {
    localStorage.setItem(klucz, JSON.stringify(k));
  } catch {
    // Prywatne okno / zablokowany zapis – kalibracja działa do końca sesji strony.
  }
}

export function odczytajKalibracje(): Kalibracja {
  return odczytaj(KLUCZ);
}

export function zapiszKalibracje(k: Kalibracja): void {
  zapisz(KLUCZ, k);
}

/** Osobna lokalna korekta przesunięcia dla stron rewersów w druku dwustronnym (mm). */
export function odczytajKalibracjeRewersu(): Kalibracja {
  return odczytaj(KLUCZ_REWERS);
}

export function zapiszKalibracjeRewersu(k: Kalibracja): void {
  zapisz(KLUCZ_REWERS, k);
}
