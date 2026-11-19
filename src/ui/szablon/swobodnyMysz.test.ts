import { describe, expect, it } from 'vitest';
import type { Kontener, Pole, Szablon, Wezel } from '../../model/szablon';
import { rejestrTestowy } from '../../silnik/__testy__/pomoc';
import { renderujKarte } from '../../silnik/karta';
import {
  budujCel,
  budujCele,
  celSkalowania,
  zmienRozmiarGrupy,
  doLokalnych,
  mmNaPx,
  naSiatke,
  ograniczDoRodzica,
  przesunCele,
  przyciagnijLinie,
  pxNaMm,
  rozlozRowno,
  trafionyWezel,
  wyrownaj,
  zastosujZmiany,
  zmienRozmiar,
  type Przyciaganie,
  type WezlyKarty,
} from './swobodnyMysz';

import { przygotujUpuszczenie, upuscWezel } from './upuszczanie';

const czcionki = rejestrTestowy();
const ik = (id: string, extra: Partial<Pole> = {}): Pole =>
  ({
    id,
    typ: 'ikona',
    ikona: 'gwiazdka',
    rozmiar: 4,
    szerokosc: { mm: 10 },
    wysokosc: { mm: 10 },
    pozycja: { x: 3, y: 3 },
    ...extra,
  }) as Pole;
const szablon = (dzieci: Wezel[], korzen: Partial<Kontener> = {}): Szablon => ({
  id: 's',
  nazwa: 'S',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: { id: 'k', typ: 'swobodny', dzieci, ...korzen },
});
const wezlyDla = (s: Szablon): WezlyKarty => renderujKarte(s, { dane: {} }, { czcionki }).wezly;
const prost = (s: Szablon, id: string) => {
  const w = wezlyDla(s).find((x) => x.id === id)!;
  return [w.x, w.y, w.szer, w.wys].map((v) => Math.round(v * 1000) / 1000);
};
const BEZ: Przyciaganie = { siatka: 0, obiekty: false, prog: 0.75 };
const poz = (w: { zmiany: Map<string, { pozycja: { x: number; y: number } }> }, id: string) => [
  w.zmiany.get(id)!.pozycja.x,
  w.zmiany.get(id)!.pozycja.y,
];

describe('przeliczenie px ↔ mm', () => {
  it('liczy ze skali podglądu w obie strony', () => {
    // Karta 63 mm rysowana na 504 px: 8 px na mm.
    expect(pxNaMm(8, 504, 63)).toBe(1);
    expect(pxNaMm(6, 504, 63)).toBeCloseTo(0.75);
    expect(mmNaPx(0.5, 504, 63)).toBe(4);
    expect(pxNaMm(mmNaPx(12.3, 333, 63), 333, 63)).toBeCloseTo(12.3);
  });
  it('doLokalnych cofa obrót przodków (zgodnie z zegarem)', () => {
    expect(doLokalnych(1, 2, 0)).toEqual([1, 2]);
    expect(doLokalnych(0, 5, 90)).toEqual([5, -0]);
    expect(doLokalnych(1, 2, 180)).toEqual([-1, -2]);
    expect(doLokalnych(0, 5, 270)).toEqual([-5, 0]);
  });
});

