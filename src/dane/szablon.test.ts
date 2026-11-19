import { describe, expect, it } from 'vitest';
import type { Projekt } from '../model/projekt';
import {
  czyKontener,
  kluczeTabeli,
  korzenKarty,
  maStylTekstu,
  stylPola,
  type Kontener,
  type PoleSeparator,
  type Szablon,
  type Wezel,
} from '../model/szablon';
import { znajdzElement } from '../ozdobniki';
import { ZESTAWY_STYLOW } from '../ozdobniki/zestawyStylow';
import { kolumnySzablonu } from './edycja';
import {
  danePodgladu,
  doPoprzedniegoKontenera,
  duplikujWezel,
  duplikujSzablon,
  nazwaKopiiSzablonu,
  kluczZNazwy,
  nazwaKarty,
  nowySzablon,
  UKLADY_STARTOWE,
  nowyWezel,
  opakuj,
  przeniesWezel,
  przesunWezel,
  rodzicWezla,
  usunWezly,
  wstawWezel,
  wyzej,
  skopiujStyl,
  wklejStyl,
  wszystkieWezly,
  zastosujZestawStylu,
  przypiszGrupeStylu,
  utworzGrupeStylu,
  usunGrupeStylu,
  zmienGrupeStylu,
  zmienSzablon,
  zmienTypKontenera,
  zmienTypPola,
  zmienWezel,
  znajdzWezel,
} from './szablon';

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
const pusty = () =>
  nowySzablon(
    's',
    { nazwa: 'Moja karta', szer: 63, wys: 88, promien: 3, tlo: '#ffffff', uklad: 'pusty' },
    NAZWY,
  );
const ids = (k: Kontener) => k.dzieci.map((d) => d.id);

describe('zestawy stylów', () => {
  it('łączy zgodne rodzaje wbudowanych ozdobników', () => {
    for (const z of ZESTAWY_STYLOW) {
      expect(znajdzElement(z.ozdoba.element)?.rodzaj).toBe('motyw');
      expect(znajdzElement(z.narozniki.element)?.rodzaj).toBe('naroznik');
      expect(znajdzElement(z.separator.zakonczenia.element)?.rodzaj).toBe('zakonczenie');
      expect(znajdzElement(z.separator.srodek.element)?.rodzaj).toBe('srodek');
      if (typeof z.separator.rysunek === 'object')
        expect(znajdzElement(z.separator.rysunek.motyw)?.rodzaj).toBe('motyw');
    }
  });

  it('zmienia tylko ramkę i wygląd istniejących separatorów we wszystkich wariantach', () => {
    const s = pusty();
    const opis = nowyWezel(s, 'tekst', 'Opis');
    const separator = {
      ...nowyWezel(s, 'separator', 'Ozdoba'),
      dlugosc: { procent: 70 },
      rysunek: { motyw: 'wb:przeplot', szerokosc: 3 },
      kolor: '#222222',
      zakonczenia: { element: 'wb:zak-kropka', rozmiar: 3 },
    } as PoleSeparator;
    const pionowy = { ...separator, id: 'pionowy', kierunek: 'pionowy' as const };
    const przed: Szablon = {
      ...s,
      rozmiar: { tryb: 'sloty', slot: { szerokosc: 63, wysokosc: 44 }, kolumny: 1, rzedy: 1 },
      ramka: {
        grubosc: 0.6,
        odsuniecie: 2,
        promien: 5,
        kolor: '#123456',
        ozdoba: { rodzaj: 'ramka9', element: 'wlasna-ramka', grubosc: 3 },
      },
      korzen: { ...s.korzen, dzieci: [opis, separator] },
      warianty: [
        { kolumny: 1, rzedy: 2, korzen: { ...s.korzen, id: 'wariant', dzieci: [pionowy] } },
      ],
    };
    const kopia = structuredClone(przed);
    const zestaw = ZESTAWY_STYLOW[1];
    const nowy = zastosujZestawStylu(przed, zestaw);

    expect(nowy.ramka).toEqual({
      ...przed.ramka,
      ozdoba: zestaw.ozdoba,
      narozniki: zestaw.narozniki,
    });
    expect(nowy.korzen.dzieci).toEqual([opis, { ...separator, ...zestaw.separator }]);
    expect(korzenKarty(nowy, { rozmiar: { kolumny: 1, rzedy: 2 } }).dzieci).toEqual([
      { ...pionowy, ...zestaw.separator },
    ]);
    expect(nowy.rozmiar).toBe(przed.rozmiar);
    expect(przed).toEqual(kopia);
    const zInnaKolejnoscia = {
      ...nowy,
      ramka: {
        ...nowy.ramka!,
        narozniki: { rozmiar: zestaw.narozniki.rozmiar, element: zestaw.narozniki.element },
      },
    };
    expect(zastosujZestawStylu(zInnaKolejnoscia, zestaw)).toBe(zInnaKolejnoscia);
  });

  it('na pustej karcie dodaje ramkę bez wstawiania separatora', () => {
    const przed = pusty();
    const nowy = zastosujZestawStylu(przed, ZESTAWY_STYLOW[0]);
    expect(nowy.korzen).toEqual(przed.korzen);
    expect(nowy.ramka?.ozdoba).toEqual(ZESTAWY_STYLOW[0].ozdoba);
    expect(nowy.warianty).toBeUndefined();
  });
});

