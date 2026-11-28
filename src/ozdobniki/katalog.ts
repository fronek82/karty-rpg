import type { Kontur } from '../silnik/scena';
import { gwiazda, lisc, okrag, pierscien, wielokat } from './rysunek';
import { MOTYWY_WBUDOWANE } from './motywy';
import { KSZTALTY_WBUDOWANE } from './ksztalt';
import { NAROZNIK_BILETOWY } from './noweMotywy';
import { SRODKI_WBUDOWANE, ZAKONCZENIA_WBUDOWANE } from './separatory';
import type { ElementOzdobny } from './typy';

/**
 * Wbudowana biblioteka ozdobników – rysunki własne (licencja projektu, patrz `LICENCJE.md`),
 * ogólne, bez motywów z konkretnych gier. Narożniki (w tym pliku) i motywy powtarzalne (`motywy.ts`).
 *
 * Narożnik rysowany dla lewego górnego rogu w kwadracie 10 × 10 (krawędzie ramki biegną po
 * górze i po lewej); pozostałe rogi to odbicia lustrzane (`macierzeNarozniki`).
 */
const R = 10;

function naroznik(id: string, kontury: ElementOzdobny['kontury']): ElementOzdobny {
  return { id, rodzaj: 'naroznik', szer: R, wys: R, kontury };
}

const wypelnione = (kontur: Kontur) => ({ kontur, wypelnienie: 'kolor' as const });

/** Zawijas: linia po krawędziach zwinięta w spiralę przy rogu. */
const ZAWIJAS: Kontur = [
  ['M', 10, 1],
  ['L', 5.2, 1],
  ['C', 2.6, 1, 1, 2.6, 1, 5.2],
  ['L', 1, 10],
  ['M', 4.8, 4.8],
  ['C', 4.8, 3.2, 2.9, 3, 2.9, 4.6],
  ['C', 2.9, 6, 4.5, 6.2, 5.3, 5.3],
];

const kreska = (kontur: Kontur, grubosc = 0.55) => ({
  kontur,
  obrys: { grubosc, kolor: 'kolor' as const },
});

const kropla = (x: number, y: number, skala: number): Kontur => [
  ['M', x, y],
  ['C', x + 4 * skala, y + skala, x + 7 * skala, y + 4 * skala, x + 7 * skala, y + 6 * skala],
  ['C', x + 7 * skala, y + 8.6 * skala, x + 3 * skala, y + 8.2 * skala, x, y],
  ['Z'],
];

