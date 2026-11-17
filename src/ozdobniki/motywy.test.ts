import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { scenyDoPdf } from '../druk/pdf';
import { pt } from '../model/jednostki';
import type { OzdobaMotyw, Szablon } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import { tekstOstrzezenia } from '../ui/ostrzezenia';
import {
  MOTYWY_WBUDOWANE,
  WYS_KAFELKA,
  kluczKostki,
  macierzeBokow,
  ramkaZMotywu,
  rozlozKafelki,
  znajdzElement,
} from '.';

const ctx = { czcionki: rejestrTestowy() };
const KOLOR = '#2f5d8a';

const ozdoba = (element: string, reszta: Partial<OzdobaMotyw> = {}): OzdobaMotyw => ({
  rodzaj: 'motyw',
  element,
  szerokosc: 5,
  kolor: KOLOR,
  ...reszta,
});

/** Karta 40 × 60 z ramką z motywu. */
const kartaZRamka = (o: OzdobaMotyw, ramka: object = {}): Szablon => ({
  id: 't',
  nazwa: 'Test',
  rozmiar: { tryb: 'mm', szerokosc: 40, wysokosc: 60 },
  tlo: '#fdf6e3',
  ramka: { grubosc: 0.3, kolor: '#000000', odsuniecie: 1, ozdoba: o, ...ramka },
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 8,
    dzieci: [
      { id: 'nazwa', typ: 'tekst', klucz: 'nazwa', styl: { czcionka: 'tresc', rozmiar: pt(10) } },
    ],
  },
});

/** Mały panel 24 × 14 mm na karcie 32 × 22 mm. */
const kartaZPanelem = (o: OzdobaMotyw): Szablon => ({
  id: 't',
  nazwa: 'Panel',
  rozmiar: { tryb: 'mm', szerokosc: 32, wysokosc: 22 },
  tlo: '#fdf6e3',
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 4,
    dzieci: [
      {
        id: 'panel',
        typ: 'tekst',
        klucz: 'nazwa',
        szerokosc: { mm: 24 },
        wysokosc: { mm: 14 },
        padding: 4,
        ozdoba: o,
        styl: { czcionka: 'tresc', rozmiar: pt(8) },
      },
    ],
  },
});

describe('katalog motywów', () => {
  it('sześć motywów o unikalnych identyfikatorach, z kafelkiem i kostką narożną', () => {
    expect(MOTYWY_WBUDOWANE.map((e) => e.id)).toEqual([
      'wb:pnacze',
      'wb:przeplot',
      'wb:luski',
      'wb:runy',
      'wb:lancuch',
      'wb:gwiazdki',
    ]);
    for (const e of MOTYWY_WBUDOWANE) {
      expect(e.rodzaj).toBe('motyw');
      expect(e.wys).toBe(WYS_KAFELKA);
      expect(e.kostka?.length).toBeGreaterThan(0);
      expect(znajdzElement(e.id)).toBe(e);
      for (const c of [...e.kontury, ...(e.kostka ?? [])]) {
        expect(c.wypelnienie === 'kolor' || c.obrys?.kolor === 'kolor').toBe(true);
        for (const k of c.kontur)
          for (const v of k.slice(1) as number[]) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(-0.5);
            expect(v).toBeLessThanOrEqual(Math.max(e.szer, e.wys) + 0.5);
          }
      }
    }
  });
});

