import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Arkusz } from '../model/arkusz';
import { pt } from '../model/jednostki';
import type { Karta, Rewers, Szablon, Talia } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import {
  MIN_DPI_DRUKARNI,
  efektywneDpiObrazu,
  renderujKarte,
  renderujRewers,
} from '../silnik/karta';
import type { ElementSceny } from '../silnik/scena';
import { zbudujArkusz } from './arkusz';
import { scenyZadaniaPdf } from './budowaPdf';
import {
  MARGINES_POJEDYNCZEJ,
  ZNACZNIK_DLUGOSC,
  ZNACZNIK_ODSUNIECIE,
  marginesPojedynczejKarty,
  odcinkiZnacznikowCiecia,
  odstepMiedzyKartamiDrukarni,
  rezerwaZnacznika,
  rozmiarStronyPojedynczejKarty,
} from './drukarnia';
import { zbudujStronyRewersow } from './dwustronny';

const czcionki = rejestrTestowy();

function splaszczElementy(elementy: readonly ElementSceny[]): ElementSceny[] {
  return elementy.flatMap((e) => (e.typ === 'grupa' ? [e, ...splaszczElementy(e.elementy)] : [e]));
}

function szablonKarty(dodatki: Partial<Szablon> = {}): Szablon {
  return {
    id: 's1',
    nazwa: 'Karta drukarska',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    promienRogow: 3,
    tlo: '#1f2937',
    ramka: { styl: 'ciagla', grubosc: 0.5, kolor: '#f59e0b', odsuniecie: 2 },
    korzen: {
      id: 'k',
      typ: 'kolumna',
      padding: 4,
      dzieci: [
        {
          id: 'tytul',
          typ: 'tekst',
          klucz: 'nazwa',
          styl: { czcionka: 'tytul', rozmiar: pt(12), kolor: '#ffffff' },
        },
        {
          id: 'grafika',
          typ: 'obraz',
          klucz: 'obraz',
          dopasowanie: 'wypelnij',
          szerokosc: { mm: 50 },
          wysokosc: { mm: 50 },
        },
        {
          id: 'wektor',
          typ: 'ikona',
          ikona: 'gwiazdka',
          element: 'wb:gwiazda',
          rozmiar: 12,
          kolor: '#facc15',
        },
      ],
    },
    ...dodatki,
  };
}

function arkuszBazowy(
  zmiany: Partial<Arkusz['ustawienia']> = {},
  przypiete?: Arkusz['przypiete'],
): Arkusz {
  return {
    id: 'a1',
    nazwa: 'Arkusz drukarski',
    taliaId: 't1',
    ...(przypiete ? { przypiete } : {}),
    ustawienia: {
      papier: 'A4',
      orientacja: 'pionowa',
      marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
      linie: { grubosc: 0.2, kolor: '#888888', kreska: 2, przerwa: 2 },
      nozyczki: { linia: 'pozioma', indeks: 0, strona: 'poczatek', rozmiar: 6, odstep: 2 },
      ...zmiany,
    },
  };
}

