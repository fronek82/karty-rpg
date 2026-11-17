import { describe, expect, it } from 'vitest';
import {
  odcinkiCieciaProstokatow,
  posortujOdNajwiekszych,
  ulozPasy,
  type KartaDoPasow,
  type OpcjePasow,
} from './pasy';

const karta = (id: string, numer: number, szer: number, wys: number, grupaId?: string) =>
  ({
    klucz: `${id}#${numer}`,
    kartaId: id,
    numer,
    szer,
    wys,
    ...(grupaId ? { grupaId } : {}),
  }) satisfies KartaDoPasow;
const kopie = (id: string, n: number, szer: number, wys: number, grupaId?: string) =>
  Array.from({ length: n }, (_, i) => karta(id, i, szer, wys, grupaId));

const A4: OpcjePasow = {
  obszar: { szer: 190, wys: 277 },
  odstep: 0,
  obracaj: false,
  grupujRozmiary: true,
  kolejnosc: 'najwieksze',
};

/** Przykład E(1): 2× 70×120, 3× 63×88, 5× 44×68. */
const przykladE = () => [
  ...kopie('arkana', 2, 70, 120),
  ...kopie('czar', 3, 63, 88),
  ...kopie('przedmiot', 5, 44, 68),
];

const nachodza = (
  a: { x: number; y: number; szer: number; wys: number; strona: number },
  b: typeof a,
) =>
  a.strona === b.strona &&
  a.x < b.x + b.szer - 1e-6 &&
  b.x < a.x + a.szer - 1e-6 &&
  a.y < b.y + b.wys - 1e-6 &&
  b.y < a.y + a.wys - 1e-6;

function sprawdzPoprawnosc(w: ReturnType<typeof ulozPasy>, o: OpcjePasow, ile: number) {
  expect(w.karty).toHaveLength(ile - w.pominiete.length);
  for (const [i, a] of w.karty.entries()) {
    expect(a.x).toBeGreaterThanOrEqual(-1e-6);
    expect(a.y).toBeGreaterThanOrEqual(-1e-6);
    expect(a.x + a.szer).toBeLessThanOrEqual(o.obszar.szer + 1e-6);
    expect(a.y + a.wys).toBeLessThanOrEqual(o.obszar.wys + 1e-6);
    for (const b of w.karty.slice(i + 1)) expect(nachodza(a, b)).toBe(false);
  }
}