describe('równe rozłożenie kafelków', () => {
  const e = { szer: 20, wys: 10 }; // pas 8 mm → kafelek nominalnie 16 mm
  it.each([
    [100, 6, 100 / 6],
    [60, 4, 15],
    [64, 4, 16],
    [71.9, 4, 71.9 / 4],
    [72.1, 5, 72.1 / 5],
    [16, 1, 16],
    [8.1, 1, 8.1],
    [1, 1, 1],
    [200, 13, 200 / 13],
  ])('długość %s mm → %s kafelków, krok %s', (dlugosc, n, krok) => {
    const r = rozlozKafelki(dlugosc, 8, e);
    expect(r.nominalna).toBe(16);
    expect(r.n).toBe(n);
    expect(r.krok).toBeCloseTo(krok, 9);
  });

  it('kafelki wypełniają odcinek co do milimetra, a rozciągnięcie nie przekracza ±1/(2n)', () => {
    for (let dlugosc = 8; dlugosc <= 300; dlugosc += 1.37) {
      const r = rozlozKafelki(dlugosc, 8, e);
      expect(r.n * r.krok).toBeCloseTo(dlugosc, 9);
      expect(Math.abs(r.krok / r.nominalna - 1)).toBeLessThanOrEqual(1 / (2 * r.n) + 1e-9);
    }
  });

  it('pas skaluje nominalną szerokość; zerowa lub ujemna długość daje 0 kafelków', () => {
    expect(rozlozKafelki(60, 4, e).nominalna).toBe(8);
    expect(rozlozKafelki(60, 4, e).n).toBe(8); // 7,5 zaokrąglone w górę
    expect(rozlozKafelki(0, 4, e)).toMatchObject({ n: 0, krok: 0 });
    expect(rozlozKafelki(-3, 4, e).n).toBe(0);
  });
});

describe('kafelki na bokach ramki', () => {
  const e = { szer: 20, wys: 10 };
  const obszar = { x: 2, y: 3, szer: 60, wys: 40 };
  const p = (m: number[], x: number, y: number) => [
    m[0]! * x + m[2]! * y + m[4]!,
    m[1]! * x + m[3]! * y + m[5]!,
  ];

  it('liczba kafelków: dwa boki poziome i dwa pionowe, każdy równo rozłożony', () => {
    const ms = macierzeBokow(e, obszar, 8); // poziomo L = 44 → 3, pionowo L = 24 → 2 (k = 16)
    expect(ms).toHaveLength(2 * 3 + 2 * 2);
  });

  it('kafelek góry: zewnętrzna krawędź na górze ramki, kolejne stykają się bez szwu', () => {
    const ms = macierzeBokow(e, obszar, 8);
    const krok = 44 / 3;
    expect(p(ms[0]!, 0, 0)).toEqual([10, 3]);
    expect(p(ms[0]!, 20, 10)[0]).toBeCloseTo(10 + krok, 9);
    expect(p(ms[0]!, 20, 10)[1]).toBeCloseTo(11, 9);
    expect(p(ms[1]!, 0, 0)[0]).toBeCloseTo(10 + krok, 9);
    expect(p(ms[2]!, 20, 0)[0]).toBeCloseTo(54, 9); // koniec boku tuż przed kostką prawego rogu
  });

  it('boki są obrócone o 90° zgodnie z ruchem wskazówek zegara i patrzą na zewnątrz', () => {
    const ms = macierzeBokow(e, obszar, 8);
    // Prawy bok (po górze 3 kafelki): początek pod prawą górną kostką, zewnętrzna krawędź na x = 62.
    const prawy = ms[3]!;
    expect(p(prawy, 0, 0)).toEqual([62, 11]);
    expect(p(prawy, 0, 10)).toEqual([54, 11]);
    expect(p(prawy, 20, 0)[1]).toBeCloseTo(23, 9);
    // Dolny bok: biegnie w lewo, zewnętrzna krawędź na y = 43.
    const dolny = ms[5]!;
    expect(p(dolny, 0, 0)).toEqual([54, 43]);
    expect(p(dolny, 0, 10)).toEqual([54, 35]);
    expect(p(dolny, 20, 0)[0]).toBeCloseTo(54 - 44 / 3, 9);
    // Lewy bok: biegnie w górę, zewnętrzna krawędź na x = 2.
    const lewy = ms[8]!;
    expect(p(lewy, 0, 0)).toEqual([2, 35]);
    expect(p(lewy, 0, 10)).toEqual([10, 35]);
    expect(p(lewy, 20, 0)[1]).toBeCloseTo(35 - 12, 9);
  });
});