describe('trafienia z prostokątów układu', () => {
  it('obrócony element jest trafiany prostokątem po obrocie, nie przed obrotem', () => {
    // Pole 20 × 6 obrócone o 90°: zajmuje na karcie 6 × 20 w (10, 10) (X · Y wiążą prostokąt po obrocie).
    const s = szablon([
      ik('a', {
        szerokosc: { mm: 20 },
        wysokosc: { mm: 6 },
        pozycja: { x: 10, y: 10, obrot: 90 },
      }),
    ]);
    const w = wezlyDla(s);
    expect(prost(s, 'a')).toEqual([10, 10, 6, 20]);
    expect(trafionyWezel(w, 13, 28)).toBe('a');
    // Punkt w prostokącie sprzed obrotu (x 10–30, y 10–16), poza obróconym – trafia tylko korzeń.
    expect(trafionyWezel(w, 25, 13)).toBe('k');
    expect(trafionyWezel(w, 200, 200)).toBeUndefined();
  });

  it('zagnieżdżony w obróconym kontenerze: wygrywa najmniejszy prostokąt po obrotach', () => {
    const s = szablon([
      {
        id: 'c',
        typ: 'swobodny',
        szerokosc: { mm: 40 },
        wysokosc: { mm: 20 },
        pozycja: { x: 10, y: 10, obrot: 90 },
        dzieci: [ik('d', { pozycja: { x: 2, y: 2 } })],
      } as Kontener,
    ]);
    const w = wezlyDla(s);
    const d = w.find((x) => x.id === 'd')!;
    // Kontener na karcie: 20 × 40 w (10, 10), środek (20, 30). Dziecko (2, 2) w jego pudełku
    // przed obrotem (x 0–40, y 20–40) ma środek (7, 27) → po obrocie o 90° wokół (20, 30): (23, 17).
    expect(prost(s, 'c')).toEqual([10, 10, 20, 40]);
    expect([d.x + d.szer / 2, d.y + d.wys / 2]).toEqual([23, 17]);
    expect(trafionyWezel(w, 23, 17)).toBe('d');
    expect(trafionyWezel(w, 11, 48)).toBe('c');
  });
});

