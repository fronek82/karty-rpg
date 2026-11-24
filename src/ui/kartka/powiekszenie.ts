/**
 * Powiększenie kartek w Edytorze kart: stałe stopnie (1 = kartka na szerokość kolumny),
 * przejścia „bliżej / dalej” i odczyt z localStorage.
 */
import { KLUCZ_POWIEKSZENIA_KARTKI } from '../../wspolne/ustawienia';

export const STOPNIE_POWIEKSZENIA = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4] as const;
export const MIN_POWIEKSZENIA = STOPNIE_POWIEKSZENIA[0];
export const MAX_POWIEKSZENIA = STOPNIE_POWIEKSZENIA[STOPNIE_POWIEKSZENIA.length - 1]!;

/** Następny stopień w kierunku `kierunek` (1 – bliżej, -1 – dalej); na krańcach bez zmian. */
export function kolejnePowiekszenie(obecne: number, kierunek: 1 | -1): number {
  if (kierunek > 0) return STOPNIE_POWIEKSZENIA.find((s) => s > obecne + 1e-6) ?? MAX_POWIEKSZENIA;
  return [...STOPNIE_POWIEKSZENIA].reverse().find((s) => s < obecne - 1e-6) ?? MIN_POWIEKSZENIA;
}

/** Wartość z localStorage przycięta do zakresu; błędna lub brak – 1. */
export function wczytajPowiekszenie(): number {
  try {
    const v = Number(localStorage.getItem(KLUCZ_POWIEKSZENIA_KARTKI));
    return Number.isFinite(v) && v > 0
      ? Math.min(MAX_POWIEKSZENIA, Math.max(MIN_POWIEKSZENIA, v))
      : 1;
  } catch {
    return 1;
  }
}

export function zapiszPowiekszenie(v: number) {
  try {
    localStorage.setItem(KLUCZ_POWIEKSZENIA_KARTKI, String(v));
  } catch {
    // Brak dostępu do localStorage – powiększenie tylko do końca sesji.
  }
}
