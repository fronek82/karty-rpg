import type { Kontur, KonturSymbolu } from '../silnik/scena';
import { lisc, okrag, prostokat } from './rysunek';
import type { ElementOzdobny } from './typy';

const WYS = 10;
const kreska = (kontur: Kontur, grubosc = 0.55): KonturSymbolu => ({
  kontur,
  obrys: { grubosc, kolor: 'kolor' },
});
const wypelnienie = (kontur: Kontur): KonturSymbolu => ({ kontur, wypelnienie: 'kolor' });
const linia = (szer: number, y: number) =>
  kreska(
    [
      ['M', 0, y],
      ['L', szer, y],
    ],
    0.4,
  );
const motyw = (
  id: string,
  szer: number,
  kontury: KonturSymbolu[],
  kostka: KonturSymbolu[],
): ElementOzdobny => ({ id, rodzaj: 'motyw', szer, wys: WYS, kontury, kostka });

/** Łuk ćwiartkowy. Końce i styczne odpowiadają poziomym liniom w kafelku. */
function lukNarozny(y: number, bok = WYS): KonturSymbolu {
  const uchwyt = (bok - y) * (1 - 0.5522847498);
  return kreska(
    [
      ['M', bok, y],
      ['C', y + uchwyt, y, y, y + uchwyt, y, bok],
    ],
    0.4,
  );
}

const polozeniaPerforacji = [0.9, 9.1];
const rogi = (pozycje: number[], bok = WYS) => pozycje.map((y) => lukNarozny(y, bok));

function naroznikPerforacji(bok: number): KonturSymbolu[] {
  const promien = bok - WYS / 2;
  return [
    ...rogi(polozeniaPerforacji, bok),
    ...[Math.PI / 9, Math.PI / 4, (7 * Math.PI) / 18].map((kat, i) =>
      kreska(
        okrag(bok - promien * Math.sin(kat), bok - promien * Math.cos(kat), i === 1 ? 1.05 : 0.62),
        0.45,
      ),
    ),
  ];
}
export const NAROZNIK_BILETOWY = naroznikPerforacji(WYS);

const MEANDER = motyw(
  'wb:meander',
  12,
  [
    kreska([
      ['M', 0, 5],
      ['L', 2, 5],
      ['L', 2, 2],
      ['L', 10, 2],
      ['L', 10, 7],
      ['L', 5, 7],
      ['L', 5, 4],
      ['L', 7, 4],
    ]),
    kreska([
      ['M', 12, 5],
      ['L', 11, 5],
    ]),
    linia(12, 9),
  ],
  [lukNarozny(9)],
);

const FALA = motyw(
  'wb:fala',
  16,
  [
    kreska([
      ['M', 0, 5],
      ['C', 2.5, 1, 5.5, 1, 8, 5],
      ['C', 10.5, 9, 13.5, 9, 16, 5],
    ]),
    linia(16, 9),
  ],
  [lukNarozny(9)],
);

const CEGIELKI = motyw(
  'wb:cegielki',
  12,
  [
    ...[1.2, 5, 8.8].map((y) => linia(12, y)),
    kreska(
      [
        ['M', 3, 1.2],
        ['L', 3, 5],
        ['M', 9, 5],
        ['L', 9, 8.8],
      ],
      0.4,
    ),
  ],
  [
    ...[1.2, 5, 8.8].map((y) => lukNarozny(y)),
    kreska(
      [
        ['M', 6.5, 1.9],
        ['L', 7.6, 5.2],
        ['M', 4.9, 6.5],
        ['L', 8.1, 8.3],
      ],
      0.4,
    ),
  ],
);

const ARKADY = motyw(
  'wb:arkady',
  10,
  [
    kreska([
      ['M', 0, 7.5],
      ['L', 0, 5.8],
      ['C', 0, 0.8, 10, 0.8, 10, 5.8],
      ['L', 10, 7.5],
    ]),
    linia(10, 9),
  ],
  [lukNarozny(9)],
);

const PERFORACJA = motyw(
  'wb:perforacja',
  12,
  [
    linia(12, 0.9),
    linia(12, 9.1),
    kreska(okrag(3, 5, 1.25), 0.45),
    kreska(okrag(9, 5, 0.75), 0.45),
  ],
  NAROZNIK_BILETOWY,
);

const kropla: Kontur = [
  ['M', 4.5, 1.5],
  ['C', 5, 3.2, 7, 4.2, 7, 5.9],
  ['C', 7, 8.7, 2, 8.7, 2, 5.9],
  ['C', 2, 4.2, 4, 3.2, 4.5, 1.5],
  ['Z'],
];
const KROPLE = motyw('wb:krople', 9, [kreska(kropla), linia(9, 9.25)], [lukNarozny(9.25)]);

const IMPULSY = motyw(
  'wb:impulsy',
  13,
  [
    linia(13, 9),
    kreska([
      ['M', 1.5, 9],
      ['L', 1.5, 6],
      ['M', 5, 9],
      ['L', 5, 3],
      ['M', 8.3, 9],
      ['L', 8.3, 1.2],
      ['M', 11.5, 9],
      ['L', 11.5, 4.8],
    ]),
  ],
  [lukNarozny(9)],
);

const TRZCINY = motyw(
  'wb:trzciny',
  11,
  [
    linia(11, 0.8),
    linia(11, 9.2),
    kreska(lisc(1.1, 7.7, 8.8, 2.15, 1.2), 0.45),
    kreska(
      [
        ['M', 2, 7.1],
        ['L', 8.2, 2.7],
        ['M', 6.1, 7.9],
        ['C', 8.1, 7, 9.2, 6.2, 10.3, 4.7],
      ],
      0.38,
    ),
  ],
  [lukNarozny(0.8), lukNarozny(9.2)],
);