describe('przyciąganie', () => {
  it('siatka 0,5 mm daje dokładne liczby, Alt wyłącza', () => {
    const s = szablon([ik('a')]);
    const cele = budujCele(s, wezlyDla(s), ['a']);
    expect(poz(przesunCele(cele, 4.3, 0.2, { ...BEZ, siatka: 0.5 }), 'a')).toEqual([7.5, 3]);
    expect(poz(przesunCele(cele, 4.3, 0.2, { ...BEZ, siatka: 0.5, wylacz: true }), 'a')).toEqual([
      7.3, 3.2,
    ]);
  });

  it('siatka liczona od wnętrza kontenera (z paddingiem)', () => {
    const s = szablon([ik('a', { pozycja: { x: 0, y: 0 } })], { padding: 1.25 });
    const cele = budujCele(s, wezlyDla(s), ['a']);
    // Lewy górny róg na karcie 1,25 → ruch o 2,1 daje 3,35 → siatka od 1,25: 3,25 (X = 2).
    expect(poz(przesunCele(cele, 2.1, 0, { ...BEZ, siatka: 0.5 }), 'a')[0]).toBe(2);
  });

  it('przyciąga krawędź do krawędzi rodzeństwa w progu i rysuje prowadnicę', () => {
    const s = szablon([ik('a'), ik('b', { pozycja: { x: 30, y: 40 } })]);
    const cele = budujCele(s, wezlyDla(s), ['a']);
    // Prawa krawędź a: 3 + 10 + 16,6 = 29,6 → do lewej krawędzi b (30): X = 20.
    const w = przesunCele(cele, 16.6, 0, { ...BEZ, siatka: 0.5, obiekty: true });
    expect(poz(w, 'a')[0]).toBe(20);
    expect(w.prowadnice).toEqual([{ os: 'x', polozenie: 30 }]);
    // Poza progiem (1,1 mm > 0,75) – siatka, bez prowadnicy.
    const dalej = przesunCele(cele, 15.9, 0, { ...BEZ, siatka: 0.5, obiekty: true });
    expect(poz(dalej, 'a')[0]).toBe(19);
    expect(dalej.prowadnice).toEqual([]);
  });

  it('przyciąga środek do środka karty i krawędź do krawędzi karty', () => {
    const s = szablon([ik('a')]);
    const cele = budujCele(s, wezlyDla(s), ['a']);
    // Środek a: 3 + 5 + 23,3 = 31,3 → środek karty 31,5: X = 26,5.
    const w = przesunCele(cele, 23.3, 0, { ...BEZ, obiekty: true });
    expect(poz(w, 'a')[0]).toBeCloseTo(26.5);
    expect(w.prowadnice[0]).toEqual({ os: 'x', polozenie: 31.5 });
    // Lewa krawędź blisko krawędzi karty.
    expect(poz(przesunCele(cele, -2.5, 0, { ...BEZ, obiekty: true }), 'a')[0]).toBe(0);
  });

  it('Alt wyłącza przyciąganie do obiektów i siatkę', () => {
    const s = szablon([ik('a'), ik('b', { pozycja: { x: 30, y: 40 } })]);
    const cele = budujCele(s, wezlyDla(s), ['a']);
    const w = przesunCele(cele, 16.6, 0, { siatka: 0.5, obiekty: true, prog: 0.75, wylacz: true });
    expect(poz(w, 'a')[0]).toBe(19.6);
    expect(w.prowadnice).toEqual([]);
  });

  it('wiele zaznaczonych przesuwa się razem, a grupa przyciąga się jako całość', () => {
    const s = szablon([
      ik('a'),
      ik('b', { pozycja: { x: 20, y: 3 } }),
      ik('c', { pozycja: { x: 50, y: 60 } }),
    ]);
    const cele = budujCele(s, wezlyDla(s), ['a', 'b']);
    const w = przesunCele(cele, 5, 10, { ...BEZ, siatka: 0.5 });
    expect(poz(w, 'a')).toEqual([8, 13]);
    expect(poz(w, 'b')).toEqual([25, 13]);
    // Prawa krawędź grupy (30 + dx) do lewej krawędzi c (50): dx = 20 (±0,3) → przesuniecie dokładnie do 50.
    const p = przesunCele(cele, 19.7, 0, { ...BEZ, obiekty: true });
    expect(poz(p, 'a')[0]).toBe(23);
    expect(poz(p, 'b')[0]).toBe(40);
  });

  it('przyciagnijLinie i naSiatke', () => {
    const p = przyciagnijLinie([10, 20], [10.4, 19.9, 50], 0.5)!;
    expect(p.przesuniecie).toBeCloseTo(-0.1);
    expect(p.kandydat).toBe(19.9);
    expect(przyciagnijLinie([10], [12], 0.5)).toBeUndefined();
    expect(naSiatke(7.3, 0.5)).toBe(7.5);
    expect(naSiatke(7.3, 0)).toBe(7.3);
    expect(naSiatke(3.35, 0.5, 1.25)).toBe(3.25);
  });

  it('element z obróconym przodkiem: przesunięcie z ekranu jest cofane do układu rodzica', () => {
    const s = szablon([
      {
        id: 'g',
        typ: 'swobodny',
        szerokosc: { mm: 40 },
        wysokosc: { mm: 20 },
        pozycja: { x: 10, y: 10, obrot: 90 },
        dzieci: [ik('h', { pozycja: { x: 2, y: 2 } })],
      } as Kontener,
    ]);
    const przed = prost(s, 'h');
    const cel = budujCel(s, wezlyDla(s), 'h')!;
    expect(cel.obrotPrzodkow).toBe(90);
    // Ruch na karcie 5 mm w dół to 5 mm w prawo w układzie obróconego kontenera.
    const w = przesunCele([cel], 0, 5, BEZ);
    expect(poz(w, 'h')).toEqual([7, 2]);
    const po = prost(zastosujZmiany(s, w.zmiany), 'h');
    expect(po[0]).toBeCloseTo(przed[0]!);
    expect(po[1]).toBeCloseTo(przed[1]! + 5);
  });
});

