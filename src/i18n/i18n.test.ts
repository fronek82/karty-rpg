import { afterEach, describe, expect, it } from 'vitest';
import {
  czyJezyk,
  formatujDate,
  formatujLiczbe,
  formatujLiczbeZUlamkiem,
  jezykDomyslny,
  t,
  tJesliJest,
  tn,
  ustawJezyk,
} from './index';
import { en, enMnoga } from './en';
import { pl, plMnoga } from './pl';

const parametry = (tekst: string) => [...tekst.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
const unikalne = (a: string[]) => [...new Set(a)];

afterEach(() => ustawJezyk('pl'));

describe('t()', () => {
  it('zwraca tekst po polsku', () => {
    expect(t('aplikacja.nazwa')).toBe('Karty');
  });

  it('podstawia parametry', () => {
    expect(t('start.wersja', { wersja: '0.1.0' })).toBe('Wersja 0.1.0');
  });

  it('zostawia nieznany parametr bez zmian', () => {
    expect(t('start.wersja', {})).toBe('Wersja {wersja}');
  });

  it('po zmianie języka zwraca angielski tekst', () => {
    ustawJezyk('en');
    expect(t('start.wersja', { wersja: '0.1.0' })).toBe('Version 0.1.0');
    expect(tJesliJest('rola.tytul')).toBe('Title');
    ustawJezyk('pl');
    expect(tJesliJest('rola.tytul')).toBe('Tytuł');
    expect(tJesliJest('rola.nieistnieje')).toBeUndefined();
  });
});

describe('parytet słowników pl ↔ en', () => {
  it('te same klucze', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
    expect(Object.keys(enMnoga).sort()).toEqual(Object.keys(plMnoga).sort());
  });

  it('identyczne parametry {…} w każdym kluczu', () => {
    const rozne = Object.keys(pl).filter(
      (k) =>
        unikalne(parametry(pl[k as keyof typeof pl])).join() !==
        unikalne(parametry(en[k as keyof typeof en])).join(),
    );
    expect(rozne).toEqual([]);
  });

  it('brak pustych tłumaczeń', () => {
    const puste = Object.entries(en)
      .filter(([, v]) => v.trim() === '')
      .map(([k]) => k);
    expect(puste).toEqual([]);
    for (const slownik of [plMnoga, enMnoga])
      for (const formy of Object.values(slownik))
        for (const v of Object.values(formy) as string[]) expect(v.trim()).not.toBe('');
  });

  it('formy liczby mnogiej: te same parametry we wszystkich formach i językach', () => {
    for (const klucz of Object.keys(plMnoga) as (keyof typeof plMnoga)[]) {
      const wzorzec = unikalne(parametry(plMnoga[klucz].other)).join();
      expect(wzorzec, klucz).toContain('n');
      for (const formy of [plMnoga[klucz], enMnoga[klucz]])
        for (const v of Object.values(formy))
          expect(unikalne(parametry(v)).join(), klucz).toBe(wzorzec);
      expect(Object.keys(plMnoga[klucz]), klucz).toEqual(
        expect.arrayContaining(['one', 'few', 'many', 'other']),
      );
    }
  });

  // Dozwolone polskie znaki w tekstach angielskich: nazwa własna języka w przełączniku.
  const DOZWOLONE: Record<string, string> = { 'jezyk.plOpis': 'Polski' };
  it('brak polskich znaków diakrytycznych w en.ts poza listą dozwolonych', () => {
    const zle = Object.entries(en)
      .filter(([k, v]) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(v) && DOZWOLONE[k] !== v)
      .map(([k]) => k);
    expect(zle).toEqual([]);
    for (const formy of Object.values(enMnoga))
      for (const v of Object.values(formy)) expect(v).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
  });

  it('tłumaczenie nie jest kopią polskiego tekstu (poza oznaczeniami i nazwami wspólnymi)', () => {
    const identyczne = Object.keys(pl).filter(
      (k) => pl[k as keyof typeof pl] === en[k as keyof typeof en],
    );
    // Dozwolone: oznaczenia języków, jednostki, symbole oraz nazwy własne.
    expect(identyczne).toEqual([
      'jezyk.pl',
      'jezyk.en',
      'jezyk.plOpis',
      'jezyk.enOpis',
      'koloryOkno.mausritter',
      'karta.przesuniecieX',
      'karta.przesuniecieY',
      'ostrzezenie.karta',
      'rozmiar.mm',
      'pakiet.param.pojemnosc',
      'czcionki.zrodlo.google',
      'mieszane.maxrects',
      'uklad.diagram.mm',
      'papier.A4',
      'papier.Letter',
      'papier.A5',
      'kreator.format.poker',
      'kreator.format.bridge',
      'kreator.format.mini-euro',
      'kreator.format.mini-american',
      'kreator.format.tarot',
      'rozmiar.tryb.mm',
      'rozmiar.tryb.procent',
      'szablon.importujKrotko',
      'polozenie.x',
      'polozenie.y',
      'polozenie.obrot.wartosc',
      'polozenie.znacznik',
      'polozenie.znacznikObrotKrotki',
      'nakladka.podpowiedz',
      'nakladka.podpowiedzRozmiar',
      'styl.pogrubienie',
      'styl.kursywa',
      'separator.dlugosc.mm',
      'separator.dlugosc.procent',
      'start.import',
    ]);
  });
});