describe('klucze i nowe pola', () => {
  it('klucz z nazwy: bez diakrytyków, unikalny', () => {
    expect(kluczZNazwy('Czas trwania', new Set())).toBe('czas_trwania');
    expect(kluczZNazwy('Łódź!', new Set())).toBe('lodz');
    expect(kluczZNazwy('Opis', new Set(['opis']))).toBe('opis_2');
    expect(kluczZNazwy('***', new Set())).toBe('pole');
  });

  it('każdy rodzaj pola ma neutralne ustawienia i własny klucz; nazwa trafia do danych', () => {
    let s = pusty();
    for (const r of [
      'tekst',
      'etykieta-wartosc',
      'wartosc',
      'obraz',
      'znaczniki',
      'wpis',
      'ikona',
      'separator',
      'tabela',
      'wiersz',
    ] as const) {
      s = wstawWezel(s, 'karta', nowyWezel(s, r, `Nowe ${r}`));
    }
    expect(s.korzen.dzieci).toHaveLength(10);
    const k = kolumnySzablonu(s);
    expect(new Set(k.map((x) => x.klucz)).size).toBe(k.length);
    expect(k.find((x) => x.klucz === 'nowe_tekst')?.nazwa).toBe('Nowe tekst');
    // Tabela: trzy kolumny, każda komórka osobnym polem danych.
    expect(k.filter((x) => x.typPola === 'tabela')).toHaveLength(3);
    expect(nowyWezel(s, 'separator', 'x', { wWierszu: true })).toMatchObject({
      kierunek: 'pionowy',
    });
  });
});