export const NAROZNIKI_WBUDOWANE: ElementOzdobny[] = [
  naroznik('wb:kat', [
    wypelnione(wielokat([0, 0], [10, 0], [10, 1.6], [1.6, 1.6], [1.6, 10], [0, 10])),
  ]),
  naroznik('wb:lisc', [
    wypelnione(pierscien(2.6, 2.6, 2.6, 1.5)),
    wypelnione(lisc(4.2, 4.2, 9.4, 9.4, 1.7)),
  ]),
  naroznik('wb:okucie', [
    wypelnione([
      ...wielokat([0, 0], [4.4, 0], [4.4, 4.4], [0, 4.4]),
      ...okrag(2.2, 2.2, 0.8, true),
    ]),
    wypelnione(wielokat([4.4, 0], [10, 0], [10, 1.2], [4.4, 1.2])),
    wypelnione(wielokat([0, 4.4], [1.2, 4.4], [1.2, 10], [0, 10])),
  ]),
  naroznik('wb:gwiazda', [wypelnione(gwiazda(3.4, 3.4, 3.4, 0.95))]),
  naroznik('wb:wezel', [wypelnione(pierscien(3, 3, 3, 1.8)), wypelnione(okrag(3, 3, 0.7))]),
  naroznik('wb:zawijas', [{ kontur: ZAWIJAS, obrys: { grubosc: 0.9, kolor: 'kolor' } }]),
  naroznik('wb:schodkowy', [
    kreska(
      [
        ['M', 1, 10],
        ['L', 1, 1],
        ['L', 10, 1],
        ['M', 3, 8.5],
        ['L', 3, 3],
        ['L', 8.5, 3],
        ['M', 5, 7],
        ['L', 5, 5],
        ['L', 7, 5],
      ],
      0.62,
    ),
  ]),
  naroznik('wb:muszla', [
    kreska([
      ['M', 1, 1],
      ['C', 4, 0.25, 7.2, 1.2, 8.7, 3.3],
      ['C', 8.2, 4.1, 7.4, 4.6, 6.5, 4.6],
      ['C', 6.6, 5.5, 5.6, 6.6, 4.6, 6.6],
      ['C', 4.6, 7.6, 4.2, 8.3, 3.3, 8.7],
      ['C', 1.2, 7.2, 0.25, 4, 1, 1],
      ['Z'],
      ['M', 1, 1],
      ['L', 7.7, 3.4],
      ['M', 1, 1],
      ['L', 6.5, 4.6],
      ['M', 1, 1],
      ['L', 4.6, 6.6],
      ['M', 1, 1],
      ['L', 3.4, 7.7],
    ]),
  ]),
  naroznik('wb:kamienny', [
    kreska(wielokat([1.2, 10], [1.2, 1.2], [10, 1.2], [10, 8.8], [8.8, 8.8], [8.8, 10])),
    kreska(
      [
        ['M', 1.2, 5],
        ['L', 10, 5],
        ['M', 5, 5],
        ['L', 5, 10],
        ['M', 6.8, 1.2],
        ['L', 6.8, 5],
        ['M', 5, 8.8],
        ['L', 8.8, 8.8],
      ],
      0.4,
    ),
  ]),
  naroznik('wb:zwornik', [
    kreska(
      [
        ['M', 0.9, 10],
        ['L', 0.9, 0.9],
        ['L', 10, 0.9],
        ['M', 2.6, 8.5],
        ['L', 2.6, 2.6],
        ['L', 8.5, 2.6],
      ],
      0.4,
    ),
    kreska(wielokat([2.05, 2.05], [6.05, 2.75], [8.55, 5.1], [5.1, 8.55], [2.75, 6.05])),
    wypelnione(wielokat([4.1, 4.1], [6.1, 5.05], [5.05, 6.1])),
  ]),
  naroznik('wb:biletowy', NAROZNIK_BILETOWY),
  naroznik('wb:trzy-krople', [
    kreska(kropla(0.9, 0.9, 1)),
    kreska(
      [
        ['M', 4.4, 1],
        ['C', 5.5, 2.3, 6.65, 4.45, 8.9, 3.5],
        ['C', 10, 2.3, 8.6, 1.1, 4.4, 1],
        ['Z'],
      ],
      0.45,
    ),
    kreska(
      [
        ['M', 1, 4.4],
        ['C', 2.3, 5.5, 4.45, 6.65, 3.5, 8.9],
        ['C', 2.3, 10, 1.1, 8.6, 1, 4.4],
        ['Z'],
      ],
      0.45,
    ),
  ]),
  naroznik('wb:kwadraty', [
    kreska(
      [
        ['M', 0.85, 10],
        ['L', 0.85, 0.85],
        ['L', 10, 0.85],
      ],
      0.45,
    ),
    kreska(wielokat([2, 2], [5.6, 2], [5.6, 5.6], [2, 5.6])),
    kreska(wielokat([6.7, 2], [9.15, 2], [9.15, 4.45], [6.7, 4.45])),
    kreska(wielokat([2, 6.7], [4.45, 6.7], [4.45, 9.15], [2, 9.15])),
    wypelnione(wielokat([3.1, 3.1], [4.5, 3.1], [4.5, 4.5], [3.1, 4.5])),
  ]),
  naroznik('wb:rozeta', [
    kreska(lisc(1.05, 1.05, 4.4, 4.4, 1.25)),
    kreska(lisc(4.4, 4.4, 7.8, 1.75, 1.15)),
    kreska(lisc(4.4, 4.4, 7.2, 7.2, 1.1)),
    kreska(lisc(4.4, 4.4, 1.75, 7.8, 1.15)),
    wypelnione(okrag(4.4, 4.4, 0.62)),
  ]),
];

export const ELEMENTY_WBUDOWANE: ElementOzdobny[] = [
  ...NAROZNIKI_WBUDOWANE,
  ...MOTYWY_WBUDOWANE,
  ...ZAKONCZENIA_WBUDOWANE,
  ...SRODKI_WBUDOWANE,
  ...KSZTALTY_WBUDOWANE,
];

/**
 * Element po identyfikatorze: wbudowany (`wb:…`) albo własny z biblioteki projektu (`wlasne`,
 * `Projekt.biblioteka.ozdobniki`); brak = `undefined`. Wbudowane mają pierwszeństwo.
 */
export function znajdzElement(
  id: string,
  wlasne?: readonly ElementOzdobny[],
): ElementOzdobny | undefined {
  return ELEMENTY_WBUDOWANE.find((e) => e.id === id) ?? wlasne?.find((e) => e.id === id);
}

/** Czy element jest wbudowany (tylko do odczytu). */
export const czyWbudowany = (id: string) => id.startsWith('wb:');