describe('ramka z motywu', () => {
  it('kafelki, cztery kostki narożne i szyny; symbole: kafelek i kostka (każdy raz)', () => {
    const w = ramkaZMotywu(ozdoba('wb:runy', { szyny: 0.3 }), { x: 0, y: 0, szer: 60, wys: 40 });
    const sym = w.elementy.filter((x) => x.typ === 'symbol');
    const n = macierzeBokow(znajdzElement('wb:runy')!, { x: 0, y: 0, szer: 60, wys: 40 }, 5).length;
    expect(sym).toHaveLength(n + 4);
    expect(w.elementy.filter((x) => x.typ === 'prostokat')).toHaveLength(2);
    expect(Object.keys(w.symbole).sort()).toEqual(['wb:runy', kluczKostki('wb:runy')]);
    expect(sym.every((x) => x.typ === 'symbol' && x.kolor === KOLOR)).toBe(true);
  });

  it('własne narożniki zastępują kostki; pas nie przekracza połowy krótszego boku', () => {
    const o = ozdoba('wb:lancuch', { szerokosc: 100 });
    const w = ramkaZMotywu(o, { x: 0, y: 0, szer: 40, wys: 20 }, { bezKostek: true });
    expect(w.pas).toBe(10);
    expect(Object.keys(w.symbole)).toEqual(['wb:lancuch']);
    expect(w.elementy.every((x) => x.typ === 'symbol' && x.klucz === 'wb:lancuch')).toBe(true);
    // Szerokość pasa równa połowie wysokości: boki pionowe znikają, poziome zostają.
    expect(w.elementy).toHaveLength(2 * rozlozKafelki(20, 10, znajdzElement('wb:lancuch')!).n);
  });

  it('nieznany motyw i element innego rodzaju: wynik pusty z identyfikatorem', () => {
    for (const id of ['wb:nie-ma', 'wb:kat']) {
      const w = ramkaZMotywu(ozdoba(id), { x: 0, y: 0, szer: 40, wys: 40 });
      expect(w.nieznany).toBe(id);
      expect(w.elementy).toEqual([]);
    }
  });
});

describe('motyw w scenie karty', () => {
  it('nieznany motyw: ostrzeżenie z polskim tekstem i cienka linia w kolorze ozdoby', () => {
    const { scena, ostrzezenia } = renderujKarte(
      kartaZRamka(ozdoba('wb:nie-ma')),
      { dane: { nazwa: 'A' } },
      ctx,
    );
    expect(ostrzezenia).toHaveLength(1);
    expect(tekstOstrzezenia(ostrzezenia[0]!)).toContain('wb:nie-ma');
    const linie = scena.elementy.filter((e) => e.typ === 'prostokat' && e.obrys);
    expect(linie).toHaveLength(1);
    expect(scena.symbole).toBeUndefined();
  });

  it('ozdoba zastępuje linię ramki; promień karty nie zakrzywia motywu (R3)', () => {
    const sz = { ...kartaZRamka(ozdoba('wb:pnacze')), promienRogow: 4 };
    const { scena } = renderujKarte(sz, { dane: { nazwa: 'A' } }, ctx);
    expect(scena.elementy.filter((e) => e.typ === 'prostokat' && e.obrys)).toHaveLength(0);
    expect(scena.elementy.some((e) => e.typ === 'symbol')).toBe(true);
    expect(Object.keys(scena.symbole ?? {}).sort()).toEqual(['wb:pnacze', 'wb:pnacze:kostka']);
  });

  it('odsunięcie ramki karty przesuwa pas; narożniki ramki zastępują kostki', () => {
    const { scena } = renderujKarte(
      kartaZRamka(ozdoba('wb:luski'), {
        odsuniecie: 2,
        narozniki: { element: 'wb:kat', rozmiar: 5 },
      }),
      { dane: { nazwa: 'A' } },
      ctx,
    );
    expect(Object.keys(scena.symbole ?? {}).sort()).toEqual(['wb:kat', 'wb:luski']);
    const pierwszy = scena.elementy.find((e) => e.typ === 'symbol' && e.klucz === 'wb:luski');
    expect(pierwszy).toMatchObject({ typ: 'symbol' });
    if (pierwszy?.typ === 'symbol') {
      expect(pierwszy.macierz[4]).toBeCloseTo(2 + 5, 9);
      expect(pierwszy.macierz[5]).toBe(2);
    }
    // Narożnik dziedziczy kolor motywu.
    const k = scena.elementy.find((e) => e.typ === 'symbol' && e.klucz === 'wb:kat');
    expect(k).toMatchObject({ kolor: KOLOR });
  });

  it('motyw na węźle: odsunięcie pasa i ten sam wynik przy ponownym renderze', () => {
    const sz = kartaZPanelem(ozdoba('wb:gwiazdki', { odsuniecie: 1, szyny: 0.25 }));
    const a = scenaDoSvg(renderujKarte(sz, { dane: { nazwa: 'A' } }, ctx).scena);
    const b = scenaDoSvg(renderujKarte(sz, { dane: { nazwa: 'A' } }, ctx).scena);
    expect(a).toBe(b);
    expect(a).toContain('<use');
  });
});