describe('M4-5: geometria spadu i znaczników cięcia', () => {
  it('wylicza rezerwę, odstęp między kartami i rozmiar strony pojedynczej karty', () => {
    expect(rezerwaZnacznika(3, true)).toBe(3 + ZNACZNIK_ODSUNIECIE + ZNACZNIK_DLUGOSC);
    expect(rezerwaZnacznika(3, false)).toBe(3);
    expect(odstepMiedzyKartamiDrukarni(3, false)).toBe(6);
    expect(odstepMiedzyKartamiDrukarni(3, true)).toBe(
      6 + 2 * ZNACZNIK_ODSUNIECIE + ZNACZNIK_DLUGOSC,
    );
    expect(marginesPojedynczejKarty(3, false)).toBe(3);
    expect(marginesPojedynczejKarty(3, true)).toBe(
      3 + ZNACZNIK_ODSUNIECIE + ZNACZNIK_DLUGOSC + MARGINES_POJEDYNCZEJ,
    );
    expect(rozmiarStronyPojedynczejKarty({ szer: 63, wys: 88 }, 3, true)).toEqual({
      szer: 83,
      wys: 108,
      x: 10,
      y: 10,
    });
    expect(rozmiarStronyPojedynczejKarty({ szer: 63, wys: 88 }, 3, false)).toEqual({
      szer: 69,
      wys: 94,
      x: 3,
      y: 3,
    });
  });

  it('znaczniki cięcia wskazują rogi formatu netto, leżą poza spadem i scalają wspólne odcinki', () => {
    const gap = odstepMiedzyKartamiDrukarni(3, true); // 12 mm
    const a = { x: 10, y: 10, szer: 63, wys: 88 };
    const b = { x: 10 + 63 + gap, y: 10, szer: 63, wys: 88 };
    const pojedyncze = odcinkiZnacznikowCiecia([a], 3);
    expect(pojedyncze).toHaveLength(8);
    // Żaden znacznik nie wchodzi w obszar brutto (spad 3 mm) ani nie dotyka go (odsunięcie 1 mm).
    for (const o of pojedyncze) {
      const pozaX =
        o.x2 <= a.x - 3 - ZNACZNIK_ODSUNIECIE + 1e-6 ||
        o.x1 >= a.x + a.szer + 3 + ZNACZNIK_ODSUNIECIE - 1e-6;
      const pozaY =
        o.y2 <= a.y - 3 - ZNACZNIK_ODSUNIECIE + 1e-6 ||
        o.y1 >= a.y + a.wys + 3 + ZNACZNIK_ODSUNIECIE - 1e-6;
      expect(pozaX || pozaY).toBe(true);
    }
    // Dwie sąsiednie karty w rzędzie dzielą 2 poziome znaczniki w szczelinie (16 - 2 = 14 odcinków).
    const para = odcinkiZnacznikowCiecia([a, b], 3);
    expect(para).toHaveLength(14);
  });
});

