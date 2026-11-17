/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { wymiaryUkladu, type Arkusz, type UkladArkusza } from '../model/arkusz';
import { ustawieniaKartkiDla } from '../dane/wlasneKarty';
import { daneCzaru, szablonCzaru, szablonStatystyk } from '../silnik/__testy__/przyklady';
import type { Szablon, Talia } from '../model/szablon';
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
import {
  odcinkiCiecia,
  przesunScene,
  stronaTestowa,
  wSkaliSzarosci,
  zbudujArkusz,
  zSzarymiObrazami,
} from './arkusz';
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

describe('zbudujArkusz – tytuł, nożyczki, linie', () => {
  const grupa = (s: Scena, i: number) => s.elementy.filter((e) => e.typ === 'grupa')[i]!;
  const scissors = (s: Scena) =>
    s.elementy.find(
      (e): e is Extract<ElementSceny, { typ: 'grupa' }> =>
        e.typ === 'grupa' && e.elementy.length === 1 && e.elementy[0]!.typ === 'sciezka',
    )!;

  it('tytuł pionowy: obrót −90°, początek przy dolnej krawędzi siatki, na lewo od siatki', () => {
    const a = arkuszeMausrittera[0]!;
    const w = zbudujArkusz(a, taliaBroni, ctx);
    const s = w.strony[0]!;
    const tytul = s.elementy.find((e) => e.typ === 'grupa' && e.obrot === -90);
    expect(tytul).toBeDefined();
    if (tytul?.typ !== 'grupa') return;
    expect(tytul.y).toBeCloseTo(w.poczatekSiatki.y + 7 * SLOT, 6);
    expect(tytul.x).toBeLessThan(w.poczatekSiatki.x);
    expect(grupa(s, 0).typ).toBe('grupa');
  });

  it('nożyczki leżą na rzeczywistej linii cięcia także przy grupach z odstępami', () => {
    const a = arkuszeMausrittera[2]!;
    for (const indeks of [2, 5, 9]) {
      const w = zbudujArkusz(
        { ...a, ustawienia: { ...a.ustawienia, nozyczki: { ...a.ustawienia.nozyczki!, indeks } } },
        talia(a),
        ctx,
      );
      const s = w.strony[0]!;
      const xs = [
        ...new Set(
          linie(s)
            .filter((o) => o.x1 === o.x2)
            .map((o) => Math.round(o.x1 * 1000) / 1000),
        ),
      ].sort((p, q) => p - q);
      expect(scissors(s).x).toBeCloseTo(xs[indeks]!, 3);
    }
  });

  it('nożyczki na końcu przerywanej linii prowadzącej do krawędzi siatki', () => {
    const a = arkuszeMausrittera[1]!;
    const w = zbudujArkusz(a, taliaWyposazenia, ctx);
    const s = w.strony[0]!;
    const n = a.ustawienia.nozyczki!;
    const y = w.poczatekSiatki.y + SLOT;
    const nozyczki = scissors(s);
    expect(nozyczki.y).toBeCloseTo(y, 3);
    const prowadzaca = linie(s).find(
      (l) => l.y1 === l.y2 && Math.abs(l.y1 - y) < 1e-3 && l.x2 <= w.poczatekSiatki.x + 1e-3,
    );
    expect(prowadzaca).toBeDefined();
    expect(prowadzaca!.x1).toBeCloseTo(nozyczki.x + n.rozmiar / 2, 3);
    expect(prowadzaca!.x2).toBeCloseTo(w.poczatekSiatki.x, 3);
    expect(prowadzaca!.obrys.kreska).toEqual([
      a.ustawienia.linie.kreska,
      a.ustawienia.linie.przerwa,
    ]);
  });

  it('tytuł pionowy sięga prawie całej siatki i kończy się pod nożyczkami', () => {
    const a = arkuszeMausrittera[1]!;
    const w = zbudujArkusz(a, taliaWyposazenia, ctx);
    const s = w.strony[0]!;
    const tytul = s.elementy.find((e) => e.typ === 'grupa' && e.obrot === -90);
    if (tytul?.typ !== 'grupa') throw new Error('brak tytułu');
    // Długość całego napisu (z ostatnią literą) wzdłuż siatki, od dolnej krawędzi w górę.
    const dlugosc = w.tytul!.dlugosc;
    const n = a.ustawienia.nozyczki!;
    const limit = 6 * SLOT - (n.rozmiar / 2 + 1);
    expect(dlugosc).toBeLessThanOrEqual(limit + 1e-6);
    expect(dlugosc).toBeGreaterThan(0.9 * limit);
    expect(w.ostrzezenia).toEqual([]);
  });

  it('tytuł poziomy kończy się przed nożyczkami nad siatką; nożyczki „koniec” nic nie zmieniają', () => {
    const a = arkuszeMausrittera[1]!;
    const zTytulem = (polozenie: 'gora' | 'lewo', strona: 'poczatek' | 'koniec') =>
      zbudujArkusz(
        {
          ...a,
          ustawienia: {
            ...a.ustawienia,
            tytul: { ...a.ustawienia.tytul!, polozenie },
            nozyczki: { linia: 'pionowa', indeks: 3, strona, rozmiar: 6, odstep: 2 },
          },
        },
        taliaWyposazenia,
        ctx,
      );
    const gora = zTytulem('gora', 'poczatek');
    expect(gora.tytul!.dlugosc).toBeLessThanOrEqual(3 * SLOT - 4 + 1e-6);
    expect(gora.ostrzezenia).toEqual([]);
    const koniec = zTytulem('lewo', 'koniec');
    expect(koniec.tytul!.rozmiar).toBe(a.ustawienia.tytul!.styl.rozmiar);
  });

  it('tytuł, który nie mieści się nawet po zmniejszeniu – ostrzeżenie', () => {
    const a = arkuszeMausrittera[1]!;
    const w = zbudujArkusz(
      {
        ...a,
        ustawienia: {
          ...a.ustawienia,
          tytul: { ...a.ustawienia.tytul!, polozenie: 'gora' },
          nozyczki: { linia: 'pionowa', indeks: 0, strona: 'poczatek', rozmiar: 6, odstep: 2 },
        },
      },
      taliaWyposazenia,
      ctx,
    );
    expect(w.ostrzezenia).toContainEqual({ komunikat: 'tytul-nie-miesci-sie' });
  });

  it('opis grupy co najmniej 2 mm nad górną linią cięcia kart', () => {
    const a = arkuszeMausrittera[2]!;
    const w = zbudujArkusz(a, talia(a), ctx);
    const s = w.strony[0]!;
    // Grupy tekstu nad siatką: nagłówki i opisy (pomijamy tytuł arkusza).
    const nad = s.elementy.filter(
      (e): e is Extract<ElementSceny, { typ: 'grupa' }> =>
        e.typ === 'grupa' &&
        !e.obrot &&
        e.y < w.poczatekSiatki.y &&
        e.elementy.some((x) => x.typ === 'tekst'),
    );
    expect(nad.length).toBeGreaterThan(2);
    // Linia bazowa ostatniej linijki opisu + zejście liter (~0,25 rozmiaru) ≥ 2 mm nad kartami.
    const zejscie = 0.25 * a.ustawienia.grupy!.stylOpisu.rozmiar;
    const dol = Math.max(
      ...nad.flatMap((g) =>
        g.elementy.flatMap((e) => (e.typ === 'tekst' ? e.glify.map((x) => g.y + x.y) : [])),
      ),
    );
    expect(w.poczatekSiatki.y - (dol + zejscie)).toBeGreaterThanOrEqual(2);
    expect(w.ostrzezenia).toEqual([]);
  });

  it('nożyczki na nieistniejącej linii – ostrzeżenie zamiast rysunku', () => {
    const a = arkuszeMausrittera[0]!;
    const w = zbudujArkusz(
      {
        ...a,
        ustawienia: { ...a.ustawienia, nozyczki: { ...a.ustawienia.nozyczki!, indeks: 99 } },
      },
      taliaBroni,
      ctx,
    );
    expect(w.ostrzezenia).toEqual([{ komunikat: 'nozyczki-poza-siatka:pozioma:99' }]);
  });

  it('kreska o zerowej długości daje linię ciągłą zamiast NaN', () => {
    const a = arkuszeMausrittera[0]!;
    const w = zbudujArkusz(
      { ...a, ustawienia: { ...a.ustawienia, linie: { ...a.ustawienia.linie, kreska: 0 } } },
      taliaBroni,
      ctx,
    );
    expect(linie(w.strony[0]!)[0]!.obrys.kreska).toBeUndefined();
  });
});