describe('drzewo', () => {
  const zTrzema = () => {
    let s = pusty();
    for (const n of ['A', 'B', 'C']) s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', n));
    s = wstawWezel(s, 'karta', nowyWezel(s, 'wiersz', 'W'));
    return s;
  };

  it('wstawianie: do kontenera na koniec, za polem – obok', () => {
    const s = zTrzema();
    expect(ids(s.korzen)).toEqual(['tekst', 'tekst-2', 'tekst-3', 'wiersz']);
    const t = wstawWezel(s, 'tekst', nowyWezel(s, 'tekst', 'X'));
    expect(ids(t.korzen)).toEqual(['tekst', 'tekst-4', 'tekst-2', 'tekst-3', 'wiersz']);
  });

  it('przesuwanie, wcięcie do kontenera, wysunięcie, przeniesienie', () => {
    let s = zTrzema();
    s = przesunWezel(s, 'tekst-3', -1);
    expect(ids(s.korzen)).toEqual(['tekst', 'tekst-3', 'tekst-2', 'wiersz']);
    expect(przesunWezel(s, 'tekst', -1)).toBe(s);
    // Pole za wierszem → do wiersza.
    s = przeniesWezel(s, 'tekst', 'karta', 4);
    expect(ids(s.korzen)).toEqual(['tekst-3', 'tekst-2', 'wiersz', 'tekst']);
    s = doPoprzedniegoKontenera(s, 'tekst');
    expect(ids(znajdzWezel(s, 'wiersz') as Kontener)).toEqual(['tekst']);
    s = wyzej(s, 'tekst');
    expect(ids(s.korzen)).toEqual(['tekst-3', 'tekst-2', 'wiersz', 'tekst']);
    // Nie można przenieść kontenera do własnego wnętrza ani korzenia.
    const w = przeniesWezel(s, 'tekst-2', 'wiersz', 0);
    expect(przeniesWezel(w, 'wiersz', 'wiersz', 0)).toBe(w);
    expect(przeniesWezel(w, 'karta', 'wiersz', 0)).toBe(w);
  });

  it('opakowanie w kontener, duplikat z nowymi kluczami, usuwanie bez korzenia', () => {
    let s = zTrzema();
    const o = opakuj(s, ['tekst-2', 'tekst'], 'wiersz', 'Para');
    s = o.szablon;
    expect(ids(s.korzen)).toEqual([o.id, 'tekst-3', 'wiersz']);
    expect(ids(znajdzWezel(s, o.id) as Kontener)).toEqual(['tekst', 'tekst-2']);
    const d = duplikujWezel(s, o.id, '(kopia)');
    const kopia = znajdzWezel(d.szablon, d.id) as Kontener;
    expect(kopia.nazwa).toBe('Para (kopia)');
    const pola = kopia.dzieci.filter((x) => !czyKontener(x));
    expect(pola.map((x) => !czyKontener(x) && x.klucz)).toEqual(['a_kopia', 'b_kopia']);
    expect(rodzicWezla(d.szablon, d.id)?.indeks).toBe(1);
    expect(usunWezly(d.szablon, ['karta', d.id]).korzen.dzieci).toHaveLength(3);
  });
});

describe('nowy szablon', () => {
  it('pokazuje układ swobodny pierwszy i zachowuje korzenie obu skrajnych układów', () => {
    expect(UKLADY_STARTOWE).toEqual([
      'swobodny',
      'tytul-opis',
      'tytul-siatka-opis-stopka',
      'pusty',
    ]);
    const opcje = { nazwa: 'Karta', szer: 63, wys: 88, promien: 0, tlo: '#ffffff' };
    expect(nowySzablon('s', { ...opcje, uklad: 'swobodny' }, NAZWY).korzen.typ).toBe('swobodny');
    expect(nowySzablon('p', { ...opcje, uklad: 'pusty' }, NAZWY).korzen).toMatchObject({
      typ: 'kolumna',
      dzieci: [],
    });
  });

  it('układy startowe: neutralne nazwy, siatka 2×2 etykieta/wartość, stopka', () => {
    const s: Szablon = nowySzablon(
      's',
      {
        nazwa: 'K',
        szer: 63,
        wys: 88,
        promien: 0,
        tlo: '#3366aa',
        uklad: 'tytul-siatka-opis-stopka',
      },
      NAZWY,
    );
    expect(s.rozmiar).toEqual({ tryb: 'mm', szerokosc: 63, wysokosc: 88 });
    expect(s.korzen.dzieci.map((d) => d.nazwa)).toEqual(['Tytuł', 'Siatka', 'Opis', 'Stopka']);
    const k = kolumnySzablonu(s).map((x) => x.nazwa);
    expect(k).toEqual([
      'Tytuł',
      'Pole 1',
      'Pole 2',
      'Pole 3',
      'Pole 4',
      'Opis',
      'Stopka lewa',
      'Stopka prawa',
    ]);
    // Kolorowa karta – białe panele pod treścią.
    expect(znajdzWezel(s, 'tekst-2')).toMatchObject({ tlo: '#ffffff' });
    expect(
      nowySzablon(
        'p',
        { nazwa: 'P', szer: 63, wys: 88, promien: 0, tlo: '#ffffff', uklad: 'tytul-opis' },
        NAZWY,
      ).korzen.dzieci,
    ).toHaveLength(2);
  });
});

