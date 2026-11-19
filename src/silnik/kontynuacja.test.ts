import { describe, expect, it } from 'vitest';
import { ustawieniaKartkiDla } from '../dane/wlasneKarty';
import { zbudujArkusz } from '../druk/arkusz';
import { normalizujKartki, wrocDoSiatki } from '../druk/normalizacja';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import type { Arkusz } from '../model/arkusz';
import type { Karta, PoleTekst, Szablon } from '../model/szablon';
import { rejestrTestowy } from './__testy__/pomoc';
import { renderujKarte } from './karta';
import { kartyZKontynuacja } from './kontynuacja';
import { scenaDoSvg } from './svg';

const tytul: PoleTekst = {
  id: 'tytul',
  typ: 'tekst',
  tekst: 'Karta wyprawy',
  wysokosc: { mm: 7 },
  styl: { czcionka: 'tresc', rozmiar: 4, kolor: '#000099' },
};
const opis: PoleTekst = {
  id: 'opis',
  typ: 'tekst',
  klucz: 'opis',
  wysokosc: { wypelnij: 1 },
  styl: { czcionka: 'tresc', rozmiar: 3, kolor: '#990000' },
  kontynuuj: true,
  ikonyWTekscie: true,
};
const szablon: Szablon = {
  id: 'wyprawa',
  nazwa: 'Wyprawa',
  rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 39 },
  korzen: { id: 'korzen', typ: 'kolumna', padding: 3, dzieci: [tytul, opis] },
};

const czcionki = rejestrTestowy();
const tekst = Array.from({ length: 180 }, () => 'las').join(' ');
const karta: Karta = { id: 'k', szablonId: szablon.id, ilosc: 2, dane: { opis: tekst } };
const kontekst = {
  czcionki,
  szablony: new Map([[szablon.id, szablon]]),
  dopisekKontynuacji: 'Continued',
};
const czesci = () => kartyZKontynuacja(szablon, karta, kontekst, 'Continued');
const arkusz: Arkusz = {
  id: 'arkusz',
  taliaId: 'talia',
  nazwa: 'Arkusz',
  ustawienia: ustawieniaKartkiDla(szablon),
};