describe('zSzarymiObrazami', () => {
  it('podmienia zasoby obrazów także w grupach, reszta bez zmian', () => {
    const scena = {
      szer: 10,
      wys: 10,
      glify: {},
      elementy: [
        {
          typ: 'linia' as const,
          x1: 0,
          y1: 0,
          x2: 1,
          y2: 1,
          obrys: { kolor: '#000000', grubosc: 1 },
        },
        {
          typ: 'grupa' as const,
          elementy: [{ typ: 'obraz' as const, zasob: 'a', x: 0, y: 0, szer: 1, wys: 1 }],
        },
      ],
    } as unknown as Scena;
    const wynik = zSzarymiObrazami(scena);
    expect(JSON.stringify(wynik)).toContain('"zasob":"a#szary"');
    expect(wynik.elementy[0]).toBe(scena.elementy[0]);
    expect(JSON.stringify(scena)).not.toContain('#szary');
  });
});

describe('zbudujArkusz – własny układ arkusza', () => {
  const s = szablonCzaru; // 63×88 mm
  const ctxW = {
    czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
    szablony: new Map([[s.id, s]]),
  };
  const taliaW: Talia = {
    id: 't',
    nazwa: 't',
    karty: [1, 2, 3, 4].map((i) => ({
      id: `k${i}`,
      szablonId: s.id,
      dane: daneCzaru,
      ilosc: i === 4 ? 6 : 1,
    })),
  };
  const arkuszW = (uklad: UkladArkusza): Arkusz => ({
    id: 'a',
    nazwa: 'a',
    taliaId: 't',
    ustawienia: {
      ...ustawieniaKartkiDla(s),
      tytul: {
        tekst: 'Tytuł',
        polozenie: 'gora',
        styl: { czcionka: 'tytul', rozmiar: 6 },
        odstep: 2,
      },
      uklad,
    },
  });
  const uklad: UkladArkusza = {
    kolumny: 3,
    rzedy: 3,
    gora: 12,
    lewo: 8,
    odstepPoziomy: 4,
    odstepPionowy: 3,
    linieCiecia: true,
  };

  it('stała siatka od zadanego miejsca, odstępy między kartami, bez tytułu', () => {
    const w = zbudujArkusz(arkuszW(uklad), taliaW, ctxW);
    expect(w.ostrzezenia).toEqual([]);
    expect(w.siatka).toEqual({ kolumny: 3, rzedy: 3, grupy: false });
    expect(w.poczatekSiatki).toEqual({ x: 8, y: 12 });
    // 9 egzemplarzy na stronie 1 (3 + 6), położenia z odstępami.
    const karty = w.strony[0]!.elementy.filter((e) => e.typ === 'grupa');
    expect(karty).toHaveLength(9);
    expect(karty.map((e) => [e.x, e.y]).slice(0, 4)).toEqual([
      [8, 12],
      [8 + 63 + 4, 12],
      [8 + 2 * 67, 12],
      [8, 12 + 88 + 3],
    ]);
    // Każda karta ma osobny obrys (4 boki), bez wspólnych linii.
    expect(linie(w.strony[0]!)).toHaveLength(9 * 4);
    expect(w.odstepKolumny(0, 2)).toBe(8);
    expect(w.odstepRzedu(2)).toBe(6);
  });

  it('bez linii cięcia; siatka poza papierem – ostrzeżenie', () => {
    const bez = zbudujArkusz(arkuszW({ ...uklad, linieCiecia: false }), taliaW, ctxW);
    expect(linie(bez.strony[0]!)).toHaveLength(0);
    const za = zbudujArkusz(arkuszW({ ...uklad, kolumny: 4 }), taliaW, ctxW);
    expect(za.ostrzezenia).toContainEqual({ komunikat: 'uklad-poza-papierem' });
  });

  it('wymiaryUkladu: siatka i marginesy po prawej i na dole', () => {
    expect(wymiaryUkladu(uklad, { szerokosc: 63, wysokosc: 88 }, { szer: 210, wys: 297 })).toEqual({
      szer: 197,
      wys: 270,
      prawo: 5,
      dol: 15,
    });
  });

  it('karta wieloslotowa przy odstępach: na środku swoich slotów, obrys wokół samej karty', () => {
    const wielo: Szablon = {
      ...s,
      id: 'wielo',
      rozmiar: { tryb: 'sloty', slot: { szerokosc: 30, wysokosc: 40 }, kolumny: 2, rzedy: 1 },
    };
    const a = arkuszW({ ...uklad, kolumny: 4, rzedy: 2 });
    a.ustawienia.slot = { szerokosc: 30, wysokosc: 40 };
    const w = zbudujArkusz(
      a,
      { id: 't', nazwa: 't', karty: [{ id: 'w', szablonId: 'wielo', dane: {}, ilosc: 1 }] },
      { ...ctxW, szablony: new Map([['wielo', wielo]]) },
    );
    const k = w.strony[0]!.elementy.find((e) => e.typ === 'grupa')!;
    // Obszar 2 slotów z odstępem 4 mm = 64 mm, karta 60 mm → 2 mm z każdej strony.
    expect(k.x).toBeCloseTo(8 + 2);
    const poziome = linie(w.strony[0]!).filter((l) => l.y1 === l.y2);
    expect(poziome.map((l) => [l.x1, l.x2])).toEqual([
      [10, 70],
      [10, 70],
    ]);
  });

  it('strefa bezpieczeństwa liczona od położenia karty (wyśrodkowanej), nie od rogu slotu', () => {
    const a = arkuszW({ ...uklad, kolumny: 1, rzedy: 1, lewo: 0, gora: 0 });
    a.ustawienia.slot = { szerokosc: 63.4, wysokosc: 88.4 };
    a.ustawienia.marginesBezpieczenstwa = 0.1;
    const t1: Talia = { ...taliaW, karty: [taliaW.karty[0]!] };
    expect(zbudujArkusz(a, t1, ctxW).ostrzezenia).toEqual([]);
    a.ustawienia.marginesBezpieczenstwa = 0.3;
    expect(zbudujArkusz(a, t1, ctxW).ostrzezenia).toContainEqual({
      kartaId: 'k1',
      komunikat: 'karta-w-strefie-przyciecia',
    });
  });

  it('karta mniejsza niż slot – na środku slotu, bez skalowania', () => {
    const a = arkuszW({ ...uklad, kolumny: 2, rzedy: 2 });
    a.ustawienia.slot = { szerokosc: 63.4, wysokosc: 88.4 };
    const w = zbudujArkusz(a, taliaW, ctxW);
    const k = w.strony[0]!.elementy.find((e) => e.typ === 'grupa')!;
    expect(k.x).toBeCloseTo(8.2);
    expect(k.y).toBeCloseTo(12.2);
  });
});