describe('ulozPasy', () => {
  it('przykład E(1): trzy pasy na jednej stronie, bez nakładania, wszystkie sztuki', () => {
    const w = ulozPasy(przykladE(), A4);
    sprawdzPoprawnosc(w, A4, 10);
    expect(w.liczbaStron).toBe(1);
    expect(w.pasy.map((p) => p.wys)).toEqual([120, 88, 68]);
    expect(w.pasy.map((p) => p.y)).toEqual([0, 120, 208]);
    // Pas 1: dwie Arkany i jeden Przedmiot (44 mm mieści się obok 2 × 70).
    const pas0 = w.karty.filter((k) => k.pas === 0);
    expect(pas0.map((k) => k.kartaId)).toEqual(['arkana', 'arkana', 'przedmiot']);
    expect(pas0.map((k) => k.x)).toEqual([0, 70, 140]);
    expect(w.karty.filter((k) => k.pas === 1)).toHaveLength(3);
    expect(w.karty.filter((k) => k.pas === 2)).toHaveLength(4);
  });

  it('wolne miejsca: pod niższą kartą pasa i reszta strony', () => {
    const w = ulozPasy(przykladE(), A4);
    const pod = w.wolne.find((x) => x.x === 140 && x.y === 68);
    expect(pod).toMatchObject({ szer: 44, wys: 52 });
    const dol = w.wolne.find((x) => x.x === 0 && x.y === 276);
    expect(dol).toBeUndefined(); // 1 mm – za mało
  });

  it('kolejność „najwięksi najpierw” nie zależy od kolejności wejścia', () => {
    const a = ulozPasy(przykladE(), A4);
    const b = ulozPasy([...przykladE()].reverse(), A4);
    expect(b.karty.map((k) => [k.kartaId, k.x, k.y]).sort()).toEqual(
      a.karty.map((k) => [k.kartaId, k.x, k.y]).sort(),
    );
    expect(posortujOdNajwiekszych([karta('a', 0, 10, 10), karta('b', 0, 20, 10)])[0]!.kartaId).toBe(
      'b',
    );
  });

  it('grupowanie rozmiarów: karta tej samej wysokości idzie do pasa z takimi kartami', () => {
    // Pas 1 (wys 100): 100×100, pas 2 (wys 60): 150×60. Karta 40×60 ma trafić do pasa 2, choć
    // zmieściłaby się też w pasie 1.
    const karty = [karta('a', 0, 100, 100), karta('b', 0, 150, 60), karta('c', 0, 40, 60)];
    const z = ulozPasy(karty, { ...A4, grupujRozmiary: true });
    expect(z.karty.find((k) => k.kartaId === 'c')!.pas).toBe(1);
    const bez = ulozPasy(karty, { ...A4, grupujRozmiary: false });
    expect(bez.karty.find((k) => k.kartaId === 'c')!.pas).toBe(0);
  });

  it('nowa strona, gdy kolejny pas się nie mieści', () => {
    const karty = kopie('duza', 3, 190, 120);
    const w = ulozPasy(karty, A4);
    sprawdzPoprawnosc(w, A4, 3);
    expect(w.liczbaStron).toBe(2);
    expect(w.karty.map((k) => k.strona)).toEqual([0, 0, 1]);
    expect(w.karty[2]!.y).toBe(0);
  });

  it('układanie pod niższą, węższą kartą pasa, gdy na końcu pasa brak miejsca', () => {
    const o = { ...A4, obszar: { szer: 100, wys: 200 }, grupujRozmiary: false };
    const karty = [
      karta('c', 0, 60, 100),
      karta('d', 0, 40, 30),
      karta('e', 0, 40, 30),
      karta('f', 0, 70, 30),
    ];
    const w = ulozPasy(karty, o);
    sprawdzPoprawnosc(w, o, 4);
    const poz = (id: string) => w.karty.find((k) => k.kartaId === id)!;
    // c 60×100 w pasie 0; f 70×30 (najszersza z niskich) nie mieści się ani obok c, ani pod nim →
    // nowy pas; d obok c; e nie mieści się na końcu żadnego pasa → pod d.
    expect([poz('d').x, poz('d').y, poz('d').pas]).toEqual([60, 0, 0]);
    expect([poz('e').x, poz('e').y, poz('e').pas]).toEqual([60, 30, 0]);
    expect(poz('f')).toMatchObject({ x: 0, y: 100, pas: 1 });
  });

  it('kolejność własna: układanie pod kartą tylko w ostatnim pasie grupy', () => {
    const o = { ...A4, obszar: { szer: 100, wys: 200 }, kolejnosc: 'wlasna' as const };
    const karty = [karta('c', 0, 60, 100), karta('d', 0, 40, 30), karta('e', 0, 40, 30)];
    const w = ulozPasy(karty, o);
    expect(w.karty.find((k) => k.kartaId === 'e')).toMatchObject({ pas: 0, x: 60, y: 30 });
    // Kolejna karta po nowym pasie nie wraca pod karty pasa 0.
    const w2 = ulozPasy([...karty, karta('f', 0, 90, 50), karta('g', 0, 10, 10)], o);
    expect(w2.karty.find((k) => k.kartaId === 'g')).toMatchObject({ pas: 1, x: 90, y: 100 });
    expect(w2.wolne.some((x) => x.x === 60 && x.y === 60 && x.strona === 0)).toBe(false);
  });

  it('widoczna kolejność odtwarza ten sam układ w trybie własnym (także z układaniem pod kartami)', () => {
    const zestawy: [KartaDoPasow[], OpcjePasow][] = [
      [przykladE(), A4],
      [[...przykladE(), ...kopie('zeton', 3, 40, 40)], A4],
      [
        [
          karta('c', 0, 60, 100),
          karta('d', 0, 40, 30),
          karta('e', 0, 40, 30),
          karta('f', 0, 70, 30),
        ],
        { ...A4, obszar: { szer: 100, wys: 200 }, grupujRozmiary: false },
      ],
    ];
    for (const [karty, o] of zestawy) {
      const a = ulozPasy(karty, o);
      const kolejnosc = [...new Set(a.karty.map((k) => k.kartaId))];
      // Wejście: egzemplarze w widocznej kolejności (po pasach).
      const byKlucz = new Map(karty.map((k) => [k.klucz, k]));
      const wejscie = a.karty.map((k) => byKlucz.get(k.klucz)!);
      expect(kolejnosc.length).toBeGreaterThan(0);
      const w = ulozPasy(wejscie, { ...o, kolejnosc: 'wlasna' });
      const poz = (r: typeof a) =>
        Object.fromEntries(r.karty.map((k) => [k.klucz, [k.strona, k.x, k.y, k.obrocona]]));
      expect(poz(w)).toEqual(poz(a));
    }
  });

  it('obracanie: karta mieszcząca się nieobrócona w kolumnie pod inną kartą nie jest obracana', () => {
    const o = { ...A4, obszar: { szer: 130, wys: 200 }, obracaj: true, grupujRozmiary: false };
    // e 40×30 nie mieści się na końcu pasa (100 + 40 > 130), a obrócona 30×40 – tak; mimo to
    // wybieramy układanie bez obrotu pod d (50 + 30 ≤ 100).
    const w = ulozPasy([karta('c', 0, 60, 100), karta('d', 0, 40, 50), karta('e', 0, 40, 30)], o);
    expect(w.karty.find((k) => k.kartaId === 'e')).toMatchObject({ obrocona: false, x: 60, y: 50 });
  });

  it('po nowej stronie karty nie wracają do pasów poprzedniej', () => {
    const o = { ...A4, odstep: 2 };
    const w = ulozPasy(przykladE(), o);
    sprawdzPoprawnosc(w, o, 10);
    expect(w.liczbaStron).toBe(2);
    expect(w.karty.every((k) => k.pas >= 0)).toBe(true);
    // Strona 2 nie ma miejsca w pasach strony 1 – pasy mają numery od 0 na każdej stronie.
    expect(w.pasy.filter((p) => p.strona === 1)).toHaveLength(2);
  });

  it('karta większa niż strona jest pominięta, reszta się układa', () => {
    const w = ulozPasy([karta('ogromna', 0, 300, 400), karta('mala', 0, 50, 50)], A4);
    expect(w.pominiete).toEqual(['ogromna#0']);
    expect(w.karty.map((k) => k.kartaId)).toEqual(['mala']);
  });

  it('odstęp między kartami i pasami', () => {
    const o = { ...A4, odstep: 0.5 };
    const w = ulozPasy(przykladE(), o);
    sprawdzPoprawnosc(w, o, 10);
    expect(w.karty.filter((k) => k.pas === 0).map((k) => k.x)).toEqual([0, 70.5, 141]);
    expect(w.pasy.map((p) => p.y)).toEqual([0, 120.5, 209]);
  });

  describe('obracanie', () => {
    it('wyłączone – karta szersza niż obszar nie jest obracana', () => {
      const w = ulozPasy([karta('lezaca', 0, 250, 100)], A4);
      expect(w.pominiete).toEqual(['lezaca#0']);
    });
    it('włączone – karta obracana, gdy nie mieści się w normalnej orientacji', () => {
      const o = { ...A4, obracaj: true };
      const w = ulozPasy([karta('lezaca', 0, 250, 100)], o);
      expect(w.pominiete).toEqual([]);
      expect(w.karty[0]).toMatchObject({ obrocona: true, szer: 100, wys: 250 });
    });
    it('włączone – obrócona karta wypełnia pas, w którym normalna się nie mieści', () => {
      const o = { ...A4, obracaj: true };
      // Pas wys. 100; kolejne 100×60 nie mieści się w pasie 100 szer. (zostaje 30), ale obrócona 60×100 – tak.
      const w = ulozPasy(
        [karta('a', 0, 160, 100), karta('b', 0, 20, 100), karta('c', 0, 100, 30)],
        {
          ...o,
          obszar: { szer: 190, wys: 140 },
        },
      );
      const c = w.karty.find((k) => k.kartaId === 'c')!;
      expect(c.obrocona).toBe(false); // zmieści się w pasie 100 × 30 mm (10 mm miejsca? nie) -> nowy pas
      expect(w.karty.every((k) => k.y + k.wys <= 140 + 1e-6)).toBe(true);
    });
    it('włączone, ale niepotrzebne – karty zostają nieobrócone', () => {
      const w = ulozPasy(przykladE(), { ...A4, obracaj: true });
      expect(w.karty.some((k) => k.obrocona)).toBe(false);
    });
  });

  describe('kolejność własna', () => {
    it('karty dokładnie w kolejności wejścia, bez wypełniania wcześniejszych pasów', () => {
      const karty = [karta('a', 0, 100, 50), karta('b', 0, 100, 80), karta('c', 0, 40, 40)];
      const w = ulozPasy(karty, { ...A4, kolejnosc: 'wlasna' });
      // a (pas 0), b nie mieści się w pasie 50 → pas 1 (wys 80), c w pasie 1 (nie wraca do pasa 0).
      expect(w.karty.map((k) => [k.kartaId, k.pas, k.x])).toEqual([
        ['a', 0, 0],
        ['b', 1, 0],
        ['c', 1, 100],
      ]);
    });
    it('zmiana kolejności zmienia układ i nigdy nie powoduje nakładania', () => {
      const karty = przykladE();
      const w = ulozPasy([...karty].reverse(), { ...A4, kolejnosc: 'wlasna' });
      sprawdzPoprawnosc(w, A4, 10);
    });
  });

  describe('grupy talii', () => {
    it('każda grupa zaczyna nowy pas z miejscem na nagłówek', () => {
      const karty = [...kopie('a', 2, 60, 50, 'g1'), ...kopie('b', 2, 60, 50, 'g2')];
      const o = {
        ...A4,
        grupy: [
          { id: 'g1', naglowek: 10 },
          { id: 'g2', naglowek: 12 },
        ],
      };
      const w = ulozPasy(karty, o);
      sprawdzPoprawnosc(w, o, 4);
      // Grupy nie dzielą pasa mimo wolnego miejsca.
      expect(w.pasy).toHaveLength(2);
      expect(w.pasy[0]).toMatchObject({ y: 10, naglowek: { y: 0, wys: 10, grupaId: 'g1' } });
      expect(w.pasy[1]).toMatchObject({ y: 72, naglowek: { y: 60, wys: 12, grupaId: 'g2' } });
    });
    it('karty bez grupy idą po grupach, bez nagłówka', () => {
      const karty = [karta('wolna', 0, 50, 50), karta('a', 0, 50, 50, 'g1')];
      const w = ulozPasy(karty, { ...A4, grupy: [{ id: 'g1', naglowek: 8 }] });
      expect(w.karty.map((k) => k.kartaId)).toEqual(['a', 'wolna']);
      expect(w.pasy[1]!.naglowek).toBeUndefined();
    });
    it('grupa, której nagłówek z pierwszym pasem się nie mieści, zaczyna nową stronę', () => {
      const karty = [karta('a', 0, 50, 260, 'g1'), karta('b', 0, 50, 50, 'g2')];
      const w = ulozPasy(karty, {
        ...A4,
        grupy: [
          { id: 'g1', naglowek: 5 },
          { id: 'g2', naglowek: 20 },
        ],
      });
      expect(w.karty.find((k) => k.kartaId === 'b')).toMatchObject({ strona: 1, y: 20 });
    });
  });

  it('deterministyczność: dwa wywołania dają ten sam wynik', () => {
    expect(ulozPasy(przykladE(), A4)).toEqual(ulozPasy(przykladE(), A4));
  });
});

