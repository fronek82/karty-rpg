/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  kolumnySzablonu,
  roleProjektu,
  ustawDane,
  ustawObrazKarty,
  ustawStalyObraz,
  ustawRole,
  ustawTytulArkusza,
  ustawUstawieniaArkusza,
  usunZasob,
} from './edycja';
import { szablonStatystyk } from '../silnik/__testy__/przyklady';
import { projektZPakietu } from './pakiet';
import { ostrzezeniaProjektu, przygotujProjekt } from './schemat';
import { znajdzWezel } from './szablon';

let p: Projekt;
const czytaj = async (plik: string) => new Uint8Array(readFileSync(plik));
beforeAll(async () => {
  ({ projekt: p } = await projektZPakietu(
    pakietMausritter,
    (f) => czytaj(`public/czcionki/${f}`),
    () => czytaj('src/pakiety/mausritter/obrazy/zastepczy.png'),
    'p',
  ));
});

const STANY = 'mausritter-stany';
const talia = (pr: Projekt, id: string) => pr.talie.find((t) => t.id === id)!;

describe('pola kart', () => {
  it('kolumny szablonu: pola z kluczem i parametry, bez powtórzeń', () => {
    const zbroja = p.szablony.find((s) => s.id === 'mausritter-zbroja')!;
    const k = kolumnySzablonu(zbroja);
    expect(k.map((x) => x.klucz)).toEqual([...new Set(k.map((x) => x.klucz))]);
    expect(k.find((x) => x.klucz === 'obrona')).toMatchObject({
      rodzaj: 'parametr',
      domyslnie: '-1 obr',
    });
    expect(k.find((x) => x.klucz === 'obraz')?.typPola).toBe('obraz');
  });

  it('tabela: każda komórka wartości to kolumna danych z nazwą nagłówka', () => {
    const k = kolumnySzablonu(szablonStatystyk);
    expect(k.find((x) => x.klucz === 'cecha_ww')).toMatchObject({
      nazwa: 'WW',
      typPola: 'tabela',
    });
    expect(k.filter((x) => x.typPola === 'tabela')).toHaveLength(12);
  });

  it('pusta wartość usuwa klucz; wejście bez zmian', () => {
    const kopia = structuredClone(p);
    const k = talia(p, STANY).karty[0]!;
    const x = ustawDane(p, STANY, k.id, 'nazwa', '');
    expect('nazwa' in talia(x, STANY).karty[0]!.dane).toBe(false);
    expect(p).toEqual(kopia);
  });

  it('ustawienia obrazu: zapis i reset', () => {
    const k = talia(p, STANY).karty[0]!;
    let x = ustawObrazKarty(p, STANY, k.id, 'obraz', { skala: 2 });
    expect(talia(x, STANY).karty[0]!.obrazy).toEqual({ obraz: { skala: 2 } });
    x = ustawObrazKarty(x, STANY, k.id, 'obraz', undefined);
    expect(talia(x, STANY).karty[0]!.obrazy).toBeUndefined();
  });
});

describe('arkusz', () => {
  it('ustawienia i tytuł', () => {
    const A = 'mausritter-arkusz-bron';
    let x = ustawUstawieniaArkusza(p, A, { czarnoBialy: true, papier: 'Letter' });
    x = ustawTytulArkusza(x, A, 'Moje karty');
    const a = x.arkusze.find((y) => y.id === A)!;
    expect(a.ustawienia).toMatchObject({ czarnoBialy: true, papier: 'Letter' });
    expect(a.ustawienia.tytul?.tekst).toBe('Moje karty');
    expect(p.arkusze.find((y) => y.id === A)!.ustawienia.czarnoBialy).toBeFalsy();
  });
});

describe('biblioteka czcionek i role', () => {
  it('role: przypisane i użyte w stylach szablonów oraz arkuszy', () => {
    expect(roleProjektu(p).sort()).toEqual(['tresc', 'tytul']);
  });

  it('usunięcie przypisania roli', () => {
    const x = ustawRole(p, 'tresc', '');
    expect(x.role.tresc).toBeUndefined();
    expect(roleProjektu(x)).toContain('tresc');
  });

  it('usunięcie czcionki (z ostrzeżeniem, nie błędem)', () => {
    const grenze = p.zasoby.filter(
      (z) => z.rodzaj === 'czcionka' && z.rodzina === 'Grenze Gotisch',
    );
    let y = { projekt: p, dane: new Map<string, Uint8Array>() };
    for (const g of grenze) y = usunZasob(y.projekt, y.dane, g.id);
    expect(() => przygotujProjekt(y.projekt)).not.toThrow();
    expect(ostrzezeniaProjektu(y.projekt).join()).toMatch(/rola „tytul”/);
  });
});

it('uwzględnia rolę czcionki używaną wyłącznie przez grupę stylu', () => {
  const s = p.szablony[0]!;
  const szablon = {
    ...s,
    grupyStylow: [{ id: 'g', nazwa: 'Wspólny', styl: { czcionka: 'naglowki2', rozmiar: 3 } }],
  };
  expect(roleProjektu({ ...p, szablony: [szablon] })).toContain('naglowki2');
});

it('dodaje bajty i opis obrazu oraz wybiera zasób stałego pola', () => {
  const wzor = p.szablony[0]!;
  const s = {
    ...wzor,
    korzen: {
      ...wzor.korzen,
      dzieci: [
        { id: 'staly', typ: 'obraz' as const, dopasowanie: 'dopasuj' as const },
        {
          id: 'dynamiczny',
          typ: 'obraz' as const,
          klucz: 'ilustracja',
          dopasowanie: 'dopasuj' as const,
        },
      ],
    },
  };
  const projekt = { ...p, szablony: [s], talie: [], arkusze: [] };
  const bajty = new Uint8Array(readFileSync('testy/zasoby/ramka-testowa.png'));
  const dane = new Map([['obraz-wzor', Uint8Array.of(1, 2, 3)]]);
  const we = { dane: bajty, szerokosc: 120, wysokosc: 120 };
  const wynik = ustawStalyObraz(projekt, dane, s.id, 'staly', 'wzor.png', we);
  const obraz = wynik.projekt.zasoby.at(-1)!;
  expect(obraz).toMatchObject({
    rodzaj: 'obraz',
    nazwa: 'wzor.png',
    format: 'png',
    szerokosc: 120,
    wysokosc: 120,
  });
  expect(obraz.id).not.toBe('obraz-wzor');
  expect(wynik.dane.get(obraz.id)).toEqual(bajty);
  expect(wynik.dane.get('obraz-wzor')).toEqual(dane.get('obraz-wzor'));
  expect(znajdzWezel(przygotujProjekt(wynik.projekt).szablony[0]!, 'staly')).toMatchObject({
    zasob: obraz.id,
  });
  expect(znajdzWezel(s, 'staly')).not.toHaveProperty('zasob');
  expect(ustawStalyObraz(projekt, dane, s.id, 'dynamiczny', 'wzor.png', we)).toEqual({
    projekt,
    dane,
  });
  expect(ustawStalyObraz(projekt, dane, s.id, 'usuniety', 'wzor.png', we)).toEqual({
    projekt,
    dane,
  });
  expect(() =>
    ustawStalyObraz(projekt, dane, s.id, 'staly', 'zly.png', { ...we, dane: Uint8Array.of(0) }),
  ).toThrow(/nie jest obrazem PNG ani JPG/);
});
