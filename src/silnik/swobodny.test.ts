import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { Kontener, Pole, Pozycja, Szablon, Wezel } from '../model/szablon';
import { rejestrTestowy } from './__testy__/pomoc';
import { renderujKarte } from './karta';
import type { ElementSceny } from './scena';
import { scenaDoSvg } from './svg';
import {
  obrocProstokat,
  prostokatPoObrocie,
  rozmiesc,
  zmierz,
  type KontekstUkladu,
  type UlozonyWezel,
} from './uklad';

/** Pole testowe: ikona o zadanym rozmiarze treści; tekst – 40 mm w wierszach po 2 mm, łamany do szerokości. */
const ctx: KontekstUkladu = {
  zmierzPole: (p, ogr) => {
    if (p.typ === 'ikona') return { szer: p.rozmiar, wys: p.rozmiar };
    if (p.typ === 'tekst') {
      const szer = Math.min(40, ogr.szer ?? 40);
      return { szer, wys: 2 * Math.ceil(40 / szer) };
    }
    return { szer: 0, wys: 0 };
  },
  czyUkryty: () => false,
};

const ikona = (id: string, bok: number, extra: Partial<Pole> = {}): Pole =>
  ({ id, typ: 'ikona', ikona: 'gwiazdka', rozmiar: bok, ...extra }) as Pole;
const swobodny = (dzieci: Wezel[], extra: Partial<Kontener> = {}): Kontener => ({
  id: 's',
  typ: 'swobodny',
  dzieci,
  ...extra,
});
const prost = (u: UlozonyWezel) =>
  [u.x, u.y, u.szer, u.wys].map((v) => Math.round(v * 1000) / 1000);

