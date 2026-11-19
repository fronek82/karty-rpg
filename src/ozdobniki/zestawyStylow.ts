import type { Narozniki, OzdobaMotyw, PoleSeparator } from '../model/szablon';

interface ZestawStylu {
  id: 'lesny' | 'runiczny';
  ozdoba: OzdobaMotyw;
  narozniki: Narozniki;
  separator: Required<
    Pick<PoleSeparator, 'rysunek' | 'kolor' | 'grubosc' | 'stylLinii' | 'zakonczenia' | 'srodek'>
  >;
}

export const ZESTAWY_STYLOW = [
  {
    id: 'lesny',
    ozdoba: { rodzaj: 'motyw', element: 'wb:pnacze', szerokosc: 4, kolor: '#36543e' },
    narozniki: { element: 'wb:lisc', rozmiar: 4 },
    separator: {
      rysunek: 'linia',
      grubosc: 0.3,
      stylLinii: 'ciagla',
      kolor: '#36543e',
      zakonczenia: { element: 'wb:zak-lisc', rozmiar: 2 },
      srodek: { element: 'wb:sr-gwiazda', rozmiar: 2 },
    },
  },
  {
    id: 'runiczny',
    ozdoba: { rodzaj: 'motyw', element: 'wb:runy', szerokosc: 4, kolor: '#614633' },
    narozniki: { element: 'wb:okucie', rozmiar: 4 },
    separator: {
      rysunek: { motyw: 'wb:lancuch', szerokosc: 2 },
      grubosc: 0.3,
      stylLinii: 'ciagla',
      kolor: '#614633',
      zakonczenia: { element: 'wb:zak-kolec', rozmiar: 2 },
      srodek: { element: 'wb:sr-romb', rozmiar: 2 },
    },
  },
] as const satisfies readonly ZestawStylu[];

export type WbudowanyZestawStylu = (typeof ZESTAWY_STYLOW)[number];
