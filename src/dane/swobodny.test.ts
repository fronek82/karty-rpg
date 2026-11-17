import { describe, expect, it } from 'vitest';
import { czyKontener, type Kontener, type Szablon, type Wezel } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import {
  doPoprzedniegoKontenera,
  dostosujDoSwobodnego,
  duplikujWezel,
  nowySzablon,
  nowyWezel,
  opakuj,
  przeniesWezel,
  ukladZWezlow,
  wstawWezel,
  zmienKolejnoscRysowania,
  zmienKotwice,
  zmienTypKontenera,
  zmienTypPola,
  zmienWezel,
  znajdzWezel,
} from './szablon';
import { migruj } from './schemat';
import { eksportujSzablon, importujSzablon } from './archiwum';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import { schematPlikuSzablonu } from './schemat';

const czcionki = rejestrTestowy();
const NAZWY = {
  karta: 'Karta',
  tytul: 'Tytuł',
  opis: 'Opis',
  siatka: 'Siatka',
  wiersz: 'Wiersz',
  pole: (n: number) => `Pole ${n}`,
  stopka: 'Stopka',
  stopkaLewa: 'Stopka lewa',
  stopkaPrawa: 'Stopka prawa',
};
const startowy = (uklad: Parameters<typeof nowySzablon>[1]['uklad']): Szablon =>
  nowySzablon('s', { nazwa: 'T', szer: 63, wys: 88, promien: 3, tlo: '#eeeeee', uklad }, NAZWY);
const rysuj = (s: Szablon) =>
  renderujKarte(
    s,
    { dane: { pole_1: 'Siła', opis: 'Długi opis karty, który łamie się na kilka wierszy.' } },
    { czcionki },
  );
const dzieci = (s: Szablon, id: string) => (znajdzWezel(s, id) as Kontener).dzieci;

describe('kreator „swobodny”', () => {
  it('tworzy pustą kartę ze swobodnym korzeniem bez paddingu', () => {
    const s = startowy('swobodny');
    expect(s.korzen).toMatchObject({ id: 'karta', typ: 'swobodny', dzieci: [] });
    expect(s.korzen.padding).toBeUndefined();
  });

  it('nowy element wstawiony do swobodnego dostaje położenie i rozmiar w mm', () => {
    let s = startowy('swobodny');
    for (const r of ['tekst', 'obraz', 'kolumna'] as const) {
      const w = dostosujDoSwobodnego(nowyWezel(s, r, r));
      expect(w.pozycja).toEqual({ x: 3, y: 3 });
      expect(w.szerokosc).toEqual({ mm: 30 });
      if (r !== 'tekst') expect(w.wysokosc).toEqual({ mm: 30 });
      s = wstawWezel(s, 'karta', w);
    }
    expect(dzieci(s, 'karta')).toHaveLength(3);
    expect(rysuj(s).wezly.map((w) => w.id)).toContain('karta');
  });
});