describe('poprawki po przeglądzie', () => {
  it('trzy pola o tej samej nazwie i dwa duplikaty tabeli – klucze bez kolizji', () => {
    let s = pusty();
    for (let i = 0; i < 3; i++) s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', 'Tekst'));
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tabela', 'Tabela'));
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tabela', 'Tabela'));
    s = duplikujWezel(s, 'tabela', '(kopia)').szablon;
    s = duplikujWezel(s, 'tabela', '(kopia)').szablon;
    // Wszystkie klucze (z powtórzeniami) – także komórek dalszych wierszy tabel.
    const wszystkie = (x: Szablon) =>
      wszystkieWezly(x).flatMap((w) =>
        czyKontener(w) ? [] : w.typ === 'tabela' ? kluczeTabeli(w) : w.klucz ? [w.klucz] : [],
      );
    const k = wszystkie(s);
    expect(new Set(k).size).toBe(k.length);
    expect(k.slice(0, 3)).toEqual(['tekst', 'tekst_2', 'tekst_3']);
    // Więcej wierszy w każdej tabeli – nadal bez kolizji.
    const wiecej = wszystkieWezly(s).reduce(
      (x, w) =>
        w.typ === 'tabela' ? zmienWezel(x, w.id, (t) => ({ ...t, wiersze: 3 }) as Wezel) : x,
      s,
    );
    const k3 = wszystkie(wiecej);
    expect(new Set(k3).size).toBe(k3.length);
  });

  it('klucze zajęte w danych kart nie wracają do nowych pól', () => {
    const s = pusty();
    expect((nowyWezel(s, 'tekst', 'Opis', { zajete: ['opis'] }) as { klucz: string }).klucz).toBe(
      'opis_2',
    );
  });

  it('operacja bez skutku nie zmienia projektu (bez kroku „Cofnij”)', () => {
    const s = wstawWezel(pusty(), 'karta', nowyWezel(pusty(), 'tekst', 'A'));
    const p = { szablony: [s] } as unknown as Projekt;
    expect(zmienSzablon(p, 's', (x) => przesunWezel(x, 'tekst', -1))).toBe(p);
    expect(zmienSzablon(p, 's', (x) => doPoprzedniegoKontenera(x, 'tekst'))).toBe(p);
    expect(zmienSzablon(p, 's', (x) => wyzej(x, 'tekst'))).toBe(p);
    expect(zmienSzablon(p, 'brak', (x) => x)).toBe(p);
  });

  it('duplikat: obraz omija kopie pól, etykieta idzie za nazwą', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', nowyWezel(s, 'warstwy', 'Grupa'));
    s = wstawWezel(s, 'warstwy', nowyWezel(s, 'wartosc', 'Wartość'));
    s = wstawWezel(s, 'warstwy', {
      ...nowyWezel(s, 'obraz', 'Obraz'),
      omijaj: ['wartosc'],
    } as Wezel);
    s = wstawWezel(s, 'karta', nowyWezel(s, 'etykieta-wartosc', 'Siła'));
    const d = duplikujWezel(s, 'warstwy', '(kopia)');
    const kopia = znajdzWezel(d.szablon, d.id) as Kontener;
    const obraz = kopia.dzieci.find((x) => x.typ === 'obraz') as { omijaj: string[] };
    expect(obraz.omijaj).toEqual([kopia.dzieci[0]!.id]);
    const e = duplikujWezel(s, 'etykieta-wartosc', '(kopia)');
    expect(znajdzWezel(e.szablon, e.id)).toMatchObject({
      nazwa: 'Siła (kopia)',
      etykieta: { tekst: 'Siła (kopia)' },
    });
  });

  it('dane podglądu i nazwa karty', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', 'Imię'));
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tabela', 'Cechy'));
    expect(danePodgladu({ ...s, przyklad: { imie: 'Ala' } })).toMatchObject({
      imie: 'Ala',
      cechy_1: '–',
    });
    expect(danePodgladu(s).imie).toBe('Imię');
    expect(nazwaKarty({ imie: 'Gryf' }, s)).toBe('Gryf');
    expect(nazwaKarty({ nazwa: 'N', imie: 'Gryf' }, s)).toBe('N');
    expect(nazwaKarty({}, s)).toBe('');
  });
});

