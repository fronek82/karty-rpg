/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { normalizujKartki } from '../druk/normalizacja';
import type { Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  dodajKarteWSlocie,
  dodajNaglowek,
  dodajStrone,
  duplikujKarty,
  kartyKartki,
  kartyWObszarze,
  liczbaStronKartki,
  mozliweRozmiary,
  przesunKarty,
  usunKarty,
  usunNaglowek,
  usunStrone,
  ustawDaneKart,
  zmienNaglowek,
  zmienRozmiarKarty,
  type KontekstKartki,
} from './kartka';
import { projektZPakietu, rejestrZProjektu } from './pakiet';
import { przygotujProjekt } from './schemat';

const czytaj = async (plik: string) => new Uint8Array(readFileSync(plik));
let pelny: Projekt;
let pusty: Projekt;
const A = 'mausritter-arkusz-bron';
const BRON = {
  szablonId: 'mausritter-bron',
  rozmiary: [
    { kolumny: 1, rzedy: 1 },
    { kolumny: 1, rzedy: 2 },
  ],
};
const ZBROJA = {
  szablonId: 'mausritter-zbroja',
  rozmiary: [
    { kolumny: 1, rzedy: 2 },
    { kolumny: 2, rzedy: 1 },
  ],
};
let ctx: KontekstKartki;

beforeAll(async () => {
  const w = await projektZPakietu(
    pakietMausritter,
    (f) => czytaj(`public/czcionki/${f}`),
    () => czytaj('src/pakiety/mausritter/obrazy/zastepczy.png'),
    'p',
  );
  const czcionki = rejestrZProjektu(w.projekt, w.zasoby).rejestr;
  pelny = normalizujKartki(w.projekt, { czcionki }).projekt;
  ctx = {
    szablony: new Map(pelny.szablony.map((s) => [s.id, s])),
    siatka: { kolumny: 10, rzedy: 7 },
  };
  const ids = kartyKartki(pelny, A, ctx.szablony).map((k) => k.karta.id);
  pusty = usunKarty(pelny, A, ids);
});

function ok<W>(w: W): Exclude<W, { blad: unknown }> {
  if (w && typeof w === 'object' && 'blad' in w) throw new Error(`błąd: ${String(w.blad)}`);
  return w as Exclude<W, { blad: unknown }>;
}
const pol = (p: Projekt, id: string) =>
  kartyKartki(p, A, ctx.szablony).find((k) => k.karta.id === id)!;

describe('kartka – dodawanie i rozmiary', () => {
  it('karta w slocie w domyślnym rozmiarze; gdy się nie mieści – następny rozmiar', () => {
    const { projekt, kartaId } = ok(
      dodajKarteWSlocie(pusty, A, { strona: 0, kolumna: 2, rzad: 1 }, ZBROJA, ctx),
    );
    expect(pol(projekt, kartaId)).toMatchObject({ kolumna: 2, rzad: 1, kolumny: 1, rzedy: 2 });
    // Ostatni rząd: 1×2 nie wejdzie – zbroja lekka 2×1.
    const w = ok(dodajKarteWSlocie(projekt, A, { strona: 0, kolumna: 0, rzad: 6 }, ZBROJA, ctx));
    expect(pol(w.projekt, w.kartaId)).toMatchObject({ kolumny: 2, rzedy: 1 });
    // Zajęty slot.
    expect(dodajKarteWSlocie(projekt, A, { strona: 0, kolumna: 2, rzad: 2 }, BRON, ctx)).toEqual({
      blad: 'brak-miejsca',
    });
    expect(() => przygotujProjekt(w.projekt)).not.toThrow();
  });

  it('zmiana rozmiaru tylko gdy się mieści; rozmiary możliwe', () => {
    let x = ok(dodajKarteWSlocie(pusty, A, { strona: 0, kolumna: 0, rzad: 0 }, BRON, ctx));
    const y = ok(dodajKarteWSlocie(x.projekt, A, { strona: 0, kolumna: 0, rzad: 1 }, BRON, ctx));
    expect(mozliweRozmiary(y.projekt, A, x.kartaId, BRON.rozmiary, ctx)).toEqual([true, false]);
    expect(zmienRozmiarKarty(y.projekt, A, x.kartaId, { kolumny: 1, rzedy: 2 }, ctx)).toEqual({
      blad: 'koliduje',
    });
    const z = ok(zmienRozmiarKarty(x.projekt, A, x.kartaId, { kolumny: 1, rzedy: 2 }, ctx));
    expect(pol(z.projekt, x.kartaId)).toMatchObject({ rzedy: 2 });
    x = {
      ...x,
      projekt: ok(zmienRozmiarKarty(z.projekt, A, x.kartaId, { kolumny: 1, rzedy: 1 }, ctx))
        .projekt,
    };
    // Powrót do domyślnego – bez nadpisania w karcie.
    expect(
      x.projekt.talie.flatMap((t) => t.karty).find((k) => k.id === x.kartaId)!.rozmiar,
    ).toBeUndefined();
  });
});