describe('M4-5: format netto i brutto (spad) na karcie oraz rewersie', () => {
  it('tło i tekstura tła sięgają obszaru brutto ze spadem, a ramka i treść zostają w formacie netto', () => {
    const szablon = szablonKarty({ teksturaTla: 'tex' });
    const karta: Karta = { id: 'k1', szablonId: szablon.id, ilosc: 1, dane: { nazwa: 'Karta' } };
    const ctx = {
      czcionki,
      obraz: (id: string) => (id === 'tex' ? { szerokosc: 1200, wysokosc: 1600 } : undefined),
    };

    const bezSpadu = renderujKarte(szablon, karta, ctx);
    const zeSpadem = renderujKarte(szablon, karta, ctx, { spad: 3 });

    // Format netto sceny pozostaje 63×88 mm.
    expect([zeSpadem.scena.szer, zeSpadem.scena.wys]).toEqual([63, 88]);
    // Zewnętrzna grupa przycina do obszaru brutto (-3, -3, 69, 94).
    const zew = zeSpadem.scena.elementy[0];
    expect(zew?.typ).toBe('grupa');
    if (zew?.typ === 'grupa') {
      expect(zew.przyciecie).toEqual({ x: -3, y: -3, szer: 69, wys: 94 });
    }
    // Prostokąt tła bez zaokrągleń pokrywa dokładnie brutto (-3, -3, 69, 94).
    const elSpad = splaszczElementy(zeSpadem.scena.elementy);
    const tloBrutto = elSpad.find((e) => e.typ === 'prostokat' && e.wypelnienie === '#1f2937');
    expect(tloBrutto).toMatchObject({ x: -3, y: -3, szer: 69, wys: 94 });
    expect(tloBrutto?.typ === 'prostokat' ? tloBrutto.promien : undefined).toBeUndefined();
    // Tekstura tła przycięta/rozciągnięta do brutto (-3..-3 + 69×94).
    const texEl = elSpad.find((e) => e.typ === 'obraz' && e.zasob === 'tex');
    expect(texEl?.typ).toBe('obraz');
    if (texEl?.typ === 'obraz') {
      expect(texEl.x).toBeLessThanOrEqual(-3 + 1e-6);
      expect(texEl.y).toBeLessThanOrEqual(-3 + 1e-6);
      expect(texEl.x + texEl.szer).toBeGreaterThanOrEqual(66 - 1e-6);
      expect(texEl.y + texEl.wys).toBeGreaterThanOrEqual(91 - 1e-6);
    }
    // Ramka karty pozostaje w formacie netto (odsunięcie 2 mm + pół grubości 0.25 mm = 2.25 mm).
    const ramkaSpad = elSpad.find((e) => e.typ === 'prostokat' && e.obrys?.kolor === '#f59e0b');
    const ramkaBez = splaszczElementy(bezSpadu.scena.elementy).find(
      (e) => e.typ === 'prostokat' && e.obrys?.kolor === '#f59e0b',
    );
    expect(ramkaSpad).toEqual(ramkaBez);
    expect(ramkaSpad).toMatchObject({ x: 2.25, y: 2.25, szer: 58.5, wys: 83.5 });
  });

  it('rewers ze spadem rozszerza tło i teksturę do brutto, a ramka i warstwy zostają w netto', () => {
    const rewers: Rewers = {
      id: 'rev1',
      nazwa: 'Tył',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#0f172a',
      teksturaTla: 'tex',
      teksturaTryb: 'wypelnij',
      ramka: { styl: 'ciagla', grubosc: 0.4, kolor: '#e2e8f0', odsuniecie: 2 },
      korzen: { id: 'rk', typ: 'swobodny', dzieci: [] },
    };
    const w = renderujRewers(
      rewers,
      { czcionki, obraz: () => ({ szerokosc: 1000, wysokosc: 1400 }) },
      { szer: 63, wys: 88, promienRogow: 3, spad: 3, minDpi: MIN_DPI_DRUKARNI },
    );
    const el = splaszczElementy(w.scena.elementy);
    expect(el.find((e) => e.typ === 'prostokat' && e.wypelnienie === '#0f172a')).toMatchObject({
      x: -3,
      y: -3,
      szer: 69,
      wys: 94,
    });
    expect(el.find((e) => e.typ === 'prostokat' && e.obrys?.kolor === '#e2e8f0')).toMatchObject({
      x: 2.2,
      y: 2.2,
      szer: 58.6,
      wys: 83.6,
    });
    expect(w.ostrzezenia).toEqual([]);
  });
});