describe('konwersja kolumna → swobodny → kolumna', () => {
  const wezlyBezSwobodnych = (s: Szablon) =>
    rysuj(s)
      .wezly.map((w) => [w.id, ...[w.x, w.y, w.szer, w.wys].map((v) => Math.round(v * 100) / 100)])
      .sort();

  it('nic się na karcie nie przesuwa (położenia i obraz bez zmian)', () => {
    const s = startowy('tytul-siatka-opis-stopka');
    const przed = rysuj(s);
    const sw = zmienTypKontenera(s, 'karta', 'swobodny', ukladZWezlow(przed.wezly));
    expect(sw.korzen.typ).toBe('swobodny');
    const po = rysuj(sw);
    expect(wezlyBezSwobodnych(sw).map((r) => r[0])).toEqual(wezlyBezSwobodnych(s).map((r) => r[0]));
    for (const w of przed.wezly.filter((x) => x.id !== 'karta')) {
      const p = po.wezly.find((x) => x.id === w.id)!;
      // Tylko dzieci korzenia dostają położenia; reszta układa się w nich jak wcześniej.
      expect(p.x).toBeCloseTo(w.x, 2);
      expect(p.y).toBeCloseTo(w.y, 2);
      expect(p.szer).toBeCloseTo(w.szer, 2);
      expect(p.wys).toBeCloseTo(w.wys, 2);
    }
    // Rozmiary zapisane z dokładnością 0,001 mm – scena ma tyle samo elementów (tekst nie łamie się inaczej).
    expect(po.scena.elementy).toHaveLength(przed.scena.elementy.length);
    expect(po.ostrzezenia).toEqual(przed.ostrzezenia);
  });

  it('padding kontenera jest uwzględniony w położeniach', () => {
    const s = zmienWezel(startowy('tytul-opis'), 'karta', (w) => ({ ...w, padding: 6 }) as Wezel);
    const przed = rysuj(s);
    const sw = zmienTypKontenera(s, 'karta', 'swobodny', ukladZWezlow(przed.wezly));
    const tytul = znajdzWezel(sw, dzieci(sw, 'karta')[0]!.id)!;
    // Położenie liczone od wnętrza (po paddingu): element przy krawędzi wnętrza ma X = Y = 0.
    expect(tytul.pozycja).toEqual({ x: 0, y: 0 });
    expect(scenaDoSvg(rysuj(sw).scena)).toBe(scenaDoSvg(przed.scena));
  });

  it('powrót na kolumnę ustawia kolejność wg położenia i usuwa pozycję', () => {
    let s = startowy('tytul-opis');
    const [a, b] = dzieci(s, 'karta').map((d) => d.id) as [string, string];
    s = zmienTypKontenera(s, 'karta', 'swobodny');
    // Odwracamy położenia: drugi element wyżej niż pierwszy.
    s = zmienWezel(s, a, (w) => ({ ...w, pozycja: { x: 0, y: 40, obrot: 90 } }) as Wezel);
    s = zmienWezel(s, b, (w) => ({ ...w, pozycja: { x: 0, y: 5 } }) as Wezel);
    const kol = zmienTypKontenera(s, 'karta', 'kolumna');
    expect(kol.korzen.typ).toBe('kolumna');
    expect(dzieci(kol, 'karta').map((d) => d.id)).toEqual([b, a]);
    expect(dzieci(kol, 'karta').every((d) => d.pozycja === undefined)).toBe(true);
    const wiersz = zmienTypKontenera(s, 'karta', 'wiersz');
    // Wiersz: wg X, potem Y – równe X zostają wg Y.
    expect(dzieci(wiersz, 'karta').map((d) => d.id)).toEqual([b, a]);
  });

  it('powrót wg układu bieżącego (z kotwicami) używa prostokątów na karcie', () => {
    let s = startowy('tytul-opis');
    const [a, b] = dzieci(s, 'karta').map((d) => d.id) as [string, string];
    s = zmienTypKontenera(s, 'karta', 'swobodny');
    s = zmienWezel(
      s,
      a,
      (w) => ({ ...w, pozycja: { x: 0, y: -5, kotwica: 'prawy-dolny' } }) as Wezel,
    );
    s = zmienWezel(s, b, (w) => ({ ...w, pozycja: { x: 0, y: 5 } }) as Wezel);
    const kol = zmienTypKontenera(s, 'karta', 'kolumna', ukladZWezlow(rysuj(s).wezly));
    // Surowe y pierwszego (−5) jest mniejsze, ale na karcie stoi na dole.
    expect(dzieci(kol, 'karta').map((d) => d.id)).toEqual([b, a]);
  });

  it('przeniesienie elementu poza swobodny usuwa jego pozycję, do swobodnego – zostawia', () => {
    let s = startowy('swobodny');
    const k = nowyWezel(s, 'kolumna', 'K') as Kontener;
    s = wstawWezel(s, 'karta', k);
    s = wstawWezel(s, 'karta', dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')));
    const t = dzieci(s, 'karta').find((d) => d.typ === 'tekst')!;
    expect(t.pozycja).toBeDefined();
    const wKolumnie = przeniesWezel(s, t.id, k.id, 0);
    expect(znajdzWezel(wKolumnie, t.id)!.pozycja).toBeUndefined();
    const wrot = przeniesWezel(s, t.id, 'karta', 0);
    expect(znajdzWezel(wrot, t.id)!.pozycja).toEqual({ x: 3, y: 3 });
  });

  it('opakowanie elementu swobodnego w kolumnę zachowuje jego miejsce', () => {
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: 12, y: 20, obrot: 90 },
    });
    const t = dzieci(s, 'karta')[0]!;
    const o = opakuj(s, [t.id], 'kolumna', 'K');
    const kol = znajdzWezel(o.szablon, o.id)!;
    expect(kol.pozycja).toMatchObject({ x: 12, y: 20 });
    expect(znajdzWezel(o.szablon, t.id)!.pozycja).toBeUndefined();
  });

  it('zmiana typu pola zachowuje pozycję', () => {
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: 1, y: 2, kotwica: 'srodek', obrot: 180 },
    });
    const id = dzieci(s, 'karta')[0]!.id;
    const z = zmienTypPola(s, id, 'wartosc');
    expect(znajdzWezel(z, id)!.pozycja).toEqual({ x: 1, y: 2, kotwica: 'srodek', obrot: 180 });
  });
});