const szer = 19;
const szyny = [0.65, 9.35];
const proste = (pozycje: number[]) => pozycje.map((y) => linia(szer, y));

const polozeniaLukow = [szyny[0]!, 1.9, 3.1, 5, 6.9, 8.1, szyny[1]!];
const PRZESUNIETE_LUKI = motyw(
  'wb:przesuniete-luki',
  szer,
  [
    ...proste([0.65, 5, 9.35]),
    ...[1.9, 3.1].map((y) =>
      kreska(
        [
          ['M', 0, y],
          ['C', 4, y, 3.5, y + 1.05, 7, y + 1.05],
          ['C', 10.5, y + 1.05, 10, y, 14, y],
          ['L', 19, y],
        ],
        0.4,
      ),
    ),
    ...[6.9, 8.1].map((y) =>
      kreska(
        [
          ['M', 0, y],
          ['L', 5, y],
          ['C', 9, y, 8.5, y - 1.05, 12, y - 1.05],
          ['C', 15.5, y - 1.05, 15, y, 19, y],
        ],
        0.4,
      ),
    ),
    kreska(
      [
        ['M', 7, 4.15],
        ['C', 8.4, 4.15, 9.2, 5, 11.8, 5],
        ['M', 12, 5.85],
        ['C', 13.4, 5.85, 14.2, 5, 16.8, 5],
      ],
      0.4,
    ),
  ],
  rogi(polozeniaLukow),
);

const polozeniaRozwidlen = [0.65, 1.65, 5, 8.35, 9.35];
const ROZWIDLENIA = motyw(
  'wb:rozwidlenia',
  szer,
  [
    ...proste(polozeniaRozwidlen),
    kreska(
      [
        ['M', 1.5, 1.65],
        ['L', 7, 5],
        ['M', 4, 1.65],
        ['L', 9.5, 5],
        ['M', 10, 8.35],
        ['L', 15.5, 5],
        ['M', 12.5, 8.35],
        ['L', 18, 5],
      ],
      0.4,
    ),
  ],
  rogi(polozeniaRozwidlen),
);

const polozeniaWsteg = [2.5, 3.75, 5, 6.25, 7.5];
const WSTEGI = motyw(
  'wb:wstegi',
  szer,
  [
    ...proste(szyny),
    ...polozeniaWsteg.map((y) =>
      kreska(
        [
          ['M', 0, y],
          ['C', 2.5, y, 2.6, y - 1.4, 4.75, y - 1.4],
          ['C', 8, y - 1.4, 11, y + 1.4, 14.25, y + 1.4],
          ['C', 16.4, y + 1.4, 16.5, y, 19, y],
        ],
        0.38,
      ),
    ),
  ],
  rogi([...szyny, ...polozeniaWsteg]),
);

const polozeniaWachlarzy = [0.65, 1.65, 8.35, 9.35];
const WACHLARZE = motyw(
  'wb:wachlarze',
  szer,
  [
    ...proste(polozeniaWachlarzy),
    ...[0, 1.4, 2.8].map((dx) =>
      kreska(
        [
          ['M', 1 + dx, 1.65],
          ['C', 4 + dx, 1.65, 5 + dx, 4.3, 8 + dx, 4.3],
          ['M', 9 + dx, 8.35],
          ['C', 12 + dx, 8.35, 13 + dx, 5.7, 16 + dx, 5.7],
        ],
        0.4,
      ),
    ),
  ],
  rogi(polozeniaWachlarzy),
);

/** Dodatkowy motyw inspirowany oprawą książek: pionowe grzbiety na wspólnej podstawie. */
const GRZBIETY = motyw(
  'wb:grzbiety',
  18,
  [
    linia(18, 9),
    kreska(prostokat(1.1, 1.3, 3.4, 7.7), 0.48),
    kreska(prostokat(5.3, 2.3, 4.2, 6.7), 0.48),
    kreska(
      [
        ['M', 11.7, 9],
        ['L', 9.9, 2.15],
        ['L', 13.1, 1.3],
        ['L', 15.15, 9],
      ],
      0.48,
    ),
    wypelnienie(okrag(7.4, 4.2, 0.5)),
  ],
  [lukNarozny(9)],
);

/** Wzory, których styczne łączą się z własnym wektorowym łukiem w rogu. */
const POLOZENIA_CIAGLYCH_ROGOW = new Map([
  [PERFORACJA.id, polozeniaPerforacji],
  [PRZESUNIETE_LUKI.id, polozeniaLukow],
  [ROZWIDLENIA.id, polozeniaRozwidlen],
  [WSTEGI.id, [...szyny, ...polozeniaWsteg]],
  [WACHLARZE.id, polozeniaWachlarzy],
]);
export const maCiaglyNaroznik = (id: string) => POLOZENIA_CIAGLYCH_ROGOW.has(id);

export function powiekszCiaglyNaroznik(id: string, bok: number): KonturSymbolu[] {
  return id === PERFORACJA.id
    ? naroznikPerforacji(bok)
    : rogi(POLOZENIA_CIAGLYCH_ROGOW.get(id) ?? [], bok);
}
export const dopasujNaroznikDoPasa = (motyw: string | undefined, naroznik: string | undefined) =>
  motyw === PERFORACJA.id && naroznik === 'wb:biletowy';

export const NOWE_MOTYWY = [
  MEANDER,
  FALA,
  CEGIELKI,
  ARKADY,
  PERFORACJA,
  KROPLE,
  IMPULSY,
  TRZCINY,
  PRZESUNIETE_LUKI,
  ROZWIDLENIA,
  WSTEGI,
  WACHLARZE,
  GRZBIETY,
];
