/**
 * Jednostki. W całym modelu wymiary są w milimetrach (typ `Mm`), także rozmiary czcionek.
 * Konwersje na punkty typograficzne lub piksele robimy wyłącznie na granicy (UI, PDF).
 */
export type Mm = number;

/** Punktów typograficznych (1/72 cala) w jednym milimetrze. */
export const PT_NA_MM = 72 / 25.4;

/** Zamienia punkty typograficzne na milimetry – wygodne przy pisaniu szablonów („8 pt”). */
export function pt(wartosc: number): Mm {
  return wartosc / PT_NA_MM;
}

export function mmNaPt(wartosc: Mm): number {
  return wartosc * PT_NA_MM;
}
