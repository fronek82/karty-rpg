import type { Mm } from '../model/jednostki';
import type { Kontur, KonturSymbolu } from '../silnik/scena';
import { okrag, wielokat } from './rysunek';
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

const kreska = (kontur: Kontur): KonturSymbolu => ({
  kontur,
  obrys: { kolor: 'kolor', grubosc: 0.25 },
});

/** W miniaturze i polu grafiki pokazujemy obrys i detale jako kolorowalny rysunek. */
export function konturyOzdobnika(e: ElementOzdobny): KonturSymbolu[] {
  if (!e.zdobienia) return e.kontury;
  return [
    ...e.kontury.map(({ kontur }): KonturSymbolu => ({
      kontur,
      obrys: { kolor: 'kolor', grubosc: 0.28 },
    })),
    ...e.zdobienia,
  ];
}

export const KSZTALTY_WBUDOWANE: ElementOzdobny[] = [
  {
    id: 'wb:tabliczka',
    rodzaj: 'ksztalt',
    szer: 40,
    wys: 12,
    kontury: [
      {
        kontur: [
          ['M', 0, 6],
          ['L', 4, 2.5],
          ['L', 7, 2.5],
          ['L', 7, 0],
          ['L', 33, 0],
          ['L', 33, 2.5],
          ['L', 36, 2.5],
          ['L', 40, 6],
          ['L', 36, 9.5],
          ['L', 33, 9.5],
          ['L', 33, 12],
          ['L', 7, 12],
          ['L', 7, 9.5],
          ['L', 4, 9.5],
          ['Z'],
        ],
        wypelnienie: 'kolor',
      },
    ],
    zdobienia: [
      kreska([
        ['M', 8.3, 1.3],
        ['L', 31.7, 1.3],
        ['M', 8.3, 10.7],
        ['L', 31.7, 10.7],
      ]),
    ],
    tresc: { x: 0.2, y: 0.13, szer: 0.6, wys: 0.74 },
  },
  {
    id: 'wb:pieczec',
    rodzaj: 'ksztalt',
    szer: 12,
    wys: 12,
    kontury: [
      {
        kontur: [
          ['M', 3, 0],
          ['L', 9, 0],
          ['L', 12, 3],
          ['L', 12, 9],
          ['L', 9, 12],
          ['L', 3, 12],
          ['L', 0, 9],
          ['L', 0, 3],
          ['Z'],
        ],
        wypelnienie: 'kolor',
      },
    ],
    zdobienia: [
      kreska(
        wielokat(
          [3.5, 1.1],
          [8.5, 1.1],
          [10.9, 3.5],
          [10.9, 8.5],
          [8.5, 10.9],
          [3.5, 10.9],
          [1.1, 8.5],
          [1.1, 3.5],
        ),
      ),
      kreska(okrag(2.05, 6, 0.46)),
      kreska(okrag(9.95, 6, 0.46)),
    ],
    tresc: { x: 0.25, y: 0.18, szer: 0.5, wys: 0.64 },
  },
];