describe('konwersje – poprawki po przeglądzie', () => {
  const swob = (): Szablon => {
    let s = startowy('swobodny');
    for (const n of ['a', 'b', 'c']) s = wstawWezel(s, 'karta', nowyWezel(s, 'ikona', n));
    return s;
  };
  const ids = (s: Szablon) => dzieci(s, 'karta').map((d) => d.id);

  it('swobodny → warstwy zostawia kolejność z drzewa i usuwa tylko pozycję', () => {
    let s = swob();
    const [a, b, c] = ids(s) as [string, string, string];
    s = zmienWezel(s, a, (w) => ({ ...w, pozycja: { x: 0, y: 50 } }) as Wezel);
    s = zmienWezel(s, c, (w) => ({ ...w, pozycja: { x: 0, y: 1, obrot: 90 } }) as Wezel);
    const w = zmienTypKontenera(s, 'karta', 'warstwy');
    expect(w.korzen.typ).toBe('warstwy');
    expect(ids(w)).toEqual([a, b, c]);
    expect(dzieci(w, 'karta').every((d) => d.pozycja === undefined)).toBe(true);
  });

  it('klucz sortowania z prostokąta po obrocie (układ z obrotem)', () => {
    const s = swob();
    const [a, b, c] = ids(s) as [string, string, string];
    // „a” 40 × 4 obrócony o 90° (zajmuje 4 × 40) przy y = 10 – ramka przed obrotem zaczyna się
    // wyżej niż „b” (y = 20), ale na karcie jego górna krawędź jest niżej (y = 28 > 20).
    const uklad = new Map([
      [a, { x: -8, y: 28, szer: 40, wys: 4, obrot: 90 as const }],
      [b, { x: 0, y: 20, szer: 10, wys: 4 }],
      [c, { x: 0, y: 90, szer: 10, wys: 4 }],
    ]);
    // Prostokąt po obrocie „a”: środek (12, 30) → 4 × 40 od (10, 10).
    const kol = zmienTypKontenera(s, 'karta', 'kolumna', uklad);
    expect(ids(kol).slice(0, 2)).toEqual([a, b]);
    const uklad2 = new Map([
      [a, { x: -8, y: 48, szer: 40, wys: 4, obrot: 90 as const }],
      [b, { x: 0, y: 20, szer: 10, wys: 4 }],
      [c, { x: 0, y: 90, szer: 10, wys: 4 }],
    ]);
    // Środek „a” (12, 50) → po obrocie górna krawędź y = 30 > 20, więc „b” idzie przed „a”.
    expect(ids(zmienTypKontenera(s, 'karta', 'kolumna', uklad2)).slice(0, 2)).toEqual([b, a]);
  });

  it('bez układu klucz uwzględnia kotwicę (prawy dolny róg jest „dalej”)', () => {
    let s = swob();
    const [a, b, c] = ids(s) as [string, string, string];
    s = zmienWezel(
      s,
      a,
      (w) => ({ ...w, pozycja: { x: -2, y: -2, kotwica: 'prawy-dolny' } }) as Wezel,
    );
    s = zmienWezel(s, b, (w) => ({ ...w, pozycja: { x: 5, y: 80 } }) as Wezel);
    s = zmienWezel(s, c, (w) => ({ ...w, pozycja: { x: 5, y: 10, kotwica: 'srodek' } }) as Wezel);
    // Kolumna: lewy-górny y=80 (b) < środek (c) < prawy-dolny (a).
    expect(ids(zmienTypKontenera(s, 'karta', 'kolumna'))).toEqual([b, c, a]);
  });

  it('konwersja na swobodny z dzieckiem ukrytym: (0, 0) i rozmiary bez zmian, reszta jak w układzie', () => {
    let s = startowy('tytul-opis');
    // Pole „ukryj, gdy puste” bez danych jest poza układem.
    s = wstawWezel(s, 'karta', {
      ...nowyWezel(s, 'tekst', 'Ukryte'),
      gdyPuste: 'ukryj',
      wysokosc: { mm: 7 },
    } as Wezel);
    const przed = rysuj(s);
    expect(przed.wezly.some((w) => w.id === 'tekst_2' || w.id === 'tekst')).toBe(true);
    const ukryty = dzieci(s, 'karta').at(-1)!;
    expect(przed.wezly.find((w) => w.id === ukryty.id)).toBeUndefined();
    const sw = zmienTypKontenera(s, 'karta', 'swobodny', ukladZWezlow(przed.wezly));
    const u = znajdzWezel(sw, ukryty.id)!;
    expect(u.pozycja).toEqual({ x: 0, y: 0 });
    expect(u.wysokosc).toEqual({ mm: 7 });
    const t = znajdzWezel(sw, dzieci(sw, 'karta')[0]!.id)!;
    expect(t.szerokosc).toMatchObject({ mm: expect.any(Number) });
  });

  it('przeniesienie bez pozycji do swobodnego daje pozycję i rozmiar jak nowy element', () => {
    let s = startowy('tytul-opis');
    s = wstawWezel(s, 'karta', nowyWezel(s, 'kolumna', 'S'));
    const sw = dzieci(s, 'karta').find((d) => d.typ === 'kolumna')!;
    s = zmienTypKontenera(s, sw.id, 'swobodny');
    const t = dzieci(s, 'karta')[0]!;
    const z = przeniesWezel(s, t.id, sw.id, 0);
    expect(znajdzWezel(z, t.id)!.pozycja).toEqual({ x: 3, y: 3 });
    expect(znajdzWezel(z, t.id)!.szerokosc).toEqual({ mm: 30 });
    // „Do kontenera powyżej” używa tej samej ścieżki.
    const kolejny = nowyWezel(z, 'ikona', 'I');
    const z2 = doPoprzedniegoKontenera(wstawWezel(z, 'karta', kolejny), kolejny.id);
    expect(znajdzWezel(z2, kolejny.id)!.pozycja).toEqual({ x: 3, y: 3 });
  });

  it('duplikat w swobodnym leży 3 mm w prawo i w dół od oryginału', () => {
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: 10, y: 20, kotwica: 'srodek' },
    });
    const t = dzieci(s, 'karta')[0]!;
    const d = duplikujWezel(s, t.id, '(kopia)');
    expect(znajdzWezel(d.szablon, d.id)!.pozycja).toEqual({ x: 13, y: 23, kotwica: 'srodek' });
    // W zwykłej kolumnie kopia nie dostaje pozycji.
    const k = startowy('tytul-opis');
    const kopia = duplikujWezel(k, dzieci(k, 'karta')[0]!.id, '(kopia)');
    expect(znajdzWezel(kopia.szablon, kopia.id)!.pozycja).toBeUndefined();
  });

  it('opakowanie elementu swobodnego zachowuje całą jego pozycję (x, y, kotwica, obrót)', () => {
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: 12, y: -20, kotwica: 'prawy-dolny', obrot: 90 },
    });
    const t = dzieci(s, 'karta')[0]!;
    const o = opakuj(s, [t.id], 'kolumna', 'K');
    expect(znajdzWezel(o.szablon, o.id)!.pozycja).toEqual({
      x: 12,
      y: -20,
      kotwica: 'prawy-dolny',
      obrot: 90,
    });
  });

  it('separator w swobodnym: długość 30 mm tylko wzdłuż, grubość wg treści', () => {
    const s = startowy('swobodny');
    const poz = dostosujDoSwobodnego(nowyWezel(s, 'separator', 'P', { wWierszu: false }));
    const pion = dostosujDoSwobodnego(nowyWezel(s, 'separator', 'V', { wWierszu: true }));
    expect(poz).toMatchObject({ szerokosc: { mm: 30 } });
    expect(poz.wysokosc).toBeUndefined();
    expect(pion).toMatchObject({ wysokosc: { mm: 30 } });
    expect(pion.szerokosc).toBeUndefined();
  });
});