describe('wzorce SVG motywów', () => {
  for (const e of MOTYWY_WBUDOWANE) {
    const nazwa = e.id.replace('wb:', '');
    it(`${nazwa} – karta 40 × 60 z ramką, szynami i kostkami narożnymi`, async () => {
      const { scena, ostrzezenia } = renderujKarte(
        kartaZRamka(ozdoba(e.id, { szerokosc: 6, szyny: 0.3 })),
        { dane: { nazwa: 'Ala' } },
        ctx,
      );
      expect(ostrzezenia).toEqual([]);
      await expect(scenaDoSvg(scena)).toMatchFileSnapshot(
        `./__snapshots__/motyw-${nazwa}-karta.svg`,
      );
    });

    it(`${nazwa} – mały panel 24 × 14 mm`, async () => {
      const { scena, ostrzezenia } = renderujKarte(
        kartaZPanelem(ozdoba(e.id, { szerokosc: 3 })),
        { dane: { nazwa: 'Ala' } },
        ctx,
      );
      expect(ostrzezenia).toEqual([]);
      await expect(scenaDoSvg(scena)).toMatchFileSnapshot(
        `./__snapshots__/motyw-${nazwa}-panel.svg`,
      );
    });
  }
});

describe('PDF z motywami', () => {
  it('jeden XObject na kafelek i jeden na kostkę – niezależnie od liczby wstawień i stron', async () => {
    const { scena } = renderujKarte(
      kartaZRamka(ozdoba('wb:przeplot', { szerokosc: 3 })),
      { dane: { nazwa: 'Ala' } },
      ctx,
    );
    const uzycia = scena.elementy.filter((e) => e.typ === 'symbol');
    expect(uzycia.length).toBeGreaterThan(10);
    const wynik = await scenyDoPdf([scena, scena]);
    expect(wynik.liczbaSymboli).toBe(2);
    const doc = await PDFDocument.load(wynik.bajty);
    const refy = new Set<string>();
    for (const strona of doc.getPages()) {
      const xo = strona.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
      for (const [nazwa, ref] of xo?.entries() ?? [])
        if (nazwa.toString().startsWith('/S')) refy.add(String(ref));
    }
    expect(refy.size).toBe(2);
    const drugi = await scenyDoPdf([scena, scena]);
    expect(Buffer.from(drugi.bajty).equals(Buffer.from(wynik.bajty))).toBe(true);
  });

  it('różne motywy na jednej kartce: po jednym XObject kafelka i kostki na motyw', async () => {
    const sceny = ['wb:pnacze', 'wb:runy', 'wb:gwiazdki'].map(
      (id) => renderujKarte(kartaZRamka(ozdoba(id)), { dane: { nazwa: 'A' } }, ctx).scena,
    );
    expect((await scenyDoPdf(sceny)).liczbaSymboli).toBe(6);
  });
});