describe('zmiana rozmiaru uchwytami', () => {
  it('róg i krawędź: przeciwna krawędź stoi, rozmiar w mm', () => {
    const s = szablon([ik('a')]);
    const cel = budujCel(s, wezlyDla(s), 'a')!;
    const se = zmienRozmiar(cel, 'se', 5, 3, BEZ);
    expect(se.zmiany.get('a')).toMatchObject({
      pozycja: { x: 3, y: 3 },
      szerokosc: { mm: 15 },
      wysokosc: { mm: 13 },
    });
    const w = zmienRozmiar(cel, 'w', -4, 99, BEZ);
    expect(w.zmiany.get('a')).toMatchObject({ pozycja: { x: -1, y: 3 }, szerokosc: { mm: 14 } });
    expect(w.zmiany.get('a')!.wysokosc).toBeUndefined();
    expect(zmienRozmiar(cel, 'n', 0, 2, BEZ).zmiany.get('a')).toMatchObject({
      pozycja: { x: 3, y: 5 },
      wysokosc: { mm: 8 },
    });
  });

  it('siatka dla ruchomych krawędzi, najmniejszy rozmiar 1 mm', () => {
    const s = szablon([ik('a')]);
    const cel = budujCel(s, wezlyDla(s), 'a')!;
    expect(
      zmienRozmiar(cel, 'se', 4.8, 2.1, { ...BEZ, siatka: 0.5 }).zmiany.get('a'),
    ).toMatchObject({ szerokosc: { mm: 15 }, wysokosc: { mm: 12 } });
    const ujemny = zmienRozmiar(cel, 'e', -100, 0, BEZ).zmiany.get('a')!;
    expect(ujemny.szerokosc).toEqual({ mm: 1 });
  });

  it('Shift zachowuje proporcje: róg wg większej zmiany, krawędź wokół środka', () => {
    const s = szablon([ik('a', { szerokosc: { mm: 20 }, wysokosc: { mm: 10 } })]);
    const cel = budujCel(s, wezlyDla(s), 'a')!;
    const r = zmienRozmiar(cel, 'se', 10, 1, BEZ, true).zmiany.get('a')!;
    expect(r.szerokosc).toEqual({ mm: 30 });
    expect(r.wysokosc).toEqual({ mm: 15 });
    const e = zmienRozmiar(cel, 'e', 10, 0, BEZ, true).zmiany.get('a')!;
    expect(e.szerokosc).toEqual({ mm: 30 });
    expect(e.wysokosc).toEqual({ mm: 15 });
    expect(e.pozycja.y).toBe(0.5);
  });

  it('element obrócony o 90°: widoczna szerokość to wysokosc elementu; kotwica trzyma prawy brzeg', () => {
    const s = szablon([
      ik('a', {
        szerokosc: { mm: 20 },
        wysokosc: { mm: 6 },
        pozycja: { x: -3, y: 3, kotwica: 'prawy-gorny', obrot: 90 },
      }),
    ]);
    const przed = prost(s, 'a');
    expect(przed[0]! + przed[2]!).toBeCloseTo(60);
    const cel = budujCel(s, wezlyDla(s), 'a')!;
    const w = zmienRozmiar(cel, 'w', -4, 0, BEZ);
    const z = w.zmiany.get('a')!;
    expect(z.wysokosc).toEqual({ mm: 10 });
    expect(z.szerokosc).toBeUndefined();
    const po = prost(zastosujZmiany(s, w.zmiany), 'a');
    expect(po[2]).toBeCloseTo(10);
    expect(po[0]! + po[2]!).toBeCloseTo(60);
    expect(po[3]).toBeCloseTo(20);
  });

  it('separator zmienia tylko długość', () => {
    const s = szablon([
      {
        id: 'sep',
        typ: 'separator',
        kierunek: 'poziomy',
        szerokosc: { mm: 30 },
        pozycja: { x: 3, y: 3 },
      } as Pole,
    ]);
    const cel = budujCel(s, wezlyDla(s), 'sep')!;
    expect(cel.osie).toEqual({ szer: true, wys: false });
    const z = zmienRozmiar(cel, 'se', 5, 5, BEZ).zmiany.get('sep')!;
    expect(z.szerokosc).toEqual({ mm: 35 });
    expect(z.wysokosc).toBeUndefined();
  });

  it('budujCel: tylko dzieci kontenera swobodnego', () => {
    const s = szablon([
      { id: 'kol', typ: 'kolumna', dzieci: [ik('w')], pozycja: { x: 0, y: 0 } } as Kontener,
    ]);
    const w = wezlyDla(s);
    expect(budujCel(s, w, 'w')).toBeUndefined();
    expect(budujCel(s, w, 'kol')).toBeDefined();
    expect(budujCel(s, w, 'k')).toBeUndefined();
  });
});

