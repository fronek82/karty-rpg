import type { Mm } from '../model/jednostki';

/** Kalibracja drukarki (przesunięcie wydruku) – cecha drukarki, więc w tej przeglądarce. */
const KLUCZ = 'karty-rpg:kalibracja';
export const MAKS_PRZESUNIECIA: Mm = 20;

export interface Kalibracja {
  x: Mm;
  y: Mm;
}

const wGranicach = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAKS_PRZESUNIECIA ? v : 0;

export function odczytajKalibracje(): Kalibracja {
  try {
    const d = JSON.parse(localStorage.getItem(KLUCZ) ?? '{}') as Partial<Kalibracja>;
    return { x: wGranicach(d.x), y: wGranicach(d.y) };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function zapiszKalibracje(k: Kalibracja): void {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify(k));
  } catch {
    // Prywatne okno / zablokowany zapis – kalibracja działa do końca sesji strony.
  }
}