describe('kolejność rysowania i kotwica w panelu', () => {
  it('na wierzch / wyżej / niżej / na spód przesuwają w drzewie', () => {
    let s = startowy('swobodny');
    for (const n of ['a', 'b', 'c']) s = wstawWezel(s, 'karta', nowyWezel(s, 'ikona', n));
    const [a, b, c] = dzieci(s, 'karta').map((d) => d.id) as [string, string, string];
    const id = (x: Szablon) => dzieci(x, 'karta').map((d) => d.id);
    expect(id(zmienKolejnoscRysowania(s, a, 'na-wierzch'))).toEqual([b, c, a]);
    expect(id(zmienKolejnoscRysowania(s, c, 'na-spod'))).toEqual([c, a, b]);
    expect(id(zmienKolejnoscRysowania(s, a, 'wyzej'))).toEqual([b, a, c]);
    expect(id(zmienKolejnoscRysowania(s, c, 'nizej'))).toEqual([a, c, b]);
    // Na brzegu – ten sam szablon (bez kroku Cofnij).
    expect(zmienKolejnoscRysowania(s, c, 'na-wierzch')).toBe(s);
  });

  it('zmiana kotwicy zachowuje miejsce elementu na karcie', () => {
    const p = zmienKotwice({ x: 3, y: 3 }, 'prawy-dolny', {
      ramka: { szer: 63, wys: 88 },
      element: { szer: 10, wys: 6 },
    });
    // Lewy górny (3, 3) elementu 10 × 6 w ramce 63 × 88 → odstęp od prawego dolnego rogu.
    expect(p).toEqual({ x: -50, y: -79, kotwica: 'prawy-dolny' });
    expect(
      zmienKotwice(p, 'lewy-gorny', {
        ramka: { szer: 63, wys: 88 },
        element: { szer: 10, wys: 6 },
      }),
    ).toEqual({
      x: 3,
      y: 3,
      kotwica: 'lewy-gorny',
    });
  });
});