describe('wyrównaj i rozłóż równo', () => {
  const trzy = szablon([
    ik('a', { pozycja: { x: 5, y: 5 }, szerokosc: { mm: 10 }, wysokosc: { mm: 10 } }),
    ik('b', { pozycja: { x: 20, y: 30 }, szerokosc: { mm: 20 }, wysokosc: { mm: 6 } }),
    ik('c', { pozycja: { x: 50, y: 12 }, szerokosc: { mm: 6 }, wysokosc: { mm: 20 } }),
  ]);
  const cele = budujCele(trzy, wezlyDla(trzy), ['a', 'b', 'c']);
  const uklad = (jak: Parameters<typeof wyrownaj>[1]) =>
    ['a', 'b', 'c'].map((id) => prost(zastosujZmiany(trzy, wyrownaj(cele, jak)), id));

  it('sześć kierunków do obwiedni zaznaczenia', () => {
    // Obwiednia: x 5–56, y 5–36.
    expect(uklad('lewo').map((r) => r[0])).toEqual([5, 5, 5]);
    expect(uklad('prawo').map((r) => r[0]! + r[2]!)).toEqual([56, 56, 56]);
    expect(uklad('srodek-poziomo').map((r) => r[0]! + r[2]! / 2)).toEqual([30.5, 30.5, 30.5]);
    expect(uklad('gora').map((r) => r[1])).toEqual([5, 5, 5]);
    expect(uklad('dol').map((r) => r[1]! + r[3]!)).toEqual([36, 36, 36]);
    expect(uklad('srodek-pionowo').map((r) => r[1]! + r[3]! / 2)).toEqual([20.5, 20.5, 20.5]);
  });

  it('pojedynczy element wyrównuje się do wnętrza kontenera', () => {
    const s = szablon([ik('a')], { padding: 2 });
    const c = budujCele(s, wezlyDla(s), ['a']);
    expect(prost(zastosujZmiany(s, wyrownaj(c, 'prawo')), 'a')[0]).toBe(51);
    expect(prost(zastosujZmiany(s, wyrownaj(c, 'srodek-poziomo')), 'a')[0]).toBe(26.5);
    expect(prost(zastosujZmiany(s, wyrownaj(c, 'dol')), 'a')[1]).toBe(76);
  });

  it('rozłóż równo: skrajne stoją, odstępy równe, kolejność wg położenia; potrzeba 3 elementów', () => {
    const z = zastosujZmiany(trzy, rozlozRowno(cele, 'poziomo'));
    const r = ['a', 'b', 'c'].map((id) => prost(z, id));
    // Rozpiętość 5–56 = 51, szerokości 10 + 20 + 6 = 36, odstęp 7,5.
    expect(r[0]![0]).toBe(5);
    expect(r[1]![0]).toBe(22.5);
    expect(r[2]![0]).toBe(50);
    expect(r[1]![0]! - (r[0]![0]! + r[0]![2]!)).toBeCloseTo(r[2]![0]! - (r[1]![0]! + r[1]![2]!));
    const p = zastosujZmiany(trzy, rozlozRowno(cele, 'pionowo'));
    // Kolejność wg Y: a (5–15), c (12–32), b (30–36): rozpiętość 31, wysokości 36, odstęp −2,5.
    expect(prost(p, 'a')[1]).toBe(5);
    expect(prost(p, 'c')[1]).toBe(12.5);
    expect(prost(p, 'b')[1]).toBe(30);
    expect(rozlozRowno(cele.slice(0, 2), 'poziomo').size).toBe(0);
  });
});

