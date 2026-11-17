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

/** Zawijas: linia kończy się spiralą skręconą do góry. */
const ZAWIJAS: Kontur = [
  ['M', 12, 4],
  ['L', 6, 4],
  ['C', 3.6, 4, 1.4, 3.4, 1.4, 1.9],
  ['C', 1.4, 0.8, 2.4, 0.6, 3, 1.1],
  ['C', 3.6, 1.7, 3, 2.6, 2.3, 2.4],
];

export const ZAKONCZENIA_WBUDOWANE: ElementOzdobny[] = [
  zakonczenie('wb:zak-grot', 12, 6, [
    wypelnione(wielokat([0, 3], [4, 0], [12, 2.6], [12, 3.4], [4, 6])),
  ]),
  zakonczenie('wb:zak-zawijas', 12, 6, [obrysem(ZAWIJAS, 0.7)]),
  zakonczenie('wb:zak-lisc', 11, 6, [wypelnione(lisc(0, 3, 11, 3, 2.3))]),
  zakonczenie('wb:zak-kropka', 4, 4, [wypelnione(okrag(2, 2, 2))]),
  zakonczenie('wb:zak-kolec', 12, 5, [wypelnione(wielokat([0, 2.5], [12, 0.3], [12, 4.7]))]),
];

export const SRODKI_WBUDOWANE: ElementOzdobny[] = [
  srodek('wb:sr-romb', 9, 6, [obrysem(wielokat([4.5, 0.3], [8.7, 3], [4.5, 5.7], [0.3, 3]), 0.6)]),
  srodek('wb:sr-gwiazda', 6, 6, [wypelnione(gwiazda(3, 3, 3, 0.95))]),
  srodek('wb:sr-lisc', 12, 6, [wypelnione(lisc(0.5, 4.6, 11.5, 1.4, 2.4))]),
  srodek('wb:sr-kropka', 4, 4, [wypelnione(okrag(2, 2, 2))]),
];
