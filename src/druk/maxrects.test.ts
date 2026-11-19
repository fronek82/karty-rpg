import { expect, it } from 'vitest';
import { ulozMaxRects } from './maxrects';
import type { KartaDoPasow, OpcjePasow } from './pasy';

const karta = (klucz: string, szer: number, wys: number, grupaId?: string): KartaDoPasow => ({
  klucz,
  kartaId: klucz,
  numer: 0,
  szer,
  wys,
  ...(grupaId ? { grupaId } : {}),
});
const opcje: OpcjePasow = {
  obszar: { szer: 100, wys: 100 },
  odstep: 2,
  obracaj: true,
  grupujRozmiary: false,
  kolejnosc: 'najwieksze',
};

it('wypełnia wnękę, obraca karty i omija zbyt duży format', () => {
  const karty = [
    karta('wąska', 30, 96),
    karta('pozioma', 96, 16),
    karta('kwadrat', 45, 45),
    karta('mała', 44, 10),
    karta('za duża', 110, 111),
  ];
  const wynik = ulozMaxRects(karty, opcje);
  expect(wynik).toEqual(ulozMaxRects(karty, opcje));
  expect(wynik.liczbaStron).toBe(1);
  expect(wynik.karty).toHaveLength(4);
  expect(wynik.pominiete).toEqual(['za duża']);
  expect(wynik.karty.find((k) => k.klucz === 'pozioma')?.obrocona).toBe(true);
  for (const [i, a] of wynik.karty.entries()) {
    expect(a.x + a.szer).toBeLessThanOrEqual(100);
    expect(a.y + a.wys).toBeLessThanOrEqual(100);
    for (const b of wynik.karty.slice(i + 1))
      expect(
        Math.max(b.x - a.x - a.szer, a.x - b.x - b.szer, b.y - a.y - a.wys, a.y - b.y - b.wys),
      ).toBeGreaterThanOrEqual(opcje.odstep);
  }
});

it('zachowuje własną kolejność w grupach i rezerwuje nagłówki po przejściu na kolejną stronę', () => {
  const wynik = ulozMaxRects(
    [
      karta('pierwsza', 60, 65, 'g1'),
      { ...karta('dalsza', 60, 65, 'g1'), czesc: 1 },
      karta('trzecia', 45, 30, 'g2'),
      karta('czwarta', 20, 50, 'g2'),
    ],
    {
      ...opcje,
      obracaj: false,
      kolejnosc: 'wlasna',
      grupy: [
        { id: 'g1', naglowek: 12 },
        { id: 'g2', naglowek: 9 },
      ],
    },
  );
  expect(wynik.karty.map((k) => k.klucz)).toEqual(['pierwsza', 'dalsza', 'trzecia', 'czwarta']);
  expect(wynik.karty[1]).toMatchObject({ czesc: 1, strona: 1, y: 0 });
  expect(wynik.pasy.flatMap((p) => p.naglowek ?? []).map((n) => n.grupaId)).toEqual(['g1', 'g2']);
  expect(wynik.karty[2]).toMatchObject({ strona: 2, y: 9 });
});

it('kolejność od największych nie przesuwa ciągu dalszego przed kartę źródłową', () => {
  const oryginal = karta('opis#0', 14, 75);
  const wynik = ulozMaxRects(
    [karta('inna#0', 53, 77), oryginal, { ...oryginal, klucz: 'opis#1', numer: 1, czesc: 1 }],
    opcje,
  );
  expect(wynik.karty.filter((k) => k.kartaId === oryginal.kartaId).map((k) => k.numer)).toEqual([
    0, 1,
  ]);
});