describe('tn() – liczba mnoga', () => {
  const polskie = (n: number) => tn('dane.zaDuzoElementow', n);

  it('polski: one / few / many dla liczb granicznych', () => {
    expect(polskie(1)).toContain('1 elementu');
    expect(polskie(2)).toContain('2 elementów');
    expect(polskie(5)).toContain('5 elementów');
    expect(polskie(12)).toContain('12 elementów');
    expect(polskie(22)).toContain('22 elementów');
    expect(polskie(25)).toContain('25 elementów');
  });

  it('polski: formy rzeczowników (karta / karty / kart)', () => {
    const k = (n: number) => tn('mieszane.zajete', n, { numer: 1, liczba: 1, procent: 50 });
    expect(k(1)).toContain('1 karta');
    expect(k(2)).toContain('2 karty');
    expect(k(5)).toContain('5 kart');
    expect(k(12)).toContain('12 kart');
    expect(k(22)).toContain('22 karty');
    expect(k(25)).toContain('25 kart');
  });

  it('polski: biblioteka.limit – własny element / własne elementy / własnych elementów', () => {
    expect(tn('biblioteka.limit', 1)).toContain('1 własny element');
    expect(tn('biblioteka.limit', 2)).toContain('2 własne elementy');
    expect(tn('biblioteka.limit', 5)).toContain('5 własnych elementów');
    expect(tn('biblioteka.limit', 22)).toContain('22 własne elementy');
  });

  it('angielski: one / other', () => {
    ustawJezyk('en');
    const k = (n: number) => tn('mieszane.zajete', n, { numer: 1, liczba: 2, procent: 50 });
    expect(k(1)).toBe('Page 1 of 2 · 1 card · 50% of the card area used');
    expect(k(2)).toBe('Page 1 of 2 · 2 cards · 50% of the card area used');
    expect(tn('biblioteka.limit', 1)).toContain('1 custom element.');
    expect(tn('biblioteka.limit', 2)).toContain('2 custom elements.');
  });

  it('parametr {n} jest liczbą w bieżącym języku (separator tysięcy)', () => {
    ustawJezyk('en');
    expect(tn('dane.zaDuzoElementow', 1500)).toContain('1,500 elements');
  });
});

describe('liczby i daty', () => {
  it('polski: przecinek dziesiętny, angielski: kropka', () => {
    expect(formatujLiczbe(63.5)).toBe('63,5');
    expect(formatujLiczbe(88)).toBe('88');
    expect(formatujLiczbeZUlamkiem(2)).toBe('2,0');
    ustawJezyk('en');
    expect(formatujLiczbe(63.5)).toBe('63.5');
    expect(formatujLiczbe(88)).toBe('88');
    expect(formatujLiczbeZUlamkiem(2)).toBe('2.0');
    expect(formatujLiczbeZUlamkiem(1.256, 2)).toBe('1.26');
  });

  it('zaokrągla do podanej liczby miejsc i nie grupuje tysięcy', () => {
    expect(formatujLiczbe(1234.567, 1)).toBe('1234,6');
    expect(formatujLiczbe(0.04, 1)).toBe('0');
  });

  it('małe liczby ujemne nie dają „-0”', () => {
    expect(formatujLiczbe(-0.04)).toBe('0');
    expect(formatujLiczbeZUlamkiem(-0.001, 2)).toBe('0,0');
    ustawJezyk('en');
    expect(formatujLiczbe(-0.04)).toBe('0');
    expect(formatujLiczbeZUlamkiem(-0.001, 2)).toBe('0.0');
    expect(formatujLiczbe(-1.5)).toBe('-1.5');
  });

  it('data według języka', () => {
    const d = new Date(2026, 10, 18, 14, 5);
    const pol = formatujDate(d);
    ustawJezyk('en');
    const ang = formatujDate(d);
    expect(pol).not.toBe(ang);
    expect(pol).toMatch(/18/);
    expect(pol).toMatch(/lis/);
    expect(ang).toMatch(/Nov/);
  });
});

describe('język domyślny z przeglądarki (D8)', () => {
  it.each([
    ['pl', 'pl'],
    ['pl-PL', 'pl'],
    ['PL', 'pl'],
    ['en-US', 'en'],
    ['en', 'en'],
    ['de-DE', 'en'],
    ['plx', 'en'],
    ['', 'en'],
  ])('%s → %s', (jezyk, oczekiwany) => {
    expect(jezykDomyslny(jezyk)).toBe(oczekiwany);
  });

  it('brak języka przeglądarki → angielski', () => {
    expect(jezykDomyslny(undefined)).toBe('en');
  });

  it('czyJezyk rozpoznaje tylko pl i en', () => {
    expect(czyJezyk('pl')).toBe(true);
    expect(czyJezyk('en')).toBe(true);
    expect(czyJezyk('de')).toBe(false);
    expect(czyJezyk(undefined)).toBe(false);
  });
});