describe('M4-5: efektywne DPI rastra po kadrowaniu i niezależność grafiki wektorowej', () => {
  it('efektywneDpiObrazu liczy gęstość pikseli po kadrowaniu, rozciąganiu, obrocie i ukryciu kadru', () => {
    // 600×600 px w 50.8×50.8 mm (2×2 cale) = 300 DPI.
    expect(
      efektywneDpiObrazu({ szerokosc: 600, wysokosc: 600 }, { x: 0, y: 0, szer: 50.8, wys: 50.8 }),
    ).toBeCloseTo(300, 3);
    // Powiększenie 2× (rysuje 101.6×101.6 mm przycięte do 50.8×50.8 mm) → tylko 300×300 px użyte → 150 DPI!
    expect(
      efektywneDpiObrazu(
        { szerokosc: 600, wysokosc: 600 },
        { x: -25.4, y: -25.4, szer: 101.6, wys: 101.6 },
        { x: 0, y: 0, szer: 50.8, wys: 50.8 },
      ),
    ).toBeCloseTo(150, 3);
    // Rozciągnięcie niesymetryczne: bierze mniejsze DPI z osi X/Y.
    expect(
      efektywneDpiObrazu({ szerokosc: 1200, wysokosc: 400 }, { x: 0, y: 0, szer: 50.8, wys: 50.8 }),
    ).toBeCloseTo(200, 3);
    // Obraz przesunięty całkowicie poza przycięcie nie jest widoczny → brak ostrzeżenia.
    expect(
      efektywneDpiObrazu(
        { szerokosc: 100, wysokosc: 100 },
        { x: 100, y: 0, szer: 50, wys: 50 },
        { x: 0, y: 0, szer: 50, wys: 50 },
      ),
    ).toBeUndefined();
  });

  it('wykrywa niskie DPI po kadrowaniu „wypełnij” i powiększeniu, ignorując wektory', () => {
    const szablon = szablonKarty();
    const bazaKarty: Karta = {
      id: 'k1',
      szablonId: szablon.id,
      ilosc: 1,
      dane: { nazwa: 'Test', obraz: 'img' },
    };

    // 1. Wysoka rozdzielczość (1000×1000 px na 50×50 mm → 508 DPI) → brak ostrzeżeń.
    const ok = renderujKarte(
      szablon,
      bazaKarty,
      { czcionki, obraz: () => ({ szerokosc: 1000, wysokosc: 1000 }) },
      { minDpi: MIN_DPI_DRUKARNI },
    );
    expect(ok.ostrzezenia).toEqual([]);

    // 2. Ten sam obraz 1000×1000 px, ale powiększony 2× (skala: 2 → użyte 500×500 px → 254 DPI < 300)!
    const poZoomie = renderujKarte(
      szablon,
      { ...bazaKarty, obrazy: { grafika: { skala: 2 } } },
      { czcionki, obraz: () => ({ szerokosc: 1000, wysokosc: 1000 }) },
      { minDpi: MIN_DPI_DRUKARNI },
    );
    expect(poZoomie.ostrzezenia).toContainEqual({
      pole: 'grafika',
      komunikat: 'niska-rozdzielczosc-obrazu',
      szczegoly: '254',
    });

    // 3. Panorama 1200×500 px w kwadracie 50×50 mm z trybem „wypełnij”:
    // naiwne 1200 / (50/25.4) = 609 DPI, ale faktycznie użyte po kadrowaniu 500×500 px → 254 DPI < 300!
    const panorama = renderujKarte(
      szablon,
      bazaKarty,
      { czcionki, obraz: () => ({ szerokosc: 1200, wysokosc: 500 }) },
      { minDpi: MIN_DPI_DRUKARNI },
    );
    expect(panorama.ostrzezenia).toContainEqual({
      pole: 'grafika',
      komunikat: 'niska-rozdzielczosc-obrazu',
      szczegoly: '254',
    });

    // 4. Tekstura tła wystarczająca w netto (760×1060 px dla 63×88 mm → ~306 DPI),
    // ale po rozciągnięciu na brutto ze spadem 3 mm (69×94 mm → ~279 DPI < 300) zgłasza ostrzeżenie!
    const szTex = szablonKarty({ teksturaTla: 'tex' });
    const kartaBezObrazu: Karta = {
      id: 'k2',
      szablonId: szTex.id,
      ilosc: 1,
      dane: { nazwa: 'Tło' },
    };
    const nettoOk = renderujKarte(
      szTex,
      kartaBezObrazu,
      { czcionki, obraz: () => ({ szerokosc: 760, wysokosc: 1060 }) },
      { spad: 0, minDpi: MIN_DPI_DRUKARNI },
    );
    expect(nettoOk.ostrzezenia.filter((o) => o.komunikat === 'niska-rozdzielczosc-obrazu')).toEqual(
      [],
    );
    const bruttoZaMale = renderujKarte(
      szTex,
      kartaBezObrazu,
      { czcionki, obraz: () => ({ szerokosc: 760, wysokosc: 1060 }) },
      { spad: 3, minDpi: MIN_DPI_DRUKARNI },
    );
    expect(bruttoZaMale.ostrzezenia).toContainEqual({
      pole: 'tlo-karty',
      komunikat: 'niska-rozdzielczosc-obrazu',
      szczegoly: '279',
    });

    // 5. Sama grafika wektorowa (ikony SVG, ramki, tekst, ozdobniki) nigdy nie wywołuje ostrzeżeń DPI.
    const tylkoWektor = szablonKarty({
      ramka: {
        styl: 'ciagla',
        grubosc: 0.4,
        kolor: '#111111',
        narozniki: { element: 'wb:kat', rozmiar: 6 },
      },
      korzen: {
        id: 'kw',
        typ: 'kolumna',
        padding: 4,
        dzieci: [
          {
            id: 't',
            typ: 'tekst',
            klucz: 'nazwa',
            styl: { czcionka: 'tytul', rozmiar: pt(12), kolor: '#ffffff' },
          },
          { id: 's', typ: 'separator', kierunek: 'poziomy', grubosc: 0.4, rysunek: 'linia' },
          { id: 'i', typ: 'ikona', ikona: 'gwiazdka', element: 'wb:gwiazda', rozmiar: 30 },
        ],
      },
    });
    const wWektor = renderujKarte(
      tylkoWektor,
      { dane: { nazwa: 'Wektor' } },
      { czcionki },
      { spad: 3, minDpi: MIN_DPI_DRUKARNI },
    );
    expect(wWektor.ostrzezenia).toEqual([]);
  });
});