describe('zmiana typu pola', () => {
  it('tekst → wartość w kształcie: zostaje klucz, nazwa, rozmiar i styl', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', {
      ...nowyWezel(s, 'tekst', 'Siła'),
      szerokosc: { mm: 10 },
    } as Wezel);
    s = zmienTypPola(s, 'tekst', 'wartosc');
    expect(znajdzWezel(s, 'tekst')).toMatchObject({
      typ: 'wartosc',
      nazwa: 'Siła',
      klucz: 'sila',
      szerokosc: { mm: 10 },
      ksztalt: 'prostokat',
    });
    // Separator nie ma danych – klucz znika.
    const t = zmienTypPola(s, 'tekst', 'separator');
    expect(znajdzWezel(t, 'tekst')).not.toHaveProperty('klucz');
    expect(zmienTypPola(t, 'tekst', 'separator')).toBe(t);
  });
});

describe('zmiana typu – przypadki brzegowe, kopiowanie stylu', () => {
  it('pole stałe zostaje stałe; tekst ↔ tabela; etykieta tekst → wartość; zajęte klucze', () => {
    let s = pusty();
    const staly = { ...nowyWezel(s, 'tekst', 'Napis'), tekst: 'Zawsze' } as Wezel;
    delete (staly as { klucz?: string }).klucz;
    s = wstawWezel(s, 'karta', staly);
    const w = znajdzWezel(zmienTypPola(s, 'tekst', 'wartosc'), 'tekst');
    expect(w).toMatchObject({ typ: 'wartosc', tekst: 'Zawsze' });
    expect(w).not.toHaveProperty('klucz');
    // Tekst z etykietą „przed” → wartość: etykieta „nad”.
    let t = wstawWezel(pusty(), 'karta', {
      ...nowyWezel(pusty(), 'tekst', 'Moc'),
      etykieta: { tekst: 'Moc', pozycja: 'przed' },
    } as Wezel);
    t = zmienTypPola(t, 'tekst', 'wartosc');
    expect(znajdzWezel(t, 'tekst')).toMatchObject({ etykieta: { tekst: 'Moc', pozycja: 'nad' } });
    // Na tabelę: klucze kolumn omijają zajęte (dane kart po usuniętych polach).
    const tab = zmienTypPola(t, 'tekst', 'tabela', 'Tabela', ['moc_1']);
    const kol = (znajdzWezel(tab, 'tekst') as { kolumny: { klucz: string }[] }).kolumny;
    expect(kol.map((k) => k.klucz)).not.toContain('moc_1');
    // Z tabeli na tekst: nowy klucz z nazwy.
    expect(znajdzWezel(zmienTypPola(tab, 'tekst', 'tekst'), 'tekst')).toMatchObject({
      typ: 'tekst',
    });
  });

  it('wiersz ↔ kolumna obraca separatory', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', nowyWezel(s, 'wiersz', 'W'));
    s = wstawWezel(s, 'wiersz', nowyWezel(s, 'separator', 'S', { wWierszu: true }));
    expect(znajdzWezel(s, 'separator')).toMatchObject({ kierunek: 'pionowy' });
    s = zmienTypKontenera(s, 'wiersz', 'kolumna');
    expect(znajdzWezel(s, 'separator')).toMatchObject({ kierunek: 'poziomy' });
  });

  it('kopiuj/wklej styl: wygląd do każdego, styl tekstu do pól z tekstem, kształt i linie – tylko ten sam typ', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', {
      ...nowyWezel(s, 'wartosc', 'A'),
      ksztalt: 'romb',
      tlo: '#ff0000',
      styl: { czcionka: 'tytul', rozmiar: 5 },
    } as Wezel);
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', 'B'));
    s = wstawWezel(s, 'karta', nowyWezel(s, 'wartosc', 'C'));
    s = wstawWezel(s, 'karta', nowyWezel(s, 'wiersz', 'D'));
    const st = skopiujStyl(znajdzWezel(s, 'wartosc')!);
    expect(wklejStyl(znajdzWezel(s, 'tekst')!, st)).toMatchObject({
      tlo: '#ff0000',
      styl: { czcionka: 'tytul', rozmiar: 5 },
    });
    expect(wklejStyl(znajdzWezel(s, 'tekst')!, st)).not.toHaveProperty('ksztalt');
    expect(wklejStyl(znajdzWezel(s, 'wartosc-2')!, st)).toMatchObject({ ksztalt: 'romb' });
    const w = wklejStyl(znajdzWezel(s, 'wiersz')!, st);
    expect(w).toMatchObject({ tlo: '#ff0000' });
    expect(w).not.toHaveProperty('styl');
  });
});