describe('kartka – przesuwanie, duplikowanie, usuwanie', () => {
  it('blok kart przesuwa się razem; kolizja lub wyjście poza siatkę – bez zmian', () => {
    const a = ok(dodajKarteWSlocie(pusty, A, { strona: 0, kolumna: 0, rzad: 0 }, BRON, ctx));
    const b = ok(dodajKarteWSlocie(a.projekt, A, { strona: 0, kolumna: 1, rzad: 0 }, BRON, ctx));
    const c = ok(dodajKarteWSlocie(b.projekt, A, { strona: 0, kolumna: 3, rzad: 0 }, BRON, ctx));
    const p = c.projekt;
    // Blok a+b o 1 w prawo: b wchodzi na wolne (2,0) – a na miejsce b (w bloku – dozwolone).
    const w = ok(
      przesunKarty(p, A, [a.kartaId, b.kartaId], { strona: 0, kolumna: 1, rzad: 0 }, ctx),
    );
    expect(pol(w.projekt, a.kartaId).kolumna).toBe(1);
    expect(pol(w.projekt, b.kartaId).kolumna).toBe(2);
    expect(
      przesunKarty(p, A, [a.kartaId, b.kartaId], { strona: 0, kolumna: 2, rzad: 0 }, ctx),
    ).toEqual({ blad: 'koliduje' });
    expect(przesunKarty(p, A, [a.kartaId], { strona: 0, kolumna: -1, rzad: 0 }, ctx)).toEqual({
      blad: 'poza-siatka',
    });
    // Na drugą stronę – kartka się wydłuża.
    const s = ok(przesunKarty(p, A, [c.kartaId], { strona: 1, kolumna: 0, rzad: 0 }, ctx));
    expect(pol(s.projekt, c.kartaId).strona).toBe(1);
    expect(liczbaStronKartki(s.projekt, A)).toBe(2);
  });

  it('duplikuj ×N: kolejne wolne sloty za oryginałem, potem nowa strona', () => {
    const a = ok(dodajKarteWSlocie(pusty, A, { strona: 0, kolumna: 8, rzad: 6 }, BRON, ctx));
    const { projekt, kopie } = duplikujKarty(a.projekt, A, [a.kartaId], 3, ctx);
    expect(kopie).toHaveLength(3);
    const p = kopie.map((id) => pol(projekt, id));
    expect(p[0]).toMatchObject({ strona: 0, kolumna: 9, rzad: 6 });
    expect(p[1]).toMatchObject({ strona: 1, kolumna: 0, rzad: 0 });
    expect(p[2]).toMatchObject({ strona: 1, kolumna: 1, rzad: 0 });
    expect(liczbaStronKartki(projekt, A)).toBe(2);
    // Kopie mają te same dane, ale własne id.
    const karty = projekt.talie.flatMap((t) => t.karty);
    expect(new Set(karty.map((k) => k.id)).size).toBe(karty.length);
    expect(() => przygotujProjekt(projekt)).not.toThrow();
  });

  it('pełna kartka z pakietu: duplikat trafia na nową stronę; usuwanie wielu', () => {
    const karty = kartyKartki(pelny, A, ctx.szablony);
    const { projekt, kopie } = duplikujKarty(pelny, A, [karty[0]!.karta.id], 1, ctx);
    expect(pol(projekt, kopie[0]!).strona).toBe(1);
    const po = usunKarty(projekt, A, [karty[0]!.karta.id, kopie[0]!]);
    expect(kartyKartki(po, A, ctx.szablony)).toHaveLength(karty.length - 1);
    expect(() => przygotujProjekt(po)).not.toThrow();
  });

  it('pola wielu kart naraz; zaznaczenie prostokątem', () => {
    const a = ok(dodajKarteWSlocie(pusty, A, { strona: 0, kolumna: 0, rzad: 0 }, BRON, ctx));
    const b = ok(dodajKarteWSlocie(a.projekt, A, { strona: 0, kolumna: 1, rzad: 0 }, BRON, ctx));
    const p = ustawDaneKart(b.projekt, A, [a.kartaId, b.kartaId], 'klasa', 'Lekka');
    expect(kartyKartki(p, A, ctx.szablony).map((k) => k.karta.dane.klasa)).toEqual([
      'Lekka',
      'Lekka',
    ]);
    expect(
      kartyWObszarze(
        kartyKartki(p, A, ctx.szablony),
        0,
        { kolumna: 1, rzad: 0 },
        { kolumna: 3, rzad: 2 },
      ),
    ).toEqual([b.kartaId]);
  });
});