describe('schemat 15 i 16', () => {
  it('przyjmuje kontener swobodny z pozycją i odrzuca obrót spoza 0/90/180/270 oraz absurdalne X', () => {
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: -5.5, y: 3, kotwica: 'prawy-dolny', obrot: 270 },
    });
    const plik = (sz: Szablon) =>
      schematPlikuSzablonu.safeParse({ wersja: WERSJA_SCHEMATU, szablon: sz, role: {}, zasoby: [] })
        .success;
    expect(plik(s)).toBe(true);
    const zly = (pozycja: unknown) =>
      plik(zmienWezel(s, dzieci(s, 'karta')[0]!.id, (w) => ({ ...w, pozycja }) as Wezel));
    expect(zly({ x: 0, y: 0, obrot: 45 })).toBe(false);
    expect(zly({ x: 5000, y: 0 })).toBe(false);
    expect(zly({ x: 0, y: 0, kotwica: 'nigdzie' })).toBe(false);
    expect(zly({ x: Number.NaN, y: 0 })).toBe(false);
    expect(czyKontener(s.korzen)).toBe(true);
  });

  it('zapis i odczyt: swobodny korzeń z pozycjami wraca bez zmian z eksportu szablonu', () => {
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: 1.5, y: -2, kotwica: 'dolny', obrot: 180 },
    });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('wersja schematu to 16 (migracja z 14 tożsamościowa), a eksport i import szablonu zachowuje swobodny korzeń i pozycje', () => {
    expect(WERSJA_SCHEMATU).toBe(16);
    expect(migruj({ wersja: 14, a: 1 }, 'projekt')).toEqual({ wersja: 16, a: 1 });
    expect(migruj({ wersja: 14, a: 1 }, 'szablon')).toEqual({ wersja: 16, a: 1 });
    let s = startowy('swobodny');
    s = wstawWezel(s, 'karta', {
      ...dostosujDoSwobodnego(nowyWezel(s, 'tekst', 'T')),
      pozycja: { x: -5.5, y: 3, kotwica: 'prawy-dolny', obrot: 270 },
    });
    const projekt: Projekt = {
      wersja: WERSJA_SCHEMATU,
      id: 'p',
      nazwa: 'P',
      utworzono: '2026-01-01T00:00:00.000Z',
      zmieniono: '2026-01-01T00:00:00.000Z',
      role: {},
      zasoby: [],
      szablony: [s],
      talie: [],
      arkusze: [],
    };
    const paczka = importujSzablon(eksportujSzablon(projekt, new Map(), s.id).bajty);
    expect(paczka.szablon).toEqual(s);
  });
});
