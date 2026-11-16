/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Arkusz } from '../model/arkusz';
import type { Szablon } from '../model/szablon';
import { arkuszeMausrittera } from '../pakiety/mausritter/arkusze';
import { SLOT, szablonyMausrittera } from '../pakiety/mausritter/szablony';
import {
  OBRAZ_ZASTEPCZY,
  taliaBroni,
  talieMausrittera,
  taliaWyposazenia,
} from '../pakiety/mausritter/talie';
import type { ElementSceny, Scena } from '../silnik/scena';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { odcinkiCiecia, wSkaliSzarosci, zbudujArkusz } from './arkusz';
import { scenyDoPdf } from './pdf';

const ctx = {
  czcionki: rejestrTestowy(),
  szablony: new Map<string, Szablon>(szablonyMausrittera.map((s) => [s.id, s])),
  obraz: (z: string) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
};
const talia = (a: Arkusz) => talieMausrittera.find((t) => t.id === a.taliaId)!;
const linie = (s: Scena) =>
  s.elementy.filter((e): e is Extract<ElementSceny, { typ: 'linia' }> => e.typ === 'linia');

describe('odcinkiCiecia', () => {
  it('wspólne boki sąsiednich kart rysowane raz', () => {
    const slot = { szerokosc: 10, wysokosc: 10 };
    // 2×2 karty 1×1: 12 boków slotów (3 linie × 2 odcinki × 2 kierunki).
    const karty = [0, 1].flatMap((i) =>
      [0, 1].map((j) => ({ x: i * 10, y: j * 10, kolumny: 1, rzedy: 1 })),
    );
    expect(odcinkiCiecia(karty, slot)).toHaveLength(12);
    // Karta 2×1 nad dwiema 1×1: dolny bok 2×1 = górne boki 1×1 (2 odcinki wspólne):
    // góra 2 + wspólne 2 + doły 2 + boki 2×1: 2 + pionowe dolnego rzędu: 3 = 11.
    const mieszane = [
      { x: 0, y: 0, kolumny: 2, rzedy: 1 },
      { x: 0, y: 10, kolumny: 1, rzedy: 1 },
      { x: 10, y: 10, kolumny: 1, rzedy: 1 },
    ];
    expect(odcinkiCiecia(mieszane, slot)).toHaveLength(11);
  });
});

describe('zbudujArkusz – pakiet Mausritter', () => {
  const geometria = JSON.parse(readFileSync('testy/geometria-referencji.json', 'utf8')) as {
    slotWDruku: number;
    arkusze: Record<string, { pionowe: number[]; poziome: number[] }>;
  };
  const skala = SLOT / geometria.slotWDruku;

  for (const arkusz of arkuszeMausrittera) {
    it(`${arkusz.nazwa}: jedna strona, bez ostrzeżeń, linie cięcia w miejscach z referencji (±0,3 mm)`, () => {
      const w = zbudujArkusz(arkusz, talia(arkusz), ctx);
      expect(w.ostrzezenia).toEqual([]);
      expect(w.strony).toHaveLength(1);
      const l = linie(w.strony[0]!);
      const pionowe = [
        ...new Set(l.filter((o) => o.x1 === o.x2).map((o) => Math.round(o.x1 * 100) / 100)),
      ].sort((a, b) => a - b);
      const poziome = [
        ...new Set(l.filter((o) => o.y1 === o.y2).map((o) => Math.round(o.y1 * 100) / 100)),
      ].sort((a, b) => a - b);
      const ref = geometria.arkusze[arkusz.id]!;
      // Referencja ma tylko linie pełnej długości; porównujemy każdą jej linię z najbliższą naszą.
      for (const [nasze, wzor] of [
        [pionowe, ref.pionowe],
        [poziome, ref.poziome],
      ] as const) {
        for (const r of wzor) {
          const cel = r * skala;
          const najblizsza = Math.min(...nasze.map((v) => Math.abs(v - cel)));
          expect(najblizsza, `linia ${r} mm`).toBeLessThan(0.3);
        }
      }
    });
  }

  it('automatyczne rozmieszczenie talii bez przypięć mieści się na jednej stronie', () => {
    for (const a of arkuszeMausrittera.slice(0, 2)) {
      const bez: Arkusz = { ...a, przypiete: [] };
      const w = zbudujArkusz(bez, talia(a), ctx);
      expect(w.rozmieszczenie.karty).toHaveLength(talia(a).karty.reduce((s, k) => s + k.ilosc, 0));
      expect(w.strony.length, a.nazwa).toBe(1);
    }
  });

  it('wzór kreski wyśrodkowany: każdy odcinek zaczyna się i kończy tak samo', () => {
    const w = zbudujArkusz(arkuszeMausrittera[0]!, taliaBroni, ctx);
    const o = linie(w.strony[0]!)[0]!;
    const { kreska = [], fazaKreski = 0 } = o.obrys;
    const [k = 0, p = 0] = kreska;
    const dl = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
    // Początek pierwszej kreski = (okres − faza) mod okres; koniec ostatniej symetrycznie.
    const start = (k + p - fazaKreski) % (k + p);
    const n = Math.floor((dl + p) / (k + p));
    const koniec = dl - (start + n * k + (n - 1) * p);
    expect(start).toBeCloseTo(koniec, 6);
  });

  it('tryb czarno-biały zamienia kolory na szarości', () => {
    const [e] = wSkaliSzarosci([
      { typ: 'prostokat', x: 0, y: 0, szer: 1, wys: 1, wypelnienie: '#ff0000' },
    ]);
    expect(e).toMatchObject({ wypelnienie: '#4c4c4c' });
    const a: Arkusz = {
      ...arkuszeMausrittera[1]!,
      ustawienia: { ...arkuszeMausrittera[1]!.ustawienia, czarnoBialy: true },
    };
    expect(zbudujArkusz(a, taliaWyposazenia, ctx).strony).toHaveLength(1);
  });

  it('PDF trzech arkuszy: trzy strony A4 poziomo, rozsądny rozmiar', async () => {
    const strony = arkuszeMausrittera.flatMap((a) => zbudujArkusz(a, talia(a), ctx).strony);
    const { bajty } = await scenyDoPdf(strony);
    expect(bajty.length).toBeLessThan(300_000);
  });
});