describe('M2b-4: ozdoba (motyw) w edycji szablonu', () => {
  const oz = { rodzaj: 'motyw' as const, element: 'wb:runy', szerokosc: 4, kolor: '#2f5d8a' };

  it('skopiujStyl i wklejStyl przenoszą ozdobę, a przy jej braku w źródle usuwają z celu', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', { ...nowyWezel(s, 'tekst', 'A'), ozdoba: oz } as Wezel);
    s = wstawWezel(s, 'karta', {
      ...nowyWezel(s, 'tekst', 'B'),
      ozdoba: { ...oz, szyny: 1 },
    } as Wezel);
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', 'C'));
    const st = skopiujStyl(znajdzWezel(s, 'tekst')!);
    expect(st.ozdoba).toEqual(oz);
    // Kopia głęboka – zmiana schowka nie rusza źródła.
    expect(st.ozdoba).not.toBe((znajdzWezel(s, 'tekst') as { ozdoba: unknown }).ozdoba);
    expect(wklejStyl(znajdzWezel(s, 'tekst-3')!, st)).toMatchObject({ ozdoba: oz });
    expect(wklejStyl(znajdzWezel(s, 'tekst-2')!, st)).toMatchObject({ ozdoba: oz });
    // Źródło bez ozdoby: cel traci ozdobę.
    const bez = skopiujStyl(znajdzWezel(s, 'tekst-3')!);
    expect(wklejStyl(znajdzWezel(s, 'tekst-2')!, bez)).not.toHaveProperty('ozdoba');
  });

  it('zmiana typu pola zachowuje ozdobę', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', { ...nowyWezel(s, 'tekst', 'Siła'), ozdoba: oz } as Wezel);
    s = zmienTypPola(s, 'tekst', 'wartosc');
    expect(znajdzWezel(s, 'tekst')).toMatchObject({ typ: 'wartosc', ozdoba: oz });
  });
});

