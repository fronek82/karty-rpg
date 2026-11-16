import { describe, expect, it } from 'vitest';
import { slotPodPunktem, stylProstokata, type Geometria } from './geometria';

const g: Geometria = {
  poczatekSiatki: { x: 10, y: 20 },
  slot: { szerokosc: 25, wysokosc: 25 },
  siatka: { kolumny: 4, rzedy: 3, grupy: false },
  // Odstęp 5 mm przed kolumną 2 na stronie 0.
  odstepKolumny: (s, k) => (s === 0 && k >= 2 ? 5 : 0),
  szer: 200,
  wys: 100,
};

describe('geometria warstwy kartki', () => {
  it('slot pod punktem z odstępem grup; poza siatką i w odstępie – brak', () => {
    expect(slotPodPunktem(g, 0, 11, 21)).toEqual({ kolumna: 0, rzad: 0 });
    expect(slotPodPunktem(g, 0, 61, 46)).toBeUndefined(); // w odstępie 60–65
    expect(slotPodPunktem(g, 0, 66, 46)).toEqual({ kolumna: 2, rzad: 1 });
    expect(slotPodPunktem(g, 1, 61, 46)).toEqual({ kolumna: 2, rzad: 1 }); // inna strona – bez odstępu
    expect(slotPodPunktem(g, 0, 5, 10)).toBeUndefined();
    expect(slotPodPunktem(g, 0, 5, 10, true)).toEqual({ kolumna: 0, rzad: 0 });
    expect(slotPodPunktem(g, 0, 500, 500, true)).toEqual({ kolumna: 3, rzad: 2 });
  });

  it('prostokąt w procentach strony', () => {
    expect(stylProstokata(g, 0, 2, 1, 1, 2)).toEqual({
      left: '32.5%',
      top: '45%',
      width: '12.5%',
      height: '50%',
    });
  });
});