describe('M4-5: układ siatki, pojedynczej karty, zbyt mały papier i druk dwustronny', () => {
  it('układ pojedynczej karty generuje osobną stronę na każdy egzemplarz ze spadem i znacznikami', () => {
    const s = szablonKarty({ teksturaTla: undefined });
    const k1: Karta = { id: 'k1', szablonId: s.id, ilosc: 2, dane: { nazwa: 'Karta A' } };
    const k2: Karta = { id: 'k2', szablonId: s.id, ilosc: 1, dane: { nazwa: 'Karta B' } };
    const talia: Talia = { id: 't1', nazwa: 'Talia', karty: [k1, k2] };
    const ark = arkuszBazowy({
      drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'pojedyncza' },
    });
    const w = zbudujArkusz(ark, talia, { czcionki, szablony: new Map([[s.id, s]]) });
    expect(w.strony).toHaveLength(3);
    expect(w.pozycjeKart).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect([w.strony[i]!.szer, w.strony[i]!.wys]).toEqual([83, 108]);
      expect(w.pozycjeKart[i]).toMatchObject({ strona: i, x: 10, y: 10, szer: 63, wys: 88 });
      expect(w.strony[i]!.elementy.filter((e) => e.typ === 'linia')).toHaveLength(8);
    }

    // Bez znaczników: strona = dokładnie format brutto (69×94 mm).
    const arkBez = arkuszBazowy({
      drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: false, uklad: 'pojedyncza' },
    });
    const wBez = zbudujArkusz(arkBez, talia, { czcionki, szablony: new Map([[s.id, s]]) });
    expect([wBez.strony[0]!.szer, wBez.strony[0]!.wys]).toEqual([69, 94]);
    expect(wBez.strony[0]!.elementy.filter((e) => e.typ === 'linia')).toHaveLength(0);
  });

  it('siatka w trybie drukarni rezerwuje spad i odstęp na znaczniki oraz nie gubi przypiętych kart z druku domowego', () => {
    const s = szablonKarty({ teksturaTla: undefined });
    const talia: Talia = {
      id: 't1',
      nazwa: 'Talia',
      karty: [
        { id: 'k1', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K1' } },
        { id: 'k2', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K2' } },
        { id: 'k3', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K3' } },
        { id: 'k4', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K4' } },
        { id: 'k5', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K5' } },
      ],
    };
    // W druku domowym 3×3 karta k3 była przypięta w kolumnie 2 – w trybie drukarni A4 mieści 2×2.
    const ark = arkuszBazowy(
      { drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'siatka' } },
      [
        { kartaId: 'k1', kolumna: 0, rzad: 0, strona: 0 },
        { kartaId: 'k2', kolumna: 1, rzad: 0, strona: 0 },
        { kartaId: 'k3', kolumna: 2, rzad: 0, strona: 0 },
      ],
    );
    const w = zbudujArkusz(ark, talia, { czcionki, szablony: new Map([[s.id, s]]) });
    expect(w.siatka).toEqual({ kolumny: 2, rzedy: 2, grupy: false });
    expect(w.pozycjeKart).toHaveLength(5);
    expect(w.strony).toHaveLength(2);
    // Odstęp między kartami w rzędzie = 12 mm (2*3 spad + 2*1 odsunięcie + 4 znacznik).
    const naS0 = w.pozycjeKart.filter((p) => p.strona === 0);
    const kLewa = naS0.find((p) => p.x < 50 && p.y < 50)!;
    const kPrawa = naS0.find((p) => p.x > 50 && p.y < 50)!;
    expect(kPrawa.x - (kLewa.x + kLewa.szer)).toBeCloseTo(12, 6);
    // Żaden znacznik cięcia na stronie 0 nie wchodzi w obszar brutto żadnej karty.
    const linie = w.strony[0]!.elementy.filter((e) => e.typ === 'linia');
    expect(linie.length).toBeGreaterThan(0);
    for (const l of linie) {
      if (l.typ !== 'linia') continue;
      for (const c of naS0) {
        const bx1 = c.x - 3;
        const bx2 = c.x + c.szer + 3;
        const by1 = c.y - 3;
        const by2 = c.y + c.wys + 3;
        const przecina =
          Math.max(l.x1, l.x2) > bx1 + 1e-6 &&
          Math.min(l.x1, l.x2) < bx2 - 1e-6 &&
          Math.max(l.y1, l.y2) > by1 + 1e-6 &&
          Math.min(l.y1, l.y2) < by2 - 1e-6;
        expect(przecina).toBe(false);
      }
    }
  });

  it('zbyt mały papier na kartę ze spadem i znacznikami zgłasza ostrzeżenie (siatka i mieszane)', () => {
    const s = szablonKarty({ teksturaTla: undefined });
    const talia: Talia = {
      id: 't1',
      nazwa: 'Talia',
      karty: [{ id: 'k1', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K1' } }],
    };
    // Papier 70×95 mm: netto 63×88 + spad 3 mm (69×94) się mieści bez znaczników, ale ze znacznikami (79×104) już nie!
    const zaMalySiatka = arkuszBazowy({
      papier: 'wlasny',
      wymiaryPapieru: { szer: 70, wys: 95 },
      marginesy: { gora: 0, prawo: 0, dol: 0, lewo: 0 },
      drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'siatka' },
    });
    const w1 = zbudujArkusz(zaMalySiatka, talia, { czcionki, szablony: new Map([[s.id, s]]) });
    expect(w1.ostrzezenia.map((o) => o.komunikat)).toContain('papier-za-maly-na-spad');

    const zaMalyMieszane = arkuszBazowy({
      papier: 'wlasny',
      wymiaryPapieru: { szer: 70, wys: 95 },
      marginesy: { gora: 0, prawo: 0, dol: 0, lewo: 0 },
      rozmiary: 'mieszane',
      drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'siatka' },
    });
    const w2 = zbudujArkusz(zaMalyMieszane, talia, { czcionki, szablony: new Map([[s.id, s]]) });
    expect(w2.ostrzezenia).toContainEqual({ kartaId: 'k1', komunikat: 'papier-za-maly-na-spad' });
  });

  it('tryb drukarni w układzie pojedynczej karty współpracuje z drukiem dwustronnym i ostrzega o DPI na rewersie', () => {
    const s = szablonKarty({ teksturaTla: undefined });
    const rewers: Rewers = {
      id: 'rev1',
      nazwa: 'Tył',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#111827',
      teksturaTla: 'mala-tex',
      korzen: { id: 'rk', typ: 'swobodny', dzieci: [] },
    };
    const talia: Talia = {
      id: 't1',
      nazwa: 'Talia',
      rewersId: rewers.id,
      karty: [{ id: 'k1', szablonId: s.id, ilosc: 1, dane: { nazwa: 'K1' } }],
    };
    const ark = arkuszBazowy({
      drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'pojedyncza' },
      dwustronny: { wlaczony: true, krawedz: 'dluga' },
    });
    const ctx = {
      czcionki,
      szablony: new Map([[s.id, s]]),
      obraz: (id: string) => (id === 'mala-tex' ? { szerokosc: 200, wysokosc: 300 } : undefined),
    };
    const przod = zbudujArkusz(ark, talia, ctx);
    const tyl = zbudujStronyRewersow(ark, talia, przod, {
      ...ctx,
      rewersy: new Map([[rewers.id, rewers]]),
    });
    expect(tyl.strony).toHaveLength(1);
    expect([tyl.strony[0]!.szer, tyl.strony[0]!.wys]).toEqual([83, 108]);
    expect(tyl.strony[0]!.elementy.filter((e) => e.typ === 'linia')).toHaveLength(8);
    expect(
      tyl.ostrzezenia.some((o) => o.komunikat.startsWith('niska-rozdzielczosc-obrazu:tlo-karty:')),
    ).toBe(true);

    // Sceny zadania PDF przeplatają przód i tył o identycznym wymiarze pojedynczej karty.
    const czPlik = new Uint8Array(readFileSync('public/czcionki/EBGaramond-Regular.ttf'));
    const sceny = scenyZadaniaPdf({
      tytul: 'Drukarnia',
      arkusze: [ark],
      talie: [talia],
      szablony: [s],
      rewersy: [rewers],
      czcionki: [{ id: 'c1', rodzina: 'EB Garamond', wariant: 'normalny', dane: czPlik }],
      role: { tytul: 'EB Garamond', tresc: 'EB Garamond' },
      obrazy: [],
    });
    expect(sceny).toHaveLength(2);
    expect([sceny[0]!.szer, sceny[0]!.wys]).toEqual([83, 108]);
    expect([sceny[1]!.szer, sceny[1]!.wys]).toEqual([83, 108]);
  });

  it('grupy talii w trybie drukarni nie nakładają spadów ani znaczników między grupami', () => {
    const s = szablonKarty({
      rozmiar: { tryb: 'mm', szerokosc: 40, wysokosc: 60 },
      teksturaTla: undefined,
    });
    const karty: Karta[] = Array.from({ length: 6 }, (_, i) => ({
      id: `g${i + 1}`,
      szablonId: s.id,
      ilosc: 1,
      dane: { nazwa: `Karta ${i + 1}` },
    }));
    const talia: Talia = {
      id: 't1',
      nazwa: 'Talia z grupami',
      karty,
      grupy: [
        { id: 'gr1', naglowek: 'Grupa 1', karty: ['g1', 'g2', 'g3', 'g4'] },
        { id: 'gr2', naglowek: 'Grupa 2', karty: ['g5', 'g6'] },
      ],
    };
    const ark = arkuszBazowy({
      orientacja: 'pozioma',
      grupy: {
        styl: { czcionka: 'tytul', rozmiar: pt(10), kolor: '#000000' },
        stylOpisu: { czcionka: 'tresc', rozmiar: pt(8), kolor: '#333333' },
        odstep: 4,
        odstepOdKart: 3,
      },
      drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'siatka' },
    });
    const w = zbudujArkusz(ark, talia, { czcionki, szablony: new Map([[s.id, s]]) });
    expect(w.pozycjeKart).toHaveLength(6);
    const naS0 = w.pozycjeKart.filter((p) => p.strona === 0);
    // Żadne dwie karty (włącznie z sąsiednimi grupami) nie mogą zbliżyć się na mniej niż 12 mm w X lub Y.
    for (let i = 0; i < naS0.length; i++) {
      for (let j = i + 1; j < naS0.length; j++) {
        const a = naS0[i]!;
        const b = naS0[j]!;
        const dx = Math.max(b.x - (a.x + a.szer), a.x - (b.x + b.szer));
        const dy = Math.max(b.y - (a.y + a.wys), a.y - (b.y + b.wys));
        expect(Math.max(dx, dy)).toBeGreaterThanOrEqual(12 - 1e-6);
      }
    }
  });
});