describe('M2b-5: separator ozdobny w edycji szablonu', () => {
  const sep = {
    rysunek: { motyw: 'wb:przeplot', szerokosc: 2.5 },
    zakonczenia: { element: 'wb:zak-kolec', rozmiar: 2 },
    srodek: { element: 'wb:sr-gwiazda', rozmiar: 3 },
    dlugosc: { procent: 70 },
    odstepOdOzdoby: 0.6,
  };

  it('wzory startowe: linia, linia z zakończeniami i środkiem, motyw; w wierszu – pionowe', () => {
    const s = pusty();
    const linia = nowyWezel(s, 'separator', 'S');
    expect(linia).toMatchObject({ typ: 'separator', kierunek: 'poziomy' });
    expect(linia).not.toHaveProperty('zakonczenia');
    const zak = nowyWezel(s, 'separator-zakonczenia', 'S', { wWierszu: true });
    expect(zak).toMatchObject({
      typ: 'separator',
      kierunek: 'pionowy',
      zakonczenia: { element: 'wb:zak-grot' },
      srodek: { element: 'wb:sr-romb' },
    });
    const motyw = nowyWezel(s, 'separator-motyw', 'S');
    expect(motyw).toMatchObject({ typ: 'separator', rysunek: { motyw: 'wb:lancuch' } });
    expect(zak.id).toMatch(/^separator/);
    expect(motyw.id).toMatch(/^separator/);
    for (const e of [zak, motyw] as Extract<Wezel, { typ: 'separator' }>[]) {
      expect(znajdzElement(e.zakonczenia!.element)).toBeDefined();
    }
  });

  it('skopiujStyl i wklejStyl przenoszą nowe pola, a przy ich braku w źródle czyszczą cel', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', { ...nowyWezel(s, 'separator', 'A'), ...sep } as Wezel);
    s = wstawWezel(s, 'karta', nowyWezel(s, 'separator', 'B'));
    s = wstawWezel(s, 'karta', { ...nowyWezel(s, 'separator', 'C'), ...sep } as Wezel);
    const st = skopiujStyl(znajdzWezel(s, 'separator')!);
    expect(st).toMatchObject(sep);
    const b = wklejStyl(znajdzWezel(s, 'separator-2')!, st);
    expect(b).toMatchObject(sep);
    const pusta = skopiujStyl(znajdzWezel(s, 'separator-2')!);
    const c = wklejStyl(znajdzWezel(s, 'separator-3')!, pusta);
    for (const k of ['rysunek', 'zakonczenia', 'srodek', 'dlugosc', 'odstepOdOzdoby'])
      expect(c).not.toHaveProperty(k);
  });

  it('wklejenie stylu separatora do innego typu nie wnosi pól separatora', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', { ...nowyWezel(s, 'separator', 'A'), ...sep } as Wezel);
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', 'T'));
    const t = wklejStyl(znajdzWezel(s, 'tekst')!, skopiujStyl(znajdzWezel(s, 'separator')!));
    for (const k of ['rysunek', 'zakonczenia', 'srodek', 'dlugosc', 'odstepOdOzdoby'])
      expect(t).not.toHaveProperty(k);
  });

  it('zmiana typu: tekst → separator daje zwykłą linię; separator → tekst gubi pola ozdób, zostaje ozdoba ramki', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', nowyWezel(s, 'tekst', 'Siła'));
    s = zmienTypPola(s, 'tekst', 'separator');
    expect(znajdzWezel(s, 'tekst')).toMatchObject({ typ: 'separator' });
    expect(znajdzWezel(s, 'tekst')).not.toHaveProperty('zakonczenia');
    s = zmienWezel(s, 'tekst', (w) => ({
      ...w,
      ...sep,
      ozdoba: { rodzaj: 'motyw', element: 'wb:runy', szerokosc: 4, kolor: '#000000' },
    }));
    // Ten sam typ – bez zmian (pola zostają).
    expect(zmienTypPola(s, 'tekst', 'separator')).toBe(s);
    const t = znajdzWezel(zmienTypPola(s, 'tekst', 'wartosc'), 'tekst');
    expect(t).toMatchObject({ typ: 'wartosc', ozdoba: { element: 'wb:runy' } });
    expect(t).not.toHaveProperty('zakonczenia');
  });

  it('zmiana typu kontenera obraca separatory ozdobne, zachowując ich pola', () => {
    let s = pusty();
    s = wstawWezel(s, 'karta', { ...nowyWezel(s, 'separator', 'A'), ...sep } as Wezel);
    const w = zmienTypKontenera(s, 'karta', 'wiersz');
    expect(znajdzWezel(w, 'separator')).toMatchObject({ kierunek: 'pionowy', ...sep });
  });
});