describe('wydruk testowy i kalibracja', () => {
  const ctxT = {
    czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
    szablony: new Map<string, Szablon>(),
  };
  const a: Arkusz = {
    id: 'a',
    nazwa: 'a',
    taliaId: 't',
    ustawienia: {
      ...ustawieniaKartkiDla(szablonCzaru),
      uklad: {
        kolumny: 2,
        rzedy: 2,
        gora: 10,
        lewo: 10,
        odstepPoziomy: 5,
        odstepPionowy: 5,
        linieCiecia: false,
      },
    },
  };

  const pusta: Talia = { id: 't', nazwa: 't', karty: [] };

  it('bez slotu w ustawieniach – slot z szablonu kart talii, jak na kartce', () => {
    const bezSlotu: Arkusz = { ...a, ustawienia: { ...a.ustawienia } };
    delete bezSlotu.ustawienia.slot;
    const talia: Talia = {
      id: 't',
      nazwa: 't',
      karty: [{ id: 'k', szablonId: szablonStatystyk.id, dane: {}, ilosc: 1 }],
    };
    const s = stronaTestowa(bezSlotu, talia, {
      ...ctxT,
      szablony: new Map([[szablonStatystyk.id, szablonStatystyk]]),
    });
    const p = s.elementy.find((e) => e.typ === 'prostokat')!;
    expect([p.szer, p.wys]).toEqual([88, 63]);
  });

  it('obrysy slotów z numerami i krzyżykami w siatce kartki', () => {
    const s = stronaTestowa(a, pusta, ctxT);
    const prost = s.elementy.filter((e) => e.typ === 'prostokat');
    expect(prost.map((p) => [p.x, p.y])).toEqual([
      [10, 10],
      [78, 10],
      [10, 103],
      [78, 103],
    ]);
    expect(s.elementy.filter((e) => e.typ === 'linia')).toHaveLength(8);
    expect(s.elementy.filter((e) => e.typ === 'grupa')).toHaveLength(4);
  });

  it('przesunięcie kalibracji przesuwa całą zawartość strony', () => {
    const s = stronaTestowa(a, pusta, ctxT);
    expect(przesunScene(s, { x: 0, y: 0 })).toBe(s);
    const p = przesunScene(s, { x: 1.5, y: -0.5 });
    expect(p.elementy).toEqual([{ typ: 'grupa', x: 1.5, y: -0.5, elementy: s.elementy }]);
  });
});

