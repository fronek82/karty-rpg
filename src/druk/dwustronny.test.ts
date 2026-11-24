import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Arkusz, KrawedzOdwracania } from '../model/arkusz';
import type { Karta, Rewers, Szablon, Talia } from '../model/szablon';
import { pt } from '../model/jednostki';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import type { ElementSceny, Scena } from '../silnik/scena';
import { zbudujArkusz } from './arkusz';
import { scenyZadaniaPdf, zbudujPdf } from './budowaPdf';
import {
  katRewersu,
  odbijProstokat,
  osOdwracania,
  przeplecStronyDwustronne,
  stronyTestoweDwustronne,
  zbudujStronyRewersow,
} from './dwustronny';

const czcionki = rejestrTestowy();

const szablon = (id: string, szer: number, wys: number, extra: Partial<Szablon> = {}): Szablon => ({
  id,
  nazwa: id,
  rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
  tlo: '#ffffff',
  korzen: {
    id: 'k',
    typ: 'kolumna',
    padding: 2,
    dzieci: [
      {
        id: 'tytul',
        typ: 'tekst',
        klucz: 'nazwa',
        styl: { czcionka: 'tytul', rozmiar: pt(10), kolor: '#111111' },
      },
    ],
  },
  ...extra,
});

/** Niesymetryczny rewers z wyraźnym znacznikiem w lewym górnym rogu (5, 5) o rozmiarze 10×6 mm. */
const rewersAsymetryczny = (id = 'rev-asym', tlo = '#224466'): Rewers => ({
  id,
  nazwa: 'Rewers asymetryczny',
  rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 90 },
  tlo,
  korzen: {
    id: 'rk',
    typ: 'swobodny',
    dzieci: [
      {
        id: 'znacznik-lg',
        typ: 'tekst',
        tekst: 'GÓRA',
        tlo: '#cc0000',
        pozycja: { x: 5, y: 5 },
        szerokosc: { mm: 14 },
        wysokosc: { mm: 8 },
        styl: { czcionka: 'tytul', rozmiar: pt(8), kolor: '#ffffff' },
      },
    ],
  },
});

const bazowyArkusz = (ustawienia: Partial<Arkusz['ustawienia']> = {}): Arkusz => ({
  id: 'a1',
  nazwa: 'Arkusz 1',
  taliaId: 't1',
  ustawienia: {
    papier: 'A4',
    orientacja: 'pionowa',
    marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
    linie: { grubosc: 0.2, kolor: '#888888', kreska: 2, przerwa: 2 },
    dwustronny: { wlaczony: true, krawedz: 'dluga' },
    ...ustawienia,
  },
});

/**
 * Składa zagnieżdżone transformacje grup sceny i wyznacza pozycję pierwszego prostokąta o zadanym
 * kolorze wypełnienia (np. niesymetrycznego znacznika `#cc0000`) w układzie strony (mm).
 */
function srodekProstokataKoloru(scena: Scena, kolor: string): { x: number; y: number } | undefined {
  type M = [number, number, number, number, number, number];
  const mnoz = (a: M, b: M): M => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  const pkt = (m: M, x: number, y: number) => ({
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  });
  const szukaj = (lista: readonly ElementSceny[], m: M): { x: number; y: number } | undefined => {
    for (const e of lista) {
      if (e.typ === 'prostokat' && e.wypelnienie === kolor) {
        return pkt(m, e.x + e.szer / 2, e.y + e.wys / 2);
      }
      if (e.typ === 'grupa') {
        let gm: M = mnoz(m, [1, 0, 0, 1, e.x, e.y]);
        if (e.obrot) {
          const rad = (e.obrot * Math.PI) / 180;
          const c = Math.cos(rad);
          const s = Math.sin(rad);
          gm = mnoz(gm, [c, s, -s, c, 0, 0]);
        }
        if (e.macierz) gm = mnoz(gm, e.macierz);
        const w = szukaj(e.elementy, gm);
        if (w) return w;
      }
    }
    return undefined;
  };
  return szukaj(scena.elementy, [1, 0, 0, 1, 0, 0]);
}

