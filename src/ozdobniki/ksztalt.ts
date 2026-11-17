import type { Mm } from '../model/jednostki';
import type { Kontur } from '../silnik/scena';
import type { ElementOzdobny } from './typy';

/** Domyślny prostokąt na tekst we własnym kształcie: 15 % marginesu z każdej strony. */
export const TRESC_DOMYSLNA = { x: 0.15, y: 0.15, szer: 0.7, wys: 0.7 };

/** Prostokąt treści własnego kształtu (ułamki rysunku). */
export function wnetrzeWlasnegoKsztaltu(e: Pick<ElementOzdobny, 'tresc'>) {
  return e.tresc ?? TRESC_DOMYSLNA;
}

/**
 * Kontur własnego kształtu wartości dopasowany do prostokąta `r` (rozciągnięty jak romb czy tarcza),
 * przesunięty do środka o `wciecie` (np. pół grubości linii obramowania). Wszystkie części rysunku
 * łączone w jeden kontur – tło i obramowanie węzła używają jednej ścieżki.
 */
export function konturWlasnegoKsztaltu(
  e: Pick<ElementOzdobny, 'kontury' | 'szer' | 'wys'>,
  r: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  wciecie: Mm = 0,
): Kontur {
  const x0 = r.x + wciecie;
  const y0 = r.y + wciecie;
  const sx = Math.max(0, r.szer - 2 * wciecie) / e.szer;
  const sy = Math.max(0, r.wys - 2 * wciecie) / e.wys;
  const wynik: Kontur = [];
  for (const c of e.kontury)
    for (const k of c.kontur) {
      if (k[0] === 'Z') wynik.push(['Z']);
      else if (k[0] === 'C')
        wynik.push([
          'C',
          x0 + k[1] * sx,
          y0 + k[2] * sy,
          x0 + k[3] * sx,
          y0 + k[4] * sy,
          x0 + k[5] * sx,
          y0 + k[6] * sy,
        ]);
      else wynik.push([k[0], x0 + k[1] * sx, y0 + k[2] * sy]);
    }
  return wynik;
}
