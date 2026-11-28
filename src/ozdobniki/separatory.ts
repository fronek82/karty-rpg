import type { Kontur } from '../silnik/scena';
import { gwiazda, lisc, okrag, wielokat } from './rysunek';
import type { ElementOzdobny } from './typy';

/**
 * Zakończenia i środki separatorów ozdobnych – rysunki własne (licencja projektu, `LICENCJE.md`),
 * ogólne. Układ rysunku (jednostki pola, Y w dół, oś linii = `wys / 2`):
 * - zakończenie: lewy koniec separatora – czubek przy `x = 0`, linia dochodzi do prawej krawędzi
 *   pola (`x = szer`); prawy koniec to odbicie lustrzane;
 * - środek: rysunek symetryczny, wyśrodkowany na linii; linia jest w tym miejscu przerwana.
 */
const zakonczenie = (id: string, szer: number, wys: number, kontury: ElementOzdobny['kontury']) =>
  ({ id, rodzaj: 'zakonczenie', szer, wys, kontury }) satisfies ElementOzdobny;
const srodek = (id: string, szer: number, wys: number, kontury: ElementOzdobny['kontury']) =>
  ({ id, rodzaj: 'srodek', szer, wys, kontury }) satisfies ElementOzdobny;

const wypelnione = (kontur: Kontur) => ({ kontur, wypelnienie: 'kolor' as const });
const obrysem = (kontur: Kontur, grubosc: number) => ({
  kontur,
  obrys: { grubosc, kolor: 'kolor' as const },
});

/** Zawijas: ogon na osi linii (y = wys / 2), koniec zwinięty w spiralę do góry. */
const ZAWIJAS: Kontur = [
  ['M', 12, 3],
  ['L', 6, 3],
  ['C', 3.6, 3, 1.4, 2.5, 1.4, 1.4],
  ['C', 1.4, 0.5, 2.4, 0.4, 3, 0.9],
  ['C', 3.6, 1.4, 3, 2.1, 2.3, 1.9],
];

export const ZAKONCZENIA_WBUDOWANE: ElementOzdobny[] = [
  zakonczenie('wb:zak-grot', 12, 6, [
    wypelnione(wielokat([0, 3], [4, 0], [12, 2.6], [12, 3.4], [4, 6])),
  ]),
  zakonczenie('wb:zak-zawijas', 12, 6, [obrysem(ZAWIJAS, 0.7)]),
  zakonczenie('wb:zak-lisc', 11, 6, [wypelnione(lisc(0, 3, 11, 3, 2.3))]),
  zakonczenie('wb:zak-kropka', 4, 4, [wypelnione(okrag(2, 2, 2))]),
  zakonczenie('wb:zak-piorkowe', 12, 8, [
    obrysem(lisc(0.45, 0.7, 12, 4, 1.05), 0.58),
    obrysem(lisc(0.45, 7.3, 12, 4, 1.05), 0.58),
  ]),
  zakonczenie('wb:zak-zszywka', 9, 7, [
    obrysem(
      [
        ['M', 9, 3.5],
        ['L', 2.4, 3.5],
        ['C', 0.25, 3.5, 0.25, 0.8, 2.4, 0.8],
        ['L', 5.3, 0.8],
        ['M', 2.4, 3.5],
        ['C', 0.25, 3.5, 0.25, 6.2, 2.4, 6.2],
        ['L', 5.3, 6.2],
      ],
      0.55,
    ),
  ]),
  zakonczenie('wb:zak-kolec', 12, 5, [wypelnione(wielokat([0, 2.5], [12, 0.3], [12, 4.7]))]),
];

export const SRODKI_WBUDOWANE: ElementOzdobny[] = [
  srodek('wb:sr-romb', 9, 6, [obrysem(wielokat([4.5, 0.3], [8.7, 3], [4.5, 5.7], [0.3, 3]), 0.6)]),
  srodek('wb:sr-gwiazda', 6, 6, [wypelnione(gwiazda(3, 3, 3, 0.95))]),
  srodek('wb:sr-lisc', 12, 6, [wypelnione(lisc(0.5, 4.6, 11.5, 1.4, 2.4))]),
  srodek('wb:sr-ziarna', 20, 6, [
    obrysem(lisc(2, 3, 8.9, 3, 1.75), 0.55),
    obrysem(lisc(11.1, 3, 18, 3, 1.75), 0.55),
    wypelnione(okrag(10, 3, 0.62)),
    wypelnione(okrag(0.6, 3, 0.42)),
    wypelnione(okrag(19.4, 3, 0.42)),
  ]),
  srodek('wb:sr-klamra', 16, 7, [
    obrysem(
      [
        ['M', 0.4, 3.5],
        ['L', 4.5, 3.5],
        ['L', 6.25, 0.7],
        ['L', 9.75, 0.7],
        ['L', 11.5, 3.5],
        ['L', 15.6, 3.5],
        ['M', 4.5, 3.5],
        ['L', 6.25, 6.3],
        ['L', 9.75, 6.3],
        ['L', 11.5, 3.5],
      ],
      0.55,
    ),
    wypelnione(okrag(8, 3.5, 0.65)),
  ]),
  srodek('wb:sr-kropka', 4, 4, [wypelnione(okrag(2, 2, 2))]),
];
