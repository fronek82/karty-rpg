import type { Kontur, KonturSymbolu } from '../silnik/scena';
import {
  elipsa,
  fragmentKrzywej,
  gwiazda,
  lisc,
  okrag,
  pierscien,
  prostokat,
  stadion,
} from './rysunek';
import type { ElementOzdobny } from './typy';

/**
 * Wbudowane motywy powtarzalne – rysunki własne (licencja projektu, patrz `LICENCJE.md`), ogólne,
 * bez wzorów z konkretnych gier. Kafelek ma wysokość `WYS` (pas; oś Y w dół, `y = 0` to zewnętrzna
 * krawędź ramki) i szerokość wzdłuż boku; sąsiednie kafelki łączą się bez szwu. Kostka narożna to
 * kwadrat `WYS` × `WYS` dla lewego górnego rogu.
 */
export const WYS_KAFELKA = 10;

const kreska = (kontur: Kontur, grubosc = 0.8): KonturSymbolu => ({
  kontur,
  obrys: { grubosc, kolor: 'kolor' },
});
const wyp = (kontur: Kontur): KonturSymbolu => ({ kontur, wypelnienie: 'kolor' });

/** Ramka kostki: cienki kwadrat z wypełnionym środkiem ozdoby w kolejnych elementach. */
const ramkaKostki = (): KonturSymbolu => kreska(prostokat(0.9, 0.9, 8.2, 8.2), 0.7);

function motyw(
  id: string,
  szer: number,
  kontury: KonturSymbolu[],
  kostka: KonturSymbolu[],
): ElementOzdobny {
  return { id, rodzaj: 'motyw', szer, wys: WYS_KAFELKA, kontury, kostka };
}

/** Pnącze: falująca łodyga z listkami na przemian z góry i z dołu. */
const PNACZE = motyw(
  'wb:pnacze',
  20,
  [
    kreska(
      [
        ['M', 0, 5],
        ['C', 3.5, 1.6, 6.5, 1.6, 10, 5],
        ['C', 13.5, 8.4, 16.5, 8.4, 20, 5],
      ],
      0.8,
    ),
    wyp(lisc(5.1, 2.9, 8.6, 0.9, 1.0)),
    wyp(lisc(4.2, 3.4, 1.9, 1.0, 0.8)),
    wyp(lisc(14.9, 7.1, 11.4, 9.1, 1.0)),
    wyp(lisc(15.8, 6.6, 18.1, 9.0, 0.8)),
  ],
  [
    ramkaKostki(),
    kreska(
      [
        ['M', 7.4, 7.4],
        ['C', 3.2, 7.4, 2.8, 2.6, 5.2, 2.6],
        ['C', 7, 2.6, 7.2, 5.2, 5.4, 5.2],
      ],
      0.8,
    ),
    wyp(lisc(7.4, 7.4, 8.4, 4.4, 0.8)),
  ],
);

/** Strumień splotu: dwa pasma przechodzące na przemian nad i pod sobą (przerwy w pasmie spodnim). */
const PASMO_A: [[number, number], [number, number], [number, number], [number, number]][] = [
  [
    [0, 7.6],
    [5, 7.6],
    [5, 2.4],
    [10, 2.4],
  ],
  [
    [10, 2.4],
    [15, 2.4],
    [15, 7.6],
    [20, 7.6],
  ],
];
const PASMO_B: typeof PASMO_A = [
  [
    [0, 2.4],
    [5, 2.4],
    [5, 7.6],
    [10, 7.6],
  ],
  [
    [10, 7.6],
    [15, 7.6],
    [15, 2.4],
    [20, 2.4],
  ],
];
/** Pasmo spodnie ma przerwę w środku odcinka (tam, gdzie krzyżuje się z wierzchnim). */
const pelne = (p: (typeof PASMO_A)[number]) => fragmentKrzywej(p, 0, 1);
const zPrzerwa = (p: (typeof PASMO_A)[number]): Kontur[] => [
  fragmentKrzywej(p, 0, 0.36),
  fragmentKrzywej(p, 0.64, 1),
];
const PRZEPLOT = motyw(
  'wb:przeplot',
  20,
  [
    kreska(pelne(PASMO_A[0]!), 1.3),
    ...zPrzerwa(PASMO_A[1]!).map((k) => kreska(k, 1.3)),
    ...zPrzerwa(PASMO_B[0]!).map((k) => kreska(k, 1.3)),
    kreska(pelne(PASMO_B[1]!), 1.3),
  ],
  [
    ramkaKostki(),
    kreska(okrag(5, 5, 2.6), 1.1),
    kreska(
      [
        ['M', 2.4, 5],
        ['L', 7.6, 5],
        ['M', 5, 2.4],
        ['L', 5, 7.6],
      ],
      0.9,
    ),
  ],
);