describe('odcinkiCieciaProstokatow', () => {
  it('wspólna krawędź sąsiednich kart to jedna linia', () => {
    const o = odcinkiCieciaProstokatow([
      { x: 0, y: 0, szer: 60, wys: 80 },
      { x: 60, y: 0, szer: 60, wys: 80 },
    ]);
    // 2 poziome (góra i dół, każda scalona na 120 mm) + 3 pionowe.
    expect(o.filter((s) => s.y1 === s.y2)).toEqual([
      { x1: 0, y1: 0, x2: 120, y2: 0 },
      { x1: 0, y1: 80, x2: 120, y2: 80 },
    ]);
    expect(o.filter((s) => s.x1 === s.x2).map((s) => s.x1)).toEqual([0, 60, 120]);
  });
  it('karty różnej wysokości: krawędź pionowa scalona, poziome osobno', () => {
    const o = odcinkiCieciaProstokatow([
      { x: 0, y: 0, szer: 70, wys: 120 },
      { x: 70, y: 0, szer: 44, wys: 68 },
    ]);
    expect(o).toContainEqual({ x1: 70, y1: 0, x2: 70, y2: 120 });
    expect(o).toContainEqual({ x1: 70, y1: 68, x2: 114, y2: 68 });
    expect(o.filter((s) => s.x1 === 70 && s.x2 === 70)).toHaveLength(1);
  });
  it('odstęp między kartami: obrysy osobne', () => {
    const o = odcinkiCieciaProstokatow([
      { x: 0, y: 0, szer: 60, wys: 80 },
      { x: 62, y: 0, szer: 60, wys: 80 },
    ]);
    expect(o).toHaveLength(8);
  });
  it('przykład E(1): każdy odcinek tylko raz', () => {
    const w = ulozPasy(przykladE(), A4);
    const o = odcinkiCieciaProstokatow(w.karty);
    const klucze = o.map((s) => `${s.x1},${s.y1},${s.x2},${s.y2}`);
    expect(new Set(klucze).size).toBe(klucze.length);
    // Linia pod pierwszym pasem (y = 120) biegnie przez cały pas jako jedna.
    expect(o).toContainEqual({ x1: 0, y1: 120, x2: 189, y2: 120 });
  });
});