describe('kontener swobodny – układ', () => {
  it('pozycja w mm od lewego górnego rogu wnętrza (z paddingiem), rozmiar stały albo wg treści', () => {
    const k = swobodny(
      [
        ikona('a', 4, { pozycja: { x: 3, y: 5 } }),
        ikona('b', 4, { pozycja: { x: 10, y: 1 }, szerokosc: { mm: 12 }, wysokosc: { mm: 7 } }),
        ikona('c', 4),
      ],
      { padding: 2 },
    );
    const u = rozmiesc(k, 0, 0, 50, 40, ctx);
    expect(u.dzieci.map(prost)).toEqual([
      [5, 7, 4, 4],
      [12, 3, 12, 7],
      [2, 2, 4, 4],
    ]);
  });

  it('procenty liczą się od wnętrza kontenera, „wypełnij” działa jak „wg treści”', () => {
    const k = swobodny([ikona('a', 4, { szerokosc: { procent: 50 }, wysokosc: { wypelnij: 1 } })]);
    const u = rozmiesc(k, 0, 0, 60, 40, ctx);
    expect(prost(u.dzieci[0]!)).toEqual([0, 0, 30, 4]);
  });

  it('kotwice: lewy dolny, środek i prawy dolny trzymają element przy swoim punkcie', () => {
    const dzieci = (): Wezel[] => [
      ikona('ld', 4, { pozycja: { x: 3, y: -3, kotwica: 'lewy-dolny' } }),
      ikona('sr', 4, { pozycja: { x: 0, y: 0, kotwica: 'srodek' } }),
      ikona('pd', 4, { pozycja: { x: -3, y: -3, kotwica: 'prawy-dolny' } }),
      ikona('g', 4, { pozycja: { x: 0, y: 2, kotwica: 'gorny' } }),
    ];
    const u = rozmiesc(swobodny(dzieci()), 0, 0, 63, 88, ctx);
    expect(u.dzieci.map(prost)).toEqual([
      [3, 81, 4, 4],
      [29.5, 42, 4, 4],
      [56, 81, 4, 4],
      [29.5, 2, 4, 4],
    ]);
  });

  it('po zmianie rozmiaru karty element „przyklejony” do prawego dolnego rogu zostaje przy rogu', () => {
    const k = swobodny([ikona('pd', 4, { pozycja: { x: -3, y: -3, kotwica: 'prawy-dolny' } })]);
    const male = rozmiesc(k, 0, 0, 63, 88, ctx).dzieci[0]!;
    const duze = rozmiesc(k, 0, 0, 70, 120, ctx).dzieci[0]!;
    expect(prost(male)).toEqual([56, 81, 4, 4]);
    expect(prost(duze)).toEqual([63, 113, 4, 4]);
    // Odległość od krawędzi się nie zmienia.
    expect(63 - (male.x + male.szer)).toBe(70 - (duze.x + duze.szer));
    expect(88 - (male.y + male.wys)).toBe(120 - (duze.y + duze.wys));
  });

  it('kotwica liczy od wnętrza kontenera (po paddingu)', () => {
    const k = swobodny([ikona('pd', 4, { pozycja: { x: 0, y: 0, kotwica: 'prawy-dolny' } })], {
      padding: { prawo: 5, dol: 1 },
    });
    expect(prost(rozmiesc(k, 0, 0, 50, 40, ctx).dzieci[0]!)).toEqual([41, 35, 4, 4]);
  });

  it('obrót 90° zamienia boki prostokąta zajętego na karcie i trzyma środek', () => {
    const k = swobodny([
      ikona('a', 4, {
        szerokosc: { mm: 20 },
        wysokosc: { mm: 6 },
        pozycja: { x: 10, y: 10, obrot: 90 },
      }),
    ]);
    const a = rozmiesc(k, 0, 0, 63, 88, ctx).dzieci[0]!;
    expect(a.obrot).toBe(90);
    // Prostokąt na karcie: lewy górny róg w (10, 10), 6 × 20 – środek (13, 20).
    expect(prostokatPoObrocie(a)).toEqual({ x: 10, y: 10, szer: 6, wys: 20 });
    // Ramka przed obrotem ma ten sam środek i niezamienione boki.
    expect(prost(a)).toEqual([3, 17, 20, 6]);
  });

  it('obrót 180° nie zamienia boków, 270° tak; kotwica prawa dolna działa z obrotem', () => {
    const dzieci = [180, 270].map((o) =>
      ikona(`o${o}`, 4, {
        szerokosc: { mm: 20 },
        wysokosc: { mm: 6 },
        pozycja: { x: -2, y: -2, kotwica: 'prawy-dolny', obrot: o as 180 | 270 },
      }),
    );
    const u = rozmiesc(swobodny(dzieci), 0, 0, 63, 88, ctx);
    expect(prostokatPoObrocie(u.dzieci[0]!)).toEqual({ x: 41, y: 80, szer: 20, wys: 6 });
    expect(prostokatPoObrocie(u.dzieci[1]!)).toEqual({ x: 55, y: 66, szer: 6, wys: 20 });
  });

  it('obrót tekstu: pomiar łamie tekst do boku, który po obrocie leży wzdłuż karty', () => {
    // Tekst 40 mm bez stałej szerokości: bez obrotu łamany do 20 mm (wnętrze 20 × 88),
    // obrócony o 90° – szerokość przed obrotem ogranicza wysokość wnętrza (88 → jeden wiersz).
    const t = (obrot: 0 | 90): Wezel =>
      ({ id: 't', typ: 'tekst', pozycja: { x: 0, y: 0, obrot } }) as unknown as Wezel;
    const a = rozmiesc(swobodny([t(0)]), 0, 0, 20, 88, ctx).dzieci[0]!;
    const b = rozmiesc(swobodny([t(90)]), 0, 0, 20, 88, ctx).dzieci[0]!;
    expect(prost(a)).toEqual([0, 0, 20, 4]);
    // Ramka przed obrotem 40 × 2 ma środek (1, 20), więc zaczyna się w (−19, 19).
    expect(prost(b)).toEqual([-19, 19, 40, 2]);
    // Na karcie zajmuje 2 × 40 i leży przy lewej krawędzi.
    expect(prostokatPoObrocie(b)).toEqual({ x: 0, y: 0, szer: 2, wys: 40 });
  });

  it('kolumna zagnieżdżona w swobodnym układa się normalnie (łamie tekst, rozciąga dzieci)', () => {
    const kolumna: Kontener = {
      id: 'kol',
      typ: 'kolumna',
      odstep: 1,
      szerokosc: { mm: 20 },
      pozycja: { x: 5, y: 6 },
      dzieci: [
        { id: 't', typ: 'tekst' } as Wezel,
        ikona('i', 3, { wyrownanie: { poziomo: 'koniec' } }),
      ],
    };
    const u = rozmiesc(swobodny([kolumna]), 0, 0, 63, 88, ctx);
    const kol = u.dzieci[0]!;
    // Wysokość kolumny wg treści: tekst (2 wiersze po 2 mm = 4) + odstęp 1 + ikona 3.
    expect(prost(kol)).toEqual([5, 6, 20, 8]);
    expect(kol.dzieci.map(prost)).toEqual([
      [5, 6, 20, 4],
      [22, 11, 3, 3],
    ]);
  });

  it('kontener swobodny „wg treści” ma rozmiar obwiedni dzieci', () => {
    const k = swobodny([
      ikona('a', 4, { pozycja: { x: 3, y: 5 } }),
      ikona('b', 6, { pozycja: { x: 10, y: 1 } }),
    ]);
    expect(zmierz(k, {}, ctx)).toEqual({ szer: 16, wys: 9 });
    // Z obrotem obwiednia liczy zamienione boki.
    const o = swobodny([
      ikona('a', 4, {
        szerokosc: { mm: 10 },
        wysokosc: { mm: 3 },
        pozycja: { x: 0, y: 0, obrot: 90 },
      }),
    ]);
    expect(zmierz(o, {}, ctx)).toEqual({ szer: 3, wys: 10 });
  });

  it('kotwica środkowa w obwiedni: d + 2|x|, końcowa: d + |x|', () => {
    const k = (kotwica: Pozycja['kotwica'], x: number) =>
      swobodny([ikona('a', 4, { pozycja: { x, y: 0, kotwica } })]);
    expect(zmierz(k('srodek', 5), {}, ctx).szer).toBe(14);
    expect(zmierz(k('srodek', -5), {}, ctx).szer).toBe(14);
    expect(zmierz(k('prawy', -3), {}, ctx).szer).toBe(7);
    // Dodatnie x przy kotwicy końcowej wyprowadza element poza kontener – liczy się odległość.
    expect(zmierz(k('prawy', 3), {}, ctx).szer).toBe(7);
    expect(zmierz(k('lewy', 3), {}, ctx).szer).toBe(7);
    const y = swobodny([ikona('a', 4, { pozycja: { x: 0, y: 2, kotwica: 'dolny' } })]);
    expect(zmierz(y, {}, ctx).wys).toBe(6);
    const sr = swobodny([ikona('a', 4, { pozycja: { x: 0, y: 2, kotwica: 'srodek' } })]);
    expect(zmierz(sr, {}, ctx).wys).toBe(8);
  });

  it('margines i wyrównanie dziecka są ignorowane, minSzerokosc – tylko przy rozmiarze wg treści', () => {
    const k = swobodny([
      ikona('a', 4, {
        margines: 7,
        wyrownanie: { poziomo: 'koniec', pionowo: 'srodek' },
        pozycja: { x: 2, y: 3 },
      }),
      ikona('b', 4, { minSzerokosc: 20, pozycja: { x: 0, y: 0 } }),
      ikona('c', 4, { minSzerokosc: 20, szerokosc: { mm: 10 }, pozycja: { x: 0, y: 0 } }),
    ]);
    const u = rozmiesc(k, 0, 0, 60, 40, ctx);
    expect(prost(u.dzieci[0]!)).toEqual([2, 3, 4, 4]);
    // Wg treści: minimum obowiązuje; stały rozmiar ma pierwszeństwo przed minimum.
    expect(prost(u.dzieci[1]!)).toEqual([0, 0, 20, 4]);
    expect(prost(u.dzieci[2]!)).toEqual([0, 0, 10, 4]);
  });

  it('procenty przy obrocie 90° liczą się od wnętrza w tej samej osi (przed obrotem)', () => {
    const k = swobodny([
      ikona('a', 4, {
        szerokosc: { procent: 50 },
        wysokosc: { procent: 10 },
        pozycja: { x: 0, y: 0, obrot: 90 },
      }),
    ]);
    const a = rozmiesc(k, 0, 0, 60, 40, ctx).dzieci[0]!;
    expect(a.szer).toBe(30);
    expect(a.wys).toBe(4);
    expect(prostokatPoObrocie(a)).toEqual({ x: 0, y: 0, szer: 4, wys: 30 });
  });

  it('obrocProstokat: kolejne obroty o 90° wracają do punktu wyjścia', () => {
    const r = { x: 4, y: 7, szer: 10, wys: 2 };
    let x = r;
    for (let i = 0; i < 4; i++) x = obrocProstokat(x, 20, 30, 90);
    expect(x).toEqual(r);
    expect(obrocProstokat(r, 20, 30, 180)).toEqual({ x: 26, y: 51, szer: 10, wys: 2 });
  });
});