/** Łuski: dwa rzędy nachodzących na siebie łuków, drugi rząd przesunięty o pół kafelka. */
const lukLuski = (cx: number, y0: number, r: number): Kontur => [
  ['M', cx - r, y0],
  ['C', cx - r, y0 + r * 0.56, cx - r * 0.56, y0 + r, cx, y0 + r],
  ['C', cx + r * 0.56, y0 + r, cx + r, y0 + r * 0.56, cx + r, y0],
];
const LUSKI = motyw(
  'wb:luski',
  10,
  [
    kreska(lukLuski(5, 0.4, 4.6), 0.8),
    kreska(lukLuski(5, 0.4, 2.8), 0.7),
    // Drugi rząd: łuki o środkach na brzegach kafelka (po połowie w sąsiednich kafelkach).
    kreska(
      [
        ['M', 5, 5],
        ['C', 5, 7.6, 2.6, 9.6, 0.4, 9.6],
      ],
      0.8,
    ),
    kreska(
      [
        ['M', 9.6, 9.6],
        ['C', 7.4, 9.6, 5, 7.6, 5, 5],
      ],
      0.8,
    ),
  ],
  [
    ramkaKostki(),
    kreska(
      [
        ['M', 1, 9],
        ['C', 1, 4.6, 4.6, 1, 9, 1],
      ],
      0.8,
    ),
    kreska(
      [
        ['M', 3.2, 9],
        ['C', 3.2, 5.8, 5.8, 3.2, 9, 3.2],
      ],
      0.8,
    ),
    kreska(
      [
        ['M', 5.4, 9],
        ['C', 5.4, 7, 7, 5.4, 9, 5.4],
      ],
      0.8,
    ),
  ],
);

/** Runy: dwa ogólne znaki runopodobne (laski i ukośne kreski) – bez znaczeń z jakiegokolwiek pisma. */
const RUNY = motyw(
  'wb:runy',
  20,
  [
    kreska(
      [
        ['M', 5, 1.8],
        ['L', 5, 8.2],
        ['M', 5, 2.4],
        ['L', 8, 4.4],
        ['L', 5, 6.4],
      ],
      0.9,
    ),
    kreska(
      [
        ['M', 15, 1.8],
        ['L', 15, 8.2],
        ['M', 12.4, 3],
        ['L', 15, 5],
        ['L', 17.6, 3],
      ],
      0.9,
    ),
  ],
  [
    ramkaKostki(),
    kreska(
      [
        ['M', 3.2, 2.4],
        ['L', 6.8, 7.6],
        ['M', 6.8, 2.4],
        ['L', 3.2, 7.6],
        ['M', 5, 1.8],
        ['L', 5, 8.2],
      ],
      0.9,
    ),
  ],
);

/** Łańcuch: szerokie ogniwa na przemian ze zwężonymi (widok z boku), splecione końcami. */
const LANCUCH = motyw(
  'wb:lancuch',
  20,
  [
    kreska(stadion(1.4, 8.6, 5, 4.4), 0.9),
    kreska(stadion(11.4, 18.6, 5, 4.4), 0.9),
    kreska(elipsa(10, 5, 2.1, 2.4), 0.9),
    // Połówki wąskiego ogniwa na brzegach kafelka (składają się z sąsiednim).
    kreska(
      [
        ['M', 0, 2.6],
        ['C', 1.2, 2.6, 2.1, 3.6, 2.1, 5],
        ['C', 2.1, 6.4, 1.2, 7.4, 0, 7.4],
      ],
      0.9,
    ),
    kreska(
      [
        ['M', 20, 2.6],
        ['C', 18.8, 2.6, 17.9, 3.6, 17.9, 5],
        ['C', 17.9, 6.4, 18.8, 7.4, 20, 7.4],
      ],
      0.9,
    ),
  ],
  [ramkaKostki(), kreska(stadion(2.2, 7.8, 5, 3.6), 0.9), kreska(okrag(5, 5, 0.7), 0.7)],
);

/** Gwiazdki: duża pięcioramienna na przemian z małą czteroramienną i kropką. */
const GWIAZDKI = motyw(
  'wb:gwiazdki',
  12,
  [
    wyp(gwiazda(3.2, 5, 3.3, 1.4, 5)),
    wyp(gwiazda(9.2, 5, 1.8, 0.55, 4)),
    wyp(okrag(11.4, 2.6, 0.45)),
    wyp(okrag(11.4, 7.4, 0.45)),
  ],
  [ramkaKostki(), wyp(gwiazda(5, 5, 3.4, 1.2, 5)), wyp(pierscien(5, 5, 4.2, 3.9))],
);

export const MOTYWY_WBUDOWANE: ElementOzdobny[] = [
  PNACZE,
  PRZEPLOT,
  LUSKI,
  RUNY,
  LANCUCH,
  GWIAZDKI,
];