describe('luz karty w slocie (dopasowanie)', () => {
  const ctxL = {
    czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
    szablony: new Map<string, Szablon>(),
  };
  const karta = (szer: number, wys: number, tlo?: string): Szablon => ({
    ...szablonCzaru,
    id: `s-${szer}x${wys}`,
    rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
    ...(tlo ? { tlo, promienRogow: 2 } : {}),
  });
  const uklad: UkladArkusza = {
    kolumny: 3,
    rzedy: 3,
    gora: 10,
    lewo: 10,
    odstepPoziomy: 0,
    odstepPionowy: 0,
    linieCiecia: true,
  };
  const zbuduj = (
    s: Szablon,
    z: Partial<Arkusz['ustawienia']>,
    slot = { szerokosc: 63.5, wysokosc: 89 },
  ) => {
    const ctx2 = { ...ctxL, szablony: new Map([[s.id, s]]) };
    const a: Arkusz = {
      id: 'a',
      nazwa: 'a',
      taliaId: 't',
      ustawienia: { ...ustawieniaKartkiDla(s), slot, uklad, ...z },
    };
    const t: Talia = {
      id: 't',
      nazwa: 't',
      karty: [{ id: 'k', szablonId: s.id, dane: daneCzaru, ilosc: 1 }],
    };
    return { w: zbudujArkusz(a, t, ctx2), a, t, ctx2 };
  };
  const dop = { luz: 1, polozenie: 'srodek', tloDoSlotu: false, linie: 'slot' } as const;

  it('63×88 w slocie 63,5×89 na nowej kartce (luz 1 mm) – bez ostrzeżeń', () => {
    const s = karta(63, 88);
    expect(ustawieniaKartkiDla(s).dopasowanie).toEqual(dop);
    const { w } = zbuduj(s, { dopasowanie: dop });
    expect(w.ostrzezenia).toEqual([]);
  });

  it('ta sama karta na kartce sprzed M2b-1 (bez dopasowania) – ostrzeżenie jak dziś', () => {
    const { a, t, ctx2 } = zbuduj(karta(63, 88), {});
    const bez = { ...a.ustawienia };
    delete bez.dopasowanie;
    const w = zbudujArkusz({ ...a, ustawienia: bez }, t, ctx2);
    expect(w.ostrzezenia.map((o) => o.komunikat)).toEqual(['karta-inny-rozmiar']);
  });

  it('luz zapisany w kartce (np. z presetu) decyduje o ostrzeżeniu', () => {
    const slot = { szerokosc: 64.5, wysokosc: 90 };
    expect(zbuduj(karta(63, 88), { dopasowanie: dop }, slot).w.ostrzezenia).toHaveLength(1);
    expect(zbuduj(karta(63, 88), { dopasowanie: { ...dop, luz: 2 } }, slot).w.ostrzezenia).toEqual(
      [],
    );
  });

  it('karta mniejsza o więcej niż luz (62×88 przy luzie 1) – ostrzeżenie', () => {
    const { w } = zbuduj(karta(62, 88), { dopasowanie: dop });
    expect(w.ostrzezenia.map((o) => o.komunikat)).toEqual(['karta-inny-rozmiar']);
  });

  it('karta większa od slotu o > 0,5 mm – ostrzeżenie mimo luzu', () => {
    const { w } = zbuduj(karta(64.2, 89), { dopasowanie: { ...dop, luz: 5 } });
    expect(w.ostrzezenia.map((o) => o.komunikat)).toContain('karta-inny-rozmiar');
  });

  it('położenie: środek albo lewy górny róg slotu', () => {
    const s = karta(63, 88);
    const prostokat = (p: 'srodek' | 'lewy-gorny') => {
      const { w } = zbuduj(s, { dopasowanie: { ...dop, polozenie: p } });
      const g = w.strony[0]!.elementy.find((e) => e.typ === 'grupa')!;
      return g.typ === 'grupa' ? { x: g.x, y: g.y } : undefined;
    };
    expect(prostokat('srodek')).toEqual({ x: 10.25, y: 10.5 });
    expect(prostokat('lewy-gorny')).toEqual({ x: 10, y: 10 });
  });

  it('tło do slotu: prostokąt slotu w kolorze tła z promieniem rogów karty', () => {
    const s = karta(63, 88, '#ffeecc');
    const bez = zbuduj(s, { dopasowanie: dop }).w.strony[0]!.elementy;
    expect(bez.find((e) => e.typ === 'prostokat')).toBeUndefined();
    const z = zbuduj(s, { dopasowanie: { ...dop, tloDoSlotu: true } }).w.strony[0]!.elementy;
    expect(z.find((e) => e.typ === 'prostokat')).toEqual({
      typ: 'prostokat',
      x: 10,
      y: 10,
      szer: 63.5,
      wys: 89,
      promien: 2,
      wypelnienie: '#ffeecc',
    });
  });

  it('linie cięcia wokół slotu (wspólne) albo wokół karty', () => {
    const s = karta(63, 88);
    const wokolSlotu = linie(zbuduj(s, { dopasowanie: dop }).w.strony[0]!);
    const wokolKarty = linie(zbuduj(s, { dopasowanie: { ...dop, linie: 'karta' } }).w.strony[0]!);
    expect(wokolSlotu).toHaveLength(4);
    expect(wokolSlotu[0]!.x1).toBe(10);
    expect(wokolKarty).toHaveLength(4);
    expect(
      Math.max(...wokolKarty.map((o) => o.x2)) - Math.min(...wokolKarty.map((o) => o.x1)),
    ).toBeCloseTo(63);
  });

  it('wydruk testowy: obrysy slotów albo kart', () => {
    const s = karta(63, 88);
    const prost = (sc: Scena) =>
      sc.elementy.filter(
        (e): e is Extract<ElementSceny, { typ: 'prostokat' }> => e.typ === 'prostokat',
      );
    const sl = zbuduj(s, { dopasowanie: dop });
    expect(prost(stronaTestowa(sl.a, sl.t, sl.ctx2))[0]).toMatchObject({ szer: 63.5, wys: 89 });
    const ka = zbuduj(s, { dopasowanie: { ...dop, linie: 'karta' } });
    expect(prost(stronaTestowa(ka.a, ka.t, ka.ctx2))[0]).toMatchObject({
      x: 10.25,
      y: 10.5,
      szer: 63,
      wys: 88,
    });
  });

  it('PDF z tłem do slotu powstaje bez błędu', async () => {
    const s = karta(63, 88, '#ffeecc');
    const { w } = zbuduj(s, { dopasowanie: { ...dop, tloDoSlotu: true } });
    const { bajty } = await scenyDoPdf(w.strony);
    expect(bajty.length).toBeGreaterThan(500);
  });
});