describe('jeden rodzic, rozłożenie z szerokim elementem, najmniejszy rozmiar z proporcjami', () => {
  it('ograniczDoRodzica zostawia elementy rodzica pierwszego (albo wskazanego) celu', () => {
    const s = szablon([
      ik('a'),
      {
        id: 'p',
        typ: 'swobodny',
        szerokosc: { mm: 30 },
        wysokosc: { mm: 30 },
        pozycja: { x: 20, y: 20 },
        dzieci: [ik('w')],
      } as Kontener,
    ]);
    const cele = budujCele(s, wezlyDla(s), ['a', 'w']);
    expect(ograniczDoRodzica(cele).map((c) => c.id)).toEqual(['a']);
    expect(ograniczDoRodzica(cele, 'w').map((c) => c.id)).toEqual(['w']);
    expect(ograniczDoRodzica([])).toEqual([]);
    // Gest przesuwa tylko jeden rodzic.
    expect(przesunCele(ograniczDoRodzica(cele), 2, 2, BEZ).zmiany.size).toBe(1);
  });

  it('rozłóż równo: obwiednia zostaje także, gdy szeroki element nie jest ostatni wg początku', () => {
    const s = szablon([
      ik('a', { pozycja: { x: 0, y: 3 }, szerokosc: { mm: 10 } }),
      ik('b', { pozycja: { x: 12, y: 3 }, szerokosc: { mm: 50 } }),
      ik('c', { pozycja: { x: 20, y: 3 }, szerokosc: { mm: 10 } }),
    ]);
    const z = zastosujZmiany(s, rozlozRowno(budujCele(s, wezlyDla(s), ['a', 'b', 'c']), 'poziomo'));
    const r = ['a', 'b', 'c'].map((id) => prost(z, id));
    // Obwiednia 0–62, szerokości 70 → odstęp −4; początek i koniec obwiedni bez zmian.
    expect(r[0]![0]).toBe(0);
    expect(Math.max(...r.map((x) => x[0]! + x[2]!))).toBe(62);
    expect(r[1]![0]! - (r[0]![0]! + r[0]![2]!)).toBeCloseTo(r[2]![0]! - (r[1]![0]! + r[1]![2]!));
  });

  it('Shift: najmniejszy rozmiar 1 mm dla obu osi', () => {
    const s = szablon([ik('a', { szerokosc: { mm: 20 }, wysokosc: { mm: 2 } })]);
    const cel = budujCel(s, wezlyDla(s), 'a')!;
    const z = zmienRozmiar(cel, 'e', -19.5, 0, BEZ, true).zmiany.get('a')!;
    // Szerokość 0,5 → po proporcjach 0,05 wysokości: obie osie podniesione do ≥ 1 mm.
    expect(z.szerokosc!.mm).toBeGreaterThanOrEqual(1);
    expect(z.wysokosc!.mm).toBeGreaterThanOrEqual(1);
    expect(z.szerokosc!.mm / z.wysokosc!.mm).toBeCloseTo(10);
  });
});

it('skaluje grupę z Shift, zachowując procentową szerokość i wysokość wg treści', () => {
  const s = szablon([
    ik('a'),
    ik('b', { szerokosc: { procent: 20 }, wysokosc: 'auto', pozycja: { x: 23, y: 23 } }),
  ]);
  const cele = budujCele(s, wezlyDla(s), ['a', 'b']);
  const cel = celSkalowania(cele)!;
  const w = zmienRozmiarGrupy(s, cele, cel, 'se', cel.rect.szer, 0, BEZ, true);
  expect(w.zmiany.get('a')).toMatchObject({ szerokosc: { mm: 20 }, wysokosc: { mm: 20 } });
  expect(w.zmiany.get('b')).toEqual({ pozycja: { x: 43, y: 43 } });
});