describe('kontynuacja tekstu', () => {
  it('dzieli po słowach po wyczerpaniu dopasowania i zachowuje wszystkie znaki oraz nagłówek', () => {
    const cala = renderujKarte(szablon, karta, kontekst);
    expect(cala.ostrzezenia.some((o) => o.komunikat === 'tekst-nie-miesci-sie')).toBe(true);
    const w = czesci();
    expect(w.length).toBeGreaterThan(1);
    const opisem = w.flatMap((x) =>
      x.scena.elementy.flatMap((e) => (e.typ === 'tekst' && e.kolor === '#990000' ? e.glify : [])),
    );
    expect(opisem).toHaveLength(540);
    for (const [i, w0] of w.entries()) {
      expect(w0.ostrzezenia).toEqual([]);
      const svg = scenaDoSvg(w0.scena);
      expect(svg).toContain('#000099');
      expect(svg.includes('fill="#000000"')).toBe(i > 0);
    }
    expect(czesci()).toEqual(w);
    expect(karta.dane.opis).toBe(tekst);
  });

  it('po braku postępu zachowuje oryginalne ostrzeżenie i nie dodaje pustych kart', () => {
    const dlugieSlowo = { ...karta, dane: { opis: 'x'.repeat(100) } };
    const w = kartyZKontynuacja(szablon, dlugieSlowo, kontekst, 'Ciąg dalszy');
    expect(w).toHaveLength(1);
    expect(w[0]?.ostrzezenia).toContainEqual({ pole: opis.id, komunikat: 'tekst-nie-miesci-sie' });
  });

  it('przypina oryginały dwóch egzemplarzy, a ich kontynuacje układa w wolnych slotach', () => {
    const liczba = czesci().length;
    expect(liczba).toBeGreaterThanOrEqual(2);
    const talia = { id: 'talia', nazwa: 'Talia', karty: [karta] };
    const wydruk = zbudujArkusz(
      {
        ...arkusz,
        przypiete: [
          { kartaId: karta.id, kolumna: 0, rzad: 0, strona: 0 },
          { kartaId: karta.id, kolumna: 1, rzad: 0, strona: 0 },
        ],
      },
      talia,
      kontekst,
    );
    expect(
      wydruk.rozmieszczenie.karty.slice(0, 2).map((e) => [e.numer, e.czesc, e.kolumna]),
    ).toEqual([
      [0, undefined, 0],
      [liczba, undefined, 1],
    ]);
  });

  it('po przypięciu na późniejszej stronie kładzie każdą część po jej poprzedniku', () => {
    const talia = { id: 'talia', nazwa: 'Talia', karty: [{ ...karta, ilosc: 1 }] };
    const wydruk = zbudujArkusz(
      {
        ...arkusz,
        przypiete: [{ kartaId: karta.id, kolumna: 2, rzad: 5, strona: 1 }],
      },
      talia,
      kontekst,
    );
    const karty = wydruk.rozmieszczenie.karty;
    expect(karty.length).toBeGreaterThan(1);
    for (const [i, k] of karty.entries()) {
      if (i === 0) continue;
      const poprzedni = karty[i - 1]!;
      expect(k.strona * 10000 + k.rzad * 100 + k.kolumna).toBeGreaterThan(
        poprzedni.strona * 10000 + poprzedni.rzad * 100 + poprzedni.kolumna,
      );
    }
  });

  it('podczas normalizacji i przejścia z pasów zapisuje tylko źródłowe karty', () => {
    const p: Projekt = {
      wersja: WERSJA_SCHEMATU,
      id: 'p',
      nazwa: 'Projekt',
      utworzono: '2026-11-19T00:00:00Z',
      zmieniono: '2026-11-19T00:00:00Z',
      role: {},
      zasoby: [],
      szablony: [szablon],
      talie: [{ id: 'talia', nazwa: 'Talia', karty: [karta] }],
      arkusze: [arkusz],
    };
    const mieszana: Projekt = {
      ...p,
      arkusze: [{ ...arkusz, ustawienia: { ...arkusz.ustawienia, rozmiary: 'mieszane' } }],
    };
    for (const wynik of [
      normalizujKartki(p, kontekst).projekt,
      wrocDoSiatki(mieszana, arkusz.id, kontekst).projekt,
    ]) {
      expect(wynik.talie[0]?.karty.map((k) => k.dane.opis)).toEqual([tekst, tekst]);
      expect(wynik.arkusze[0]?.przypiete).toHaveLength(2);
    }
  });

  it('dzieli pole wg treści wychodzące poza kartę i zachowuje ikony wraz z formatowaniem', () => {
    const pole: PoleTekst = { ...opis, wysokosc: 'auto', listyNumerowane: true };
    const s: Szablon = { ...szablon, korzen: { ...szablon.korzen, dzieci: [tytul, pole] } };
    const opisany = {
      ...karta,
      dane: {
        opis: `1. **Początek** :star: ${tekst}\n9. **Koniec** :scissors:`,
      },
    };
    const czesci = kartyZKontynuacja(s, opisany, kontekst, 'Ciąg dalszy');
    expect(czesci.length).toBeGreaterThan(1);
    const elementy = czesci.flatMap((x) => x.scena.elementy);
    expect(elementy.filter((e) => e.typ === 'sciezka' && e.wypelnienie === '#990000')).toHaveLength(
      2,
    );
    expect(Object.keys(czesci[0]!.scena.glify).some((k) => k.includes('Bold'))).toBe(true);
    expect(Object.keys(czesci.at(-1)!.scena.glify).some((k) => k.includes('Bold'))).toBe(true);
  });

  it('uwzględnia ilość i kolejność części w siatce oraz pasach', () => {
    const liczba = czesci().length;
    const talia = { id: 'talia', nazwa: 'Talia', karty: [karta] };
    const w = zbudujArkusz(arkusz, talia, kontekst);
    expect(w.rozmieszczenie.karty.map((x) => x.numer)).toEqual(
      Array.from({ length: 2 * liczba }, (_, i) => i),
    );
    expect(w.rozmieszczenie.karty.filter((x) => x.czesc)).toHaveLength(2 * (liczba - 1));
    const mieszane = zbudujArkusz(
      {
        ...arkusz,
        ustawienia: { ...arkusz.ustawienia, rozmiary: 'mieszane' },
      },
      talia,
      kontekst,
    );
    expect(mieszane.mieszane?.karty.map((x) => x.numer)).toEqual(
      Array.from({ length: 2 * liczba }, (_, i) => i),
    );
    expect(mieszane.mieszane?.karty.filter((x) => x.czesc)).toHaveLength(2 * (liczba - 1));
  });
});