describe('tło do slotu – kolejność rysowania', () => {
  it('wszystkie tła przed pierwszą kartą (tło sąsiada nie zakrywa wystającej karty)', () => {
    const s: Szablon = {
      ...szablonCzaru,
      id: 'dwa',
      rozmiar: { tryb: 'mm', szerokosc: 64, wysokosc: 88 },
      tlo: '#ffeecc',
    };
    const a: Arkusz = {
      id: 'a',
      nazwa: 'a',
      taliaId: 't',
      ustawienia: {
        ...ustawieniaKartkiDla(s),
        slot: { szerokosc: 63.5, wysokosc: 89 },
        dopasowanie: { luz: 1, polozenie: 'srodek', tloDoSlotu: true, linie: 'slot' },
      },
    };
    const t: Talia = {
      id: 't',
      nazwa: 't',
      karty: [{ id: 'k', szablonId: 'dwa', dane: daneCzaru, ilosc: 2 }],
    };
    const w = zbudujArkusz(a, t, {
      czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
      szablony: new Map([['dwa', s]]),
    });
    const el = w.strony[0]!.elementy;
    const tla = el.flatMap((e, i) => (e.typ === 'prostokat' ? [i] : []));
    const karty = el.flatMap((e, i) => (e.typ === 'grupa' ? [i] : []));
    expect(tla).toHaveLength(2);
    expect(Math.max(...tla)).toBeLessThan(Math.min(...karty));
  });
});