describe('kartka – strony i nagłówki', () => {
  it('dodaj i usuń pustą stronę; strona z kartami się nie usuwa', () => {
    const a = ok(
      dodajKarteWSlocie(
        dodajStrone(dodajStrone(pusty, A), A),
        A,
        { strona: 2, kolumna: 0, rzad: 0 },
        BRON,
        ctx,
      ),
    );
    expect(liczbaStronKartki(a.projekt, A)).toBe(3);
    expect(usunStrone(a.projekt, A, 2)).toEqual({ blad: 'strona-niepusta' });
    const w = ok(usunStrone(a.projekt, A, 1));
    expect(liczbaStronKartki(w.projekt, A)).toBe(2);
    expect(pol(w.projekt, a.kartaId).strona).toBe(1);
    expect(usunStrone(pusty, A, 0)).toEqual({ blad: 'strona-niepusta' });
  });

  it('nagłówki: bez nakładania; odstęp nie przecina karty szerszej niż kolumna', () => {
    const n = ok(
      dodajNaglowek(pusty, A, { strona: 0, kolumna: 0, kolumny: 2, naglowek: 'A' }, ctx),
    );
    expect(
      dodajNaglowek(n.projekt, A, { strona: 0, kolumna: 1, kolumny: 2, naglowek: 'B' }, ctx),
    ).toEqual({ blad: 'koliduje' });
    const m = ok(
      dodajNaglowek(n.projekt, A, { strona: 0, kolumna: 2, kolumny: 2, naglowek: 'B' }, ctx),
    );
    const z = ok(dodajKarteWSlocie(m.projekt, A, { strona: 0, kolumna: 1, rzad: 3 }, ZBROJA, ctx));
    // Lekka zbroja 2×1 na kolumnach 1–2 – odstęp przed kolumną 2 by ją przeciął.
    const lekka = ok(zmienRozmiarKarty(z.projekt, A, z.kartaId, { kolumny: 2, rzedy: 1 }, ctx));
    expect(zmienNaglowek(lekka.projekt, A, m.id, { odstepPrzed: 2.89 }, ctx)).toEqual({
      blad: 'koliduje',
    });
    const zOdstepem = ok(
      zmienNaglowek(m.projekt, A, m.id, { odstepPrzed: 2.89, opis: 'opis' }, ctx),
    );
    // Przy odstępie karta 2×1 nie może stanąć na granicy grup.
    expect(
      dodajKarteWSlocie(
        zOdstepem.projekt,
        A,
        { strona: 0, kolumna: 1, rzad: 3 },
        { szablonId: 'mausritter-zbroja', rozmiary: [{ kolumny: 2, rzedy: 1 }] },
        ctx,
      ),
    ).toEqual({ blad: 'brak-miejsca' });
    const bez = usunNaglowek(zOdstepem.projekt, A, m.id);
    expect(bez.arkusze.find((a) => a.id === A)!.naglowki).toHaveLength(1);
    expect(() => przygotujProjekt(zOdstepem.projekt)).not.toThrow();
  });
});
