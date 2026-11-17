import type { Kontur } from '../silnik/scena';
import { gwiazda, lisc, okrag, pierscien, wielokat } from './rysunek';
import { MOTYWY_WBUDOWANE } from './motywy';
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
];

export const ELEMENTY_WBUDOWANE: ElementOzdobny[] = [
  ...NAROZNIKI_WBUDOWANE,
  ...MOTYWY_WBUDOWANE,
  ...ZAKONCZENIA_WBUDOWANE,
  ...SRODKI_WBUDOWANE,
];

/** Element po identyfikatorze (na razie tylko wbudowane); brak = `undefined`. */
export function znajdzElement(id: string): ElementOzdobny | undefined {
  return ELEMENTY_WBUDOWANE.find((e) => e.id === id);
}