it('upuszcza z zachowaniem chwytu i paddingu, pomija własne poddrzewo i obrócone cele', () => {
  const s = szablon([
    {
      id: 'a',
      typ: 'kolumna',
      pozycja: { x: 3, y: 3 },
      szerokosc: { mm: 20 },
      wysokosc: { mm: 20 },
      dzieci: [{ id: 'potomek', typ: 'kolumna', dzieci: [ik('i')] }],
    },
    {
      id: 'b',
      typ: 'swobodny',
      pozycja: { x: 27, y: 30 },
      szerokosc: { mm: 30 },
      wysokosc: { mm: 30 },
      padding: 2,
      dzieci: [],
    },
    {
      id: 'obrocony',
      typ: 'swobodny',
      pozycja: { x: 3, y: 60, obrot: 90 },
      szerokosc: { mm: 14 },
      wysokosc: { mm: 14 },
      dzieci: [{ id: 'wnetrze', typ: 'kolumna', dzieci: [ik('j')] }],
    },
  ]);
  const cel = przygotujUpuszczenie(s, wezlyDla(s), 'a', { x: 8, y: 8 })!;
  expect(cel({ x: 8, y: 8 })).toBeUndefined();
  expect(cel({ x: 8, y: 65 })).toBeUndefined();
  const w = cel({ x: 39, y: 42 })!;
  expect(w).toMatchObject({ rodzicId: 'b', pozycja: { x: 5, y: 5 } });
  const przeniesiony = upuscWezel(s, w);
  expect(przeniesiony.korzen.dzieci.find((d) => d.id === 'b')).toMatchObject({
    dzieci: [{ id: 'a', pozycja: { x: 5, y: 5 } }],
  });
});

it('przy kącie 45° sprawdza właściwy kształt, kotwicę, dociągnięcie i rozmiar w osi pola', () => {
  const s = szablon([
    ik('a', { szerokosc: { mm: 20 }, wysokosc: { mm: 4 }, pozycja: { x: 10, y: 12, obrot: 45 } }),
  ]);
  const w = wezlyDla(s);
  const cel = budujCel(s, w, 'a')!;
  const bok = 24 / Math.sqrt(2);
  expect(cel.rect.x).toBeCloseTo(10);
  expect(cel.rect.y).toBeCloseTo(12);
  expect(cel.rect.szer).toBeCloseTo(bok);
  expect(trafionyWezel(w, 10.1, 12 + bok - 0.1)).toBe('k');
  expect(trafionyWezel(w, 10 + bok / 2, 12 + bok / 2)).toBe('a');
  const przyciagniecie = przesunCele([cel], -9.7, 0, { ...BEZ, obiekty: true });
  expect(poz(przyciagniecie, 'a')[0]).toBe(0);
  const ruch = 5 / Math.sqrt(2);
  const { zmiany } = zmienRozmiar(cel, 'e', ruch, ruch, BEZ);
  expect(zmiany.get('a')?.szerokosc).toEqual({ mm: 25 });
  expect(zmiany.get('a')?.wysokosc).toBeUndefined();
  expect(zmiany.get('a')?.pozycja.x).toBeCloseTo(10);
  expect(zmiany.get('a')?.pozycja.y).toBeCloseTo(12);
});

it('wydłuża cienki obrócony separator bez zmiany przeciwległej krawędzi', () => {
  const s = szablon([
    {
      id: 'linia',
      typ: 'separator',
      kierunek: 'poziomy',
      kolor: '#000000',
      grubosc: 0.3,
      szerokosc: { mm: 20 },
      wysokosc: { mm: 0.3 },
      pozycja: { x: 10, y: 12, obrot: 45 },
    },
  ]);
  const cel = budujCel(s, wezlyDla(s), 'linia')!;
  expect(cel.lokalne?.wys).toBeCloseTo(0.3);
  const d = 5 / Math.sqrt(2);
  const zmiana = zmienRozmiar(cel, 'e', d, d, BEZ).zmiany.get('linia')!;
  expect(zmiana.szerokosc).toEqual({ mm: 25 });
  expect(zmiana.wysokosc).toBeUndefined();
  expect(zmiana.pozycja).toMatchObject({ x: 10, y: 12, obrot: 45 });
});