const czcionki = rejestrTestowy();
const szablon = (korzen: Kontener, extra: Partial<Szablon> = {}): Szablon => ({
  id: 'sw',
  nazwa: 'Swobodny',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo: '#ffffff',
  korzen,
  ...extra,
});
const tekst = (id: string, napis: string, extra: Partial<Pole> = {}): Pole =>
  ({
    id,
    typ: 'tekst',
    tekst: napis,
    styl: { czcionka: 'tresc', rozmiar: pt(10) },
    ...extra,
  }) as Pole;

const grupy = (e: ElementSceny[]) =>
  e.filter((x): x is Extract<ElementSceny, { typ: 'grupa' }> => x.typ === 'grupa');

describe('kontener swobodny – scena', () => {
  const karta = szablon(
    swobodny([
      { id: 'tlo', typ: 'ikona', ikona: 'gwiazdka', rozmiar: 6, pozycja: { x: 2, y: 2 } } as Pole,
      tekst('tytul', 'Bagienny troll', {
        szerokosc: { mm: 40 },
        wysokosc: { mm: 8 },
        tlo: '#2a3b50',
        pozycja: { x: 0, y: 0, kotwica: 'dolny' },
      }),
      tekst('bok', 'STWÓR', {
        szerokosc: { mm: 30 },
        wysokosc: { mm: 5 },
        pozycja: { x: -2, y: 5, kotwica: 'prawy-gorny', obrot: 90 },
      }),
    ]),
  );

  it('węzeł obrócony trafia do grupy z obrotem wokół środka, reszta bez zmian', () => {
    const w = renderujKarte(karta, { dane: {} }, { czcionki });
    const g = grupy(w.scena.elementy);
    expect(g).toHaveLength(1);
    // Prostokąt na karcie: 5 × 30, prawy górny róg w (61, 5) → środek (58,5; 20).
    expect(g[0]).toMatchObject({ x: 58.5, y: 20, obrot: 90, macierz: [1, 0, 0, 1, -58.5, -20] });
    // Węzeł w liście dla edytora: prostokąt po obrocie (do zaznaczania i trafień).
    const bok = w.wezly.find((x) => x.id === 'bok')!;
    expect([bok.x, bok.y, bok.szer, bok.wys]).toEqual([56, 5, 5, 30]);
    expect(bok.obrot).toBe(90);
    expect(bok.lokalne).toMatchObject({ szer: 30, wys: 5 });
    expect(w.ostrzezenia).toEqual([]);
  });

  it('obrót nie zmienia prostokąta zajętego bez obrotu – tytuł z kotwicą „dolny” stoi na środku dołu', () => {
    const w = renderujKarte(karta, { dane: {} }, { czcionki });
    const t = w.wezly.find((x) => x.id === 'tytul')!;
    expect([t.x, t.y, t.szer, t.wys]).toEqual([11.5, 80, 40, 8]);
  });

  it('tekst obróconego węzła jest rysowany w obróconej grupie, a pomiar zachowuje kolejność rysowania', () => {
    const w = renderujKarte(karta, { dane: {} }, { czcionki });
    const typy = w.scena.elementy.map((e) => e.typ);
    // Kolejność z drzewa: tło karty, ikona, tytuł (tło + tekst), na końcu obrócona grupa.
    expect(typy[typy.length - 1]).toBe('grupa');
    const grupa = grupy(w.scena.elementy)[0]!;
    expect(grupa.elementy.some((e) => e.typ === 'tekst')).toBe(true);
  });

  it('zagnieżdżony obrót: węzły wewnątrz obróconego kontenera mają prostokąty po obrocie', () => {
    const s = szablon(
      swobodny([
        {
          id: 'kol',
          typ: 'kolumna',
          szerokosc: { mm: 40 },
          wysokosc: { mm: 10 },
          pozycja: { x: 10, y: 10, obrot: 90 },
          dzieci: [tekst('wew', 'Napis')],
        } as Kontener,
      ]),
    );
    const w = renderujKarte(s, { dane: {} }, { czcionki });
    const kol = w.wezly.find((x) => x.id === 'kol')!;
    expect([kol.x, kol.y, kol.szer, kol.wys]).toEqual([10, 10, 10, 40]);
    const wew = w.wezly.find((x) => x.id === 'wew')!;
    //     // Tekst stoi na górze kolumny (przed obrotem), po obrocie o 90° – przy jej prawej krawędzi.
    expect(wew.wys).toBe(40);
    expect(wew.x + wew.szer).toBeCloseTo(20, 6);
    expect(wew.y).toBe(10);
  });

  it('dwa poziomy obrotów: prostokąty węzłów po obrocie przodków, ramki lokalne bez nich', () => {
    const wnuk = tekst('wnuk', 'W', {
      szerokosc: { mm: 10 },
      wysokosc: { mm: 4 },
      pozycja: { x: 2, y: 3, obrot: 90 },
    });
    const dziecko: Kontener = {
      id: 'dziecko',
      typ: 'swobodny',
      szerokosc: { mm: 30 },
      wysokosc: { mm: 20 },
      pozycja: { x: 10, y: 10, obrot: 90 },
      dzieci: [wnuk],
    };
    const w = renderujKarte(szablon(swobodny([dziecko])), { dane: {} }, { czcionki });
    // Dziecko: ramka 30 × 20 w (10, 10) obrócona o 90° – na karcie 20 × 30 o tym samym lewym górnym rogu.
    const d = w.wezly.find((x) => x.id === 'dziecko')!;
    expect([d.x, d.y, d.szer, d.wys]).toEqual([10, 10, 20, 30]);
    // Wnuk w układzie dziecka: (2, 3), potem obrót wnuka (4 × 10) i obrót dziecka wokół jego środka (25, 25).
    const n = w.wezly.find((x) => x.id === 'wnuk')!;
    expect(n.lokalne).toMatchObject({ szer: 10, wys: 4 });
    expect(n.obrot).toBe(90);
    // Ramka dziecka przed obrotem: (5, 15) 30 × 20 (środek (20, 25)). Wnuk 4 × 10 stoi w niej w (7, 18),
    // środek (9, 23); obrót dziecka o 90° wokół (20, 25): (−11, −2) → (2, −11), czyli (22, 14).
    expect(n.x + n.szer / 2).toBeCloseTo(22, 6);
    expect(n.y + n.wys / 2).toBeCloseTo(14, 6);
    // Wnuk obrócony o 90° zajmuje w ramce dziecka 4 × 10, a po obrocie dziecka – 10 × 4 na karcie.
    expect([n.szer, n.wys]).toEqual([10, 4]);
  });

  it('obraz omija obrócone pole: przeszkodą jest prostokąt po obrocie', () => {
    const obraz = (obrot: 0 | 90) =>
      szablon(
        swobodny([
          {
            id: 'ob',
            typ: 'obraz',
            zasob: 'x',
            dopasowanie: 'dopasuj',
            omijaj: ['bok'],
            szerokosc: { mm: 50 },
            wysokosc: { mm: 50 },
            pozycja: { x: 0, y: 0 },
          } as Pole,
          tekst('bok', 'STWÓR', {
            szerokosc: { mm: 30 },
            wysokosc: { mm: 6 },
            pozycja: { x: 0, y: 0, obrot },
          }),
        ]),
      );
    const kontekst = { czcionki, obraz: () => ({ szerokosc: 100, wysokosc: 100 }) };
    const pozioma = renderujKarte(obraz(0), { dane: {} }, kontekst).scena.elementy.find(
      (e) => e.typ === 'obraz',
    ) as Extract<ElementSceny, { typ: 'obraz' }>;
    const pionowa = renderujKarte(obraz(90), { dane: {} }, kontekst).scena.elementy.find(
      (e) => e.typ === 'obraz',
    ) as Extract<ElementSceny, { typ: 'obraz' }>;
    // Pole 30 × 6 zabiera pas u góry – obraz 43,5 × 43,5 leży pod nim; obrócone (6 × 30) zabiera pas
    // z lewej – obraz leży na prawo od niego.
    expect([pozioma.x, pozioma.y]).toEqual([3.25, 6.5]);
    expect([pionowa.x, pionowa.y]).toEqual([6.5, 3.25]);
  });

  it('SVG jest deterministyczny i nie zawiera text ani foreignObject', async () => {
    const a = scenaDoSvg(renderujKarte(karta, { dane: {} }, { czcionki }).scena);
    const b = scenaDoSvg(renderujKarte(karta, { dane: {} }, { czcionki }).scena);
    expect(a).toBe(b);
    expect(a).not.toMatch(/<text|foreignObject/);
    expect(a).toContain('rotate(90)');
    await expect(a).toMatchFileSnapshot('./__snapshots__/swobodny-karta.svg');
  });

  it('rozmiar karty zmienia położenia zakotwiczonych węzłów, a nie rozmiary', () => {
    const duza = { ...karta, rozmiar: { tryb: 'mm' as const, szerokosc: 70, wysokosc: 120 } };
    const w = renderujKarte(duza, { dane: {} }, { czcionki });
    const t = w.wezly.find((x) => x.id === 'tytul')!;
    expect([t.x, t.y, t.szer, t.wys]).toEqual([15, 112, 40, 8]);
    const bok = w.wezly.find((x) => x.id === 'bok')!;
    expect([bok.x, bok.y, bok.szer, bok.wys]).toEqual([63, 5, 5, 30]);
  });
});

describe('brak regresji', () => {
  it('pozycja w zwykłej kolumnie jest ignorowana', () => {
    const z = (pozycja?: Pole['pozycja']) =>
      renderujKarte(
        szablon({
          id: 'k',
          typ: 'kolumna',
          padding: 2,
          dzieci: [tekst('a', 'Tytuł', pozycja ? { pozycja } : {})],
        }),
        { dane: {} },
        { czcionki },
      );
    expect(scenaDoSvg(z({ x: 30, y: 30, obrot: 90 }).scena)).toBe(scenaDoSvg(z().scena));
  });
});

it('ogranicza automatyczny pomiar ukośnego pola do wąskiego kontenera', () => {
  const k = swobodny([ikona('a', 25, { pozycja: { x: 0, y: 0, obrot: 45 } })]);
  const a = rozmiesc(k, 0, 0, 42, 18, ctx).dzieci[0]!;
  const r = prostokatPoObrocie(a);
  expect(r.wys).toBeCloseTo(18);
  expect(r.x).toBeCloseTo(0);
  expect(r.y).toBeCloseTo(0);
});