describe('M4-4: geometria druku dwustronnego', () => {
  it('wyznacza oś odbicia i kąt rewersu dla wszystkich kombinacji orientacji, krawędzi i kąta przodu', () => {
    expect(osOdwracania({ szer: 210, wys: 297 }, 'dluga')).toBe('pionowa');
    expect(osOdwracania({ szer: 210, wys: 297 }, 'krotka')).toBe('pozioma');
    expect(osOdwracania({ szer: 297, wys: 210 }, 'dluga')).toBe('pozioma');
    expect(osOdwracania({ szer: 297, wys: 210 }, 'krotka')).toBe('pionowa');

    // Oś pionowa: −θ
    expect(katRewersu(0, 'pionowa')).toBe(0);
    expect(katRewersu(90, 'pionowa')).toBe(270);
    expect(katRewersu(180, 'pionowa')).toBe(180);
    expect(katRewersu(270, 'pionowa')).toBe(90);

    // Oś pozioma: 180° − θ
    expect(katRewersu(0, 'pozioma')).toBe(180);
    expect(katRewersu(90, 'pozioma')).toBe(90);
    expect(katRewersu(180, 'pozioma')).toBe(0);
    expect(katRewersu(270, 'pozioma')).toBe(270);
  });

  it('pokrywa górne krawędzie i fizyczne rogi niesymetrycznej obróconej karty w obu orientacjach i na obu krawędziach', () => {
    // Karta 60×90 mm; punkt (12, 9) na rewersie (środek prostokąta x:5..19, y:5..13) to lewy górny róg
    // patrząc na rewers – fizycznie leży za prawym górnym rogiem przodu, tj. w lokalnych współrzędnych
    // przodu w punkcie (60 - 12, 9) = (48, 9).
    const rev = rewersAsymetryczny();
    const sz = szablon('s1', 60, 90);
    const karta: Karta = { id: 'k1', szablonId: 's1', ilosc: 1, dane: { nazwa: 'Asymetryczna' } };
    const talia: Talia = { id: 't1', nazwa: 'Talia', karty: [karta], rewersId: rev.id };

    const przypadki: { orientacja: 'pionowa' | 'pozioma'; krawedz: KrawedzOdwracania }[] = [
      { orientacja: 'pionowa', krawedz: 'dluga' },
      { orientacja: 'pionowa', krawedz: 'krotka' },
      { orientacja: 'pozioma', krawedz: 'dluga' },
      { orientacja: 'pozioma', krawedz: 'krotka' },
    ];

    for (const { orientacja, krawedz } of przypadki) {
      // Wymuszamy obrót karty o 90° na przodzie przez wąski obszar w trybie MaxRects (wys < 90 przy poziomej
      // lub szer < 90 przy pionowej, dopasowany tak, by karta 60×90 zmieściła się tylko obrócona 90×60).
      const wymiary = orientacja === 'pionowa' ? { szer: 110, wys: 130 } : { szer: 130, wys: 110 };
      const marginesy =
        orientacja === 'pionowa'
          ? { gora: 30, prawo: 5, dol: 30, lewo: 5 } // obszar 100×70 -> karta 60×90 wejdzie TYLKO obrócona 90×60
          : { gora: 20, prawo: 10, dol: 20, lewo: 10 }; // obszar 110×70 -> karta 60×90 wejdzie TYLKO obrócona 90×60
      const ark = bazowyArkusz({
        papier: 'wlasny',
        wymiaryPapieru:
          orientacja === 'pionowa' ? wymiary : { szer: wymiary.wys, wys: wymiary.szer },
        orientacja,
        marginesy,
        rozmiary: 'mieszane',
        mieszane: {
          pakowanie: 'maxrects',
          kolejnosc: 'najwieksze',
          obracaj: true,
          grupujRozmiary: false,
          odstep: 0,
        },
        dwustronny: { wlaczony: true, krawedz },
      });
      const ctx = { czcionki, szablony: new Map([[sz.id, sz]]) };
      const przod = zbudujArkusz(ark, talia, ctx);
      expect(przod.pozycjeKart).toHaveLength(1);
      const poz = przod.pozycjeKart[0]!;
      expect(poz.obrot).toBe(90);

      const tyl = zbudujStronyRewersow(ark, talia, przod, {
        ...ctx,
        rewersy: new Map([[rev.id, rev]]),
      });
      expect(tyl.strony).toHaveLength(1);
      expect(tyl.puste).toEqual([false]);

      // Wyznaczamy pozycję punktu fizycznego (48, 9) przodu na papierze przy obrocie przodu 90° CW:
      // Na przodzie: (0,0) karty jest w (poz.x + poz.szer, poz.y), oś X karty idzie w +Y strony, oś Y w -X strony.
      const frontPhysX = poz.x + poz.szer - 9;
      const frontPhysY = poz.y + 48;

      // Po fizycznym odwróceniu papieru punkt (frontPhysX, frontPhysY) trafia na drugą stronę w:
      const os = osOdwracania(wymiary, krawedz);
      const oczekiwanyTylX = os === 'pionowa' ? wymiary.szer - frontPhysX : frontPhysX;
      const oczekiwanyTylY = os === 'pozioma' ? wymiary.wys - frontPhysY : frontPhysY;

      const faktyczny = srodekProstokataKoloru(tyl.strony[0]!, '#cc0000');
      expect(faktyczny).toBeDefined();
      expect(faktyczny!.x).toBeCloseTo(oczekiwanyTylX, 2);
      expect(faktyczny!.y).toBeCloseTo(oczekiwanyTylY, 2);
    }
  });
});

