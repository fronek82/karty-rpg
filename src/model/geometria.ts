/**
 * Wspólna geometria i liczby: prostokąty (w mm albo w innych jednostkach – byle spójnie)
 * i zaokrąglanie do zadanej liczby miejsc po przecinku.
 */

export interface Prostokat {
  x: number;
  y: number;
  szer: number;
  wys: number;
}

/** Tolerancja porównań współrzędnych. */
const EPS = 1e-6;

/**
 * Czy prostokąty mają wspólne wnętrze (styk krawędzi się nie liczy). Prostokąt o zerowej
 * szerokości lub wysokości nie przecina niczego.
 */
export const przecinajaSie = (a: Prostokat, b: Prostokat): boolean =>
  a.szer > EPS &&
  a.wys > EPS &&
  b.szer > EPS &&
  b.wys > EPS &&
  a.x + a.szer > b.x + EPS &&
  b.x + b.szer > a.x + EPS &&
  a.y + a.wys > b.y + EPS &&
  b.y + b.wys > a.y + EPS;

/** Zaokrągla do `miejsca` cyfr po przecinku (domyślnie 2). */
export const zaokraglij = (v: number, miejsca = 2): number => {
  const k = 10 ** miejsca;
  return Math.round(v * k) / k;
};
