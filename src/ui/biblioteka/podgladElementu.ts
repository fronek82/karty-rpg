import type { Szablon, Wezel } from '../../model/szablon';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import type { ElementOzdobny } from '../../ozdobniki';
import type { ZasobyPakietu } from '../zasoby';

/** Kolor rysunku w podglądach biblioteki (rysunki kolorowalne). */
export const KOLOR_PODGLADU = '#7a2e24';
const TLO = '#f7f0dc';

/** Wymiary karty podglądu (mm) zależne od rodzaju elementu. */
function rozmiarPodgladu(rodzaj: ElementOzdobny['rodzaj']) {
  if (rodzaj === 'zakonczenie' || rodzaj === 'srodek') return { szer: 63, wys: 14 };
  if (rodzaj === 'ksztalt') return { szer: 40, wys: 40 };
  return { szer: 63, wys: 88 };
}

/**
 * Szablon podglądu elementu – ten sam silnik co na kartach (jedna scena): narożniki i motyw na
 * ramce karty, zakończenie i środek na separatorze, kształt na polu wartości. Ramka 9-slice – M2b-7.
 */
export function szablonPodgladu(e: ElementOzdobny): Szablon | undefined {
  const { szer, wys } = rozmiarPodgladu(e.rodzaj);
  const baza = {
    id: 'podglad',
    nazwa: '',
    rozmiar: { tryb: 'mm' as const, szerokosc: szer, wysokosc: wys },
    tlo: TLO,
  };
  const korzen = (dzieci: Wezel[]) => ({
    id: 'korzen',
    typ: 'kolumna' as const,
    wyrownanie: { poziomo: 'srodek' as const, pionowo: 'srodek' as const },
    dzieci,
  });
  switch (e.rodzaj) {
    case 'naroznik':
      return {
        ...baza,
        ramka: {
          grubosc: 0.3,
          kolor: KOLOR_PODGLADU,
          odsuniecie: 2,
          narozniki: { element: e.id, rozmiar: 12 },
        },
        korzen: korzen([]),
      };
    case 'motyw':
      return {
        ...baza,
        ramka: {
          grubosc: 0.3,
          kolor: KOLOR_PODGLADU,
          odsuniecie: 2,
          ozdoba: { rodzaj: 'motyw', element: e.id, szerokosc: 6, kolor: KOLOR_PODGLADU },
        },
        korzen: korzen([]),
      };
    case 'zakonczenie':
    case 'srodek':
      return {
        ...baza,
        korzen: korzen([
          {
            id: 'sep',
            typ: 'separator',
            kierunek: 'poziomy',
            grubosc: 0.3,
            kolor: KOLOR_PODGLADU,
            padding: { lewo: 2, prawo: 2 },
            ...(e.rodzaj === 'zakonczenie'
              ? { zakonczenia: { element: e.id, rozmiar: 5 } }
              : { srodek: { element: e.id, rozmiar: 5 } }),
          },
        ]),
      };
    case 'ksztalt':
      return {
        ...baza,
        korzen: korzen([
          {
            id: 'w',
            typ: 'wartosc',
            tekst: '12',
            ksztalt: 'wlasny',
            ksztaltElement: e.id,
            minSzerokosc: 28,
            minWysokosc: 28,
            tlo: '#fff8e6',
            obramowanie: { grubosc: 0.5, kolor: KOLOR_PODGLADU },
            styl: { czcionka: 'tresc', rozmiar: 6 },
          },
        ]),
      };
    default:
      return undefined;
  }
}

export interface PodgladElementu {
  svg: string;
  szer: number;
  wys: number;
}

/** SVG podglądu (albo `undefined`, gdy rodzaj nie ma podglądu lub renderowanie się nie uda). */
export function podgladElementu(
  e: ElementOzdobny,
  czcionki: ZasobyPakietu['czcionki'],
  prefiks: string,
): PodgladElementu | undefined {
  const szablon = szablonPodgladu(e);
  if (!szablon) return undefined;
  try {
    const w = renderujKarte(szablon, { dane: {} }, { czcionki, elementy: [e] });
    return {
      svg: scenaDoSvg(w.scena, { przedrostekId: prefiks }),
      szer: w.scena.szer,
      wys: w.scena.wys,
    };
  } catch {
    return undefined;
  }
}