describe('M4-4: regresje siatki, MaxRects, nakładu, kontynuacji, pustych tyłów i kalibracji', () => {
  it('zachowuje położenia siatki, nakład (ilosc), jawny brak rewersu i tło do slotu', () => {
    const rev = rewersAsymetryczny('rev1', '#335577');
    const sz = szablon('s1', 63, 88);
    const k1: Karta = { id: 'k1', szablonId: 's1', ilosc: 2, dane: { nazwa: 'Kopia' } };
    const k2: Karta = {
      id: 'k2',
      szablonId: 's1',
      ilosc: 1,
      rewersId: null,
      dane: { nazwa: 'Bez tyłu' },
    };
    const talia: Talia = { id: 't1', nazwa: 'Talia', karty: [k1, k2], rewersId: rev.id };
    const ark = bazowyArkusz({
      slot: { szerokosc: 64, wysokosc: 89 },
      dopasowanie: { luz: 2, polozenie: 'srodek', tloDoSlotu: true, linie: 'slot' },
      uklad: {
        kolumny: 3,
        rzedy: 1,
        gora: 15,
        lewo: 8,
        odstepPoziomy: 2,
        odstepPionowy: 0,
        linieCiecia: false,
      },
      dwustronny: { wlaczony: true, krawedz: 'dluga' },
    });
    const ctx = { czcionki, szablony: new Map([[sz.id, sz]]) };
    const przod = zbudujArkusz(ark, talia, ctx);
    expect(przod.pozycjeKart).toHaveLength(3); // 2 kopie k1 + 1× k2

    const tyl = zbudujStronyRewersow(ark, talia, przod, {
      ...ctx,
      rewersy: new Map([[rev.id, rev]]),
    });
    expect(tyl.strony).toHaveLength(1);
    expect(tyl.puste).toEqual([false]);
    // Na stronie tyłu są 2 tła slotu (#335577) + 2 grupy rewersów (k2 ma jawny brak rewersu).
    const grupy = tyl.strony[0]!.elementy.filter((e) => e.typ === 'grupa');
    const tlaSlotu = tyl.strony[0]!.elementy.filter(
      (e) => e.typ === 'prostokat' && e.wypelnienie === '#335577',
    );
    expect(grupy).toHaveLength(2);
    expect(tlaSlotu).toHaveLength(2);
    // Sprawdzamy lustrzane X pierwszej kopii k1 względem A4 (210 mm).
    const oczekiwane = odbijProstokat(przod.pozycjeKart[0]!, { szer: 210, wys: 297 }, 'pionowa');
    expect(grupy[0]!.typ === 'grupa' && grupy[0]!.x).toBeCloseTo(oczekiwane.x, 3);
    expect(grupy[0]!.typ === 'grupa' && grupy[0]!.y).toBeCloseTo(oczekiwane.y, 3);
  });

  it('rysuje na tyle lustrzane odbicie linii cięcia przodu', () => {
    const rev = rewersAsymetryczny('rev1', '#335577');
    const sz = szablon('s1', 63, 88);
    const k1: Karta = { id: 'k1', szablonId: 's1', ilosc: 2, dane: { nazwa: 'A' } };
    const talia: Talia = { id: 't1', nazwa: 'Talia', karty: [k1], rewersId: rev.id };
    const ctx = { czcionki, szablony: new Map([[sz.id, sz]]) };
    const linieZ = (sc: Scena) =>
      sc.elementy
        .filter((e) => e.typ === 'linia')
        .map((e) => (e.typ === 'linia' ? [e.x1, e.y1, e.x2, e.y2] : []));
    for (const krawedz of ['dluga', 'krotka'] as KrawedzOdwracania[]) {
      const ark = bazowyArkusz({ dwustronny: { wlaczony: true, krawedz } });
      const przod = zbudujArkusz(ark, talia, ctx);
      const tyl = zbudujStronyRewersow(ark, talia, przod, {
        ...ctx,
        rewersy: new Map([[rev.id, rev]]),
      });
      const linieP = linieZ(przod.strony[0]!);
      expect(linieP.length).toBeGreaterThan(0);
      const os = osOdwracania({ szer: 210, wys: 297 }, krawedz);
      const odbite = linieP.map(([x1, y1, x2, y2]) =>
        os === 'pionowa' ? [210 - x1!, y1, 210 - x2!, y2] : [x1, 297 - y1!, x2, 297 - y2!],
      );
      expect(linieZ(tyl.strony[0]!)).toEqual(odbite);
    }
  });

  it('przypisuje rewers także do dodatkowych części kontynuacji tekstu', () => {
    const rev = rewersAsymetryczny('rev-kont');
    const sz = szablon('s-kont', 50, 35, {
      korzen: {
        id: 'k',
        typ: 'kolumna',
        padding: 2,
        dzieci: [
          {
            id: 'opis',
            typ: 'tekst',
            klucz: 'opis',
            kontynuuj: true,
            wysokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: pt(11), kolor: '#111111' },
          },
        ],
      },
    });
    const dlugiTekst = Array.from({ length: 45 }, (_, i) => `Słowo${i + 1}`).join(' ');
    const karta: Karta = { id: 'k-dluga', szablonId: sz.id, ilosc: 1, dane: { opis: dlugiTekst } };
    const talia: Talia = { id: 't1', nazwa: 'Talia', karty: [karta], rewersId: rev.id };
    const ark = bazowyArkusz({ dwustronny: { wlaczony: true, krawedz: 'dluga' } });
    const ctx = { czcionki, szablony: new Map([[sz.id, sz]]) };

    const przod = zbudujArkusz(ark, talia, ctx);
    expect(przod.pozycjeKart.length).toBeGreaterThanOrEqual(2);
    expect(przod.pozycjeKart.some((p) => (p.czesc ?? 0) > 0)).toBe(true);

    const tyl = zbudujStronyRewersow(ark, talia, przod, {
      ...ctx,
      rewersy: new Map([[rev.id, rev]]),
    });
    const liczbaRewersow = tyl.strony.reduce(
      (s, sc) => s + sc.elementy.filter((e) => e.typ === 'grupa').length,
      0,
    );
    expect(liczbaRewersow).toBe(przod.pozycjeKart.length);
  });

  it('przeplata strony PDF dwustronnego, zachowuje puste tyły i stosuje niezależne korekty X/Y przodu i tyłu', async () => {
    const rev = rewersAsymetryczny();
    const sz = szablon('s1', 63, 88);
    const k1: Karta = { id: 'k1', szablonId: 's1', ilosc: 1, dane: { nazwa: 'Z rewersem' } };
    const k2: Karta = {
      id: 'k2',
      szablonId: 's1',
      ilosc: 1,
      rewersId: null,
      dane: { nazwa: 'Bez rewersu' },
    };
    const t1: Talia = { id: 't1', nazwa: 'T1', karty: [k1], rewersId: rev.id };
    const t2: Talia = { id: 't2', nazwa: 'T2', karty: [k2] };
    const a1 = bazowyArkusz({ dwustronny: { wlaczony: true, krawedz: 'dluga' } });
    const a2: Arkusz = {
      id: 'a2',
      nazwa: 'Arkusz 2 (jednostronny)',
      taliaId: 't2',
      ustawienia: { ...a1.ustawienia, dwustronny: { wlaczony: false, krawedz: 'dluga' } },
    };

    const czPlik = new Uint8Array(readFileSync('public/czcionki/EBGaramond-Regular.ttf'));
    const bazaZadania = {
      tytul: 'Test dwustronny',
      arkusze: [a1, a2],
      talie: [t1, t2],
      szablony: [sz],
      rewersy: [rev],
      czcionki: [{ id: 'c1', rodzina: 'EB Garamond', wariant: 'normalny' as const, dane: czPlik }],
      role: { tytul: 'EB Garamond', tresc: 'EB Garamond' },
      obrazy: [],
    };

    // PDF dwustronny: 2 arkusze po 1 stronie przodu -> 4 strony (P1, T1, P2, pusty T2).
    const zadanieDwu = {
      ...bazaZadania,
      przesuniecie: { x: 2, y: -1 },
      przesuniecieRewersu: { x: -1.5, y: 3 },
    };
    const scenyDwu = scenyZadaniaPdf(zadanieDwu);
    expect(scenyDwu).toHaveLength(4);
    // Strona 1 (P1) i Strona 3 (P2) dostają wyłącznie przesunięcie przodu (2, -1).
    expect(scenyDwu[0]!.elementy[0]).toMatchObject({ typ: 'grupa', x: 2, y: -1 });
    expect(scenyDwu[2]!.elementy[0]).toMatchObject({ typ: 'grupa', x: 2, y: -1 });
    // Strona 2 (T1) dostaje wyłącznie przesunięcie rewersu (-1.5, 3) i ma niepustą zawartość.
    expect(scenyDwu[1]!.elementy[0]).toMatchObject({ typ: 'grupa', x: -1.5, y: 3 });
    expect(
      scenyDwu[1]!.elementy[0]!.typ === 'grupa' && scenyDwu[1]!.elementy[0]!.elementy.length,
    ).toBeGreaterThan(0);
    // Strona 4 (T2 – jednostronny arkusz w dwustronnym PDF) jest pusta (wyrównanie par).
    expect(scenyDwu[3]!.elementy).toEqual([]);

    const pdfDwu = await zbudujPdf(zadanieDwu);
    const docDwu = await PDFDocument.load(pdfDwu);
    expect(docDwu.getPageCount()).toBe(4);

    // Regresja: gdy żaden arkusz nie ma druku dwustronnego, PDF ma dokładnie tyle stron co przodów (2).
    const pdfJedno = await zbudujPdf({
      ...bazaZadania,
      arkusze: [
        {
          ...a1,
          ustawienia: { ...a1.ustawienia, dwustronny: { wlaczony: false, krawedz: 'dluga' } },
        },
        a2,
      ],
    });
    const docJedno = await PDFDocument.load(pdfJedno);
    expect(docJedno.getPageCount()).toBe(2);

    // Wydruk próbny dwustronny ma dokładnie 2 strony: przód z (1, 0.5), tył z (-2, 1.5).
    const zadanieProbny = {
      ...bazaZadania,
      testowyDwustronny: a1.id,
      przesuniecie: { x: 1, y: 0.5 },
      przesuniecieRewersu: { x: -2, y: 1.5 },
      etykietyTestowe: { przod: 'PRZÓD', tyl: 'TYŁ' },
    };
    const scenyProbny = scenyZadaniaPdf(zadanieProbny);
    expect(scenyProbny).toHaveLength(2);
    expect(scenyProbny[0]!.elementy[0]).toMatchObject({ typ: 'grupa', x: 1, y: 0.5 });
    expect(scenyProbny[1]!.elementy[0]).toMatchObject({ typ: 'grupa', x: -2, y: 1.5 });
    const pdfProbny = await zbudujPdf(zadanieProbny);
    const docProbny = await PDFDocument.load(pdfProbny);
    expect(docProbny.getPageCount()).toBe(2);
  });

  it('stronyTestoweDwustronne tworzy lustrzaną parę z krzyżykami, strzałkami i podziałką dla pustej i wypełnionej kartki', () => {
    const sz = szablon('s1', 63, 88);
    const pustaTalia: Talia = { id: 't1', nazwa: 'Pusta', karty: [] };
    const ark = bazowyArkusz({
      slot: { szerokosc: 63, wysokosc: 88 },
      dwustronny: { wlaczony: true, krawedz: 'krotka' },
    });
    const ctx = { czcionki, szablony: new Map([[sz.id, sz]]) };
    const [przod, tyl] = stronyTestoweDwustronne(ark, pustaTalia, ctx);
    expect(przod.szer).toBe(210);
    expect(przod.wys).toBe(297);
    expect(tyl.szer).toBe(210);
    expect(tyl.wys).toBe(297);
    const prostPrzodu = przod.elementy.filter((e) => e.typ === 'prostokat');
    const prostTylu = tyl.elementy.filter((e) => e.typ === 'prostokat');
    expect(prostPrzodu.length).toBeGreaterThan(0);
    expect(prostTylu).toHaveLength(prostPrzodu.length);
    // Przy pionowej stronie i krótkiej krawędzi odbicie jest w osi Y (y' = H - y - wys).
    expect(prostTylu[0]!.x).toBeCloseTo(prostPrzodu[0]!.x, 3);
    expect(prostTylu[0]!.y).toBeCloseTo(297 - prostPrzodu[0]!.y - prostPrzodu[0]!.wys, 3);
  });

  it('przeplecStronyDwustronne uzupełnia brakujący tył pustą stroną o wymiarach przodu', () => {
    const p1: Scena = { szer: 210, wys: 297, elementy: [], glify: {} };
    const p2: Scena = { szer: 297, wys: 210, elementy: [], glify: {} };
    const t1: Scena = {
      szer: 210,
      wys: 297,
      elementy: [{ typ: 'prostokat', x: 1, y: 1, szer: 10, wys: 10, wypelnienie: '#000000' }],
      glify: {},
    };
    const wynik = przeplecStronyDwustronne([p1, p2], [t1]);
    expect(wynik).toHaveLength(4);
    expect(wynik[1]).toBe(t1);
    expect(wynik[3]).toEqual({ szer: 297, wys: 210, elementy: [], glify: {} });
  });

  it('wspólne pola awersu i rewersu renderują osobne wartości dla każdej karty bez kolizji pamięci podręcznej', () => {
    const s = szablon('s1', 60, 90);
    const rev: Rewers = {
      id: 'rev-wspolne',
      nazwa: 'Rewers z nazwą',
      rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 90 },
      tlo: '#224466',
      korzen: {
        id: 'rk',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'r-nazwa',
            nazwa: 'Nazwa',
            typ: 'tekst',
            tekst: 'DOMYŚLNA',
            pozycja: { x: 5, y: 5 },
            szerokosc: { mm: 50 },
            wysokosc: { mm: 12 },
            styl: { czcionka: 'tytul', rozmiar: pt(10), kolor: '#ffffff' },
          },
        ],
      },
    };
    const talia: Talia = {
      id: 't1',
      nazwa: 'Talia',
      rewersId: rev.id,
      karty: [
        { id: 'k1', szablonId: s.id, dane: { nazwa: 'Miecz' }, ilosc: 1 },
        { id: 'k2', szablonId: s.id, dane: { nazwa: 'Tarcza' }, ilosc: 1 },
        { id: 'k3', szablonId: s.id, dane: {}, ilosc: 1 },
      ],
    };
    const arkusz = bazowyArkusz();
    const szablony = new Map([[s.id, s]]);
    const przod = zbudujArkusz(arkusz, talia, { szablony, czcionki });
    const wynik = zbudujStronyRewersow(arkusz, talia, przod, {
      szablony,
      rewersy: new Map([[rev.id, rev]]),
      czcionki,
    });
    expect(wynik.strony).toHaveLength(1);
    const grupy = wynik.strony[0]!.elementy.filter(
      (e): e is Extract<ElementSceny, { typ: 'grupa' }> => e.typ === 'grupa',
    );
    expect(grupy).toHaveLength(3);
    // Każda z trzech kart (Miecz, Tarcza, pusta → DOMYŚLNA) ma inne glify na rewersie.
    const podpisy = grupy.map((g) => JSON.stringify(g.elementy));
    expect(new Set(podpisy).size).toBe(3);
  });
});