it('kopia szablonu ma odrębne węzły, jego obraz omija skopiowany tekst', () => {
  let s = pusty();
  const tekst = nowyWezel(s, 'tekst', 'Tytuł');
  s = wstawWezel(s, s.korzen.id, tekst);
  const obraz = nowyWezel(s, 'obraz', 'Zdjęcie');
  if (obraz.typ !== 'obraz') throw new Error('Oczekiwano obrazu');
  s = wstawWezel(s, s.korzen.id, { ...obraz, omijaj: [tekst.id] });
  s = { ...s, warianty: [{ kolumny: 1, rzedy: 1, korzen: s.korzen }] };
  const kopia = duplikujSzablon(s, 'inna', 'Moja karta (kopia)');
  expect(wszystkieWezly(kopia).map((w) => w.id)).not.toEqual(wszystkieWezly(s).map((w) => w.id));
  expect(kopia.korzen.dzieci[1]).toMatchObject({ omijaj: [kopia.korzen.dzieci[0]!.id] });
  const wariant = kopia.warianty![0]!.korzen;
  expect(wariant.dzieci[1]).toMatchObject({ omijaj: [wariant.dzieci[0]!.id] });
  expect(
    nazwaKopiiSzablonu(kopia.nazwa, [s.nazwa, kopia.nazwa], (n) =>
      n === 1 ? '(kopia)' : `(kopia ${n})`,
    ),
  ).toBe('Moja karta (kopia 2)');
});

it('M3-2: zmiana grupy działa dla wielu pól, a odłączenie przenosi ostatni styl do pola', () => {
  const s = pusty();
  const a = nowyWezel(s, 'tekst', 'Nazwa');
  const b = nowyWezel(s, 'wartosc', 'Poziom');
  let szablon = utworzGrupeStylu(
    { ...s, korzen: { ...s.korzen, dzieci: [a, b] } },
    a.id,
    'Wspólny',
  );
  const id = szablon.grupyStylow![0]!.id;
  szablon = przypiszGrupeStylu(szablon, b.id, id);
  szablon = zmienGrupeStylu(szablon, id, {
    styl: (st) => ({ ...st, rozmiar: 5, kolor: '#ff0000' }),
  });
  const pola = szablon.korzen.dzieci.filter(maStylTekstu);
  expect(pola.map((w) => stylPola(szablon, w).kolor)).toEqual(['#ff0000', '#ff0000']);
  szablon = przypiszGrupeStylu(szablon, b.id, '');
  szablon = zmienGrupeStylu(szablon, id, { styl: (st) => ({ ...st, kolor: '#00ff00' }) });
  const odlaczone = usunGrupeStylu(szablon, id);
  expect(odlaczone.grupyStylow).toBeUndefined();
  expect(
    odlaczone.korzen.dzieci.filter(maStylTekstu).map((p) => [p.grupaStyluId, p.styl.kolor]),
  ).toEqual([
    [undefined, '#00ff00'],
    [undefined, '#ff0000'],
  ]);
});

it('M3-2: przypisanie w wariancie omija pole o tym samym ID w głównym układzie', () => {
  const s = pusty();
  const a = nowyWezel(s, 'tekst', 'Nazwa');
  const w = { ...a, grupaStyluId: 'styl' };
  const rozmiar = { kolumny: 1, rzedy: 2 };
  const przed: Szablon = {
    ...s,
    rozmiar: { tryb: 'sloty', slot: { szerokosc: 63, wysokosc: 44 }, kolumny: 1, rzedy: 1 },
    korzen: { ...s.korzen, dzieci: [w] },
    warianty: [{ ...rozmiar, korzen: { ...s.korzen, dzieci: [a] } }],
  };
  const dodano = utworzGrupeStylu(przed, a.id, 'Wariant', rozmiar);
  const grupa = dodano.grupyStylow![0]!;
  expect(grupa.id).not.toBe('styl');
  expect(dodano.korzen).toBe(przed.korzen);
  expect(korzenKarty(dodano, { rozmiar }).dzieci[0]).toMatchObject({ grupaStyluId: grupa.id });

  const zmieniono = zmienGrupeStylu(dodano, grupa.id, {
    styl: (st) => ({ ...st, kolor: '#aa0000' }),
  });
  for (const wynik of [
    przypiszGrupeStylu(zmieniono, a.id, '', rozmiar),
    usunGrupeStylu(zmieniono, grupa.id),
  ]) {
    const pole = korzenKarty(wynik, { rozmiar }).dzieci[0]!;
    expect(pole).not.toHaveProperty('grupaStyluId');
    expect(pole).toMatchObject({ styl: { kolor: '#aa0000' } });
    expect(wynik.korzen.dzieci[0]).toBe(w);
  }
});
