import { describe, expect, it } from 'vitest';
import { czyKontener, type Kontener, type Szablon } from '../model/szablon';
import { kolumnySzablonu } from './edycja';
import {
  doPoprzedniegoKontenera,
  duplikujWezel,
  kluczZNazwy,
  nowySzablon,
  nowyWezel,
  opakuj,
  przeniesWezel,
  przesunWezel,
  rodzicWezla,
  usunWezly,
  wstawWezel,
  wyzej,
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
