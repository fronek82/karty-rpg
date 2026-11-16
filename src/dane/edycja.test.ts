/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  dodajKarte,
  kolumnyTalii,
  kopiujKarte,
  przesunKarte,
  rozmiaryKarty,
  usunKarte,
  ustawDane,
  ustawIlosc,
  ustawObrazKarty,
  ustawRozmiar,
  ustawSzablon,
  roleProjektu,
  ustawRole,
  zmienNazweRodziny,
  ustawWariantCzcionki,
  usunZasob,
  przypnijKarte,
  odepnijKarte,
  odepnijWszystkie,
  zamrozUklad,
  ustawUstawieniaArkusza,
  ustawTytulArkusza,
} from './edycja';
import { ostrzezeniaProjektu } from './schemat';
import { projektZPakietu } from './pakiet';
import { przygotujProjekt } from './schemat';

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

const szablony = () => new Map(p.szablony.map((s) => [s.id, s]));
const talia = (pr: Projekt, id: string) => pr.talie.find((t) => t.id === id)!;
const STANY = 'mausritter-stany';

describe('kolumny i rozmiary', () => {
  it('talia broni: pola broni i zbroi + parametr obrony, bez powtórzeń', () => {
    const k = kolumnyTalii(talia(p, 'mausritter-bron-i-pancerze'), szablony());
    const klucze = k.map((x) => x.klucz);
    expect(klucze).toEqual([...new Set(klucze)]);
    expect(klucze).toEqual(
      expect.arrayContaining(['nazwa', 'wartosc', 'klasa', 'obraz', 'obrona']),
    );
    expect(k.find((x) => x.klucz === 'obrona')).toMatchObject({
      rodzaj: 'parametr',
      domyslnie: '-1 obr',
    });
    expect(k.find((x) => x.klucz === 'obraz')?.typPola).toBe('obraz');
  });

  it('rozmiary: domyślny pierwszy, bez powtórzeń', () => {
    const r = rozmiaryKarty(p.szablony.find((s) => s.id === 'mausritter-bron')!);
    expect(r[0]).toEqual({ kolumny: 1, rzedy: 1 });
    expect(r).toHaveLength(4);
  });
});

describe('operacje na kartach', () => {
  it('nie zmieniają wejścia i dają spójny projekt', () => {
    const kopia = structuredClone(p);
    const t = talia(p, STANY);
    const k0 = t.karty[0]!.id;
    let x = dodajKarte(p, STANY, 'mausritter-stan', k0).projekt;
    x = kopiujKarte(x, STANY, k0).projekt;
    x = ustawDane(x, STANY, k0, 'nazwa', 'Nowa');
    x = ustawIlosc(x, STANY, k0, 7.6);
    x = przesunKarte(x, STANY, k0, 2);
    x = usunKarte(x, STANY, t.karty[1]!.id);
    expect(p).toEqual(kopia);
    expect(() => przygotujProjekt(x)).not.toThrow();
  });

  it('dodanie po wskazanej karcie, unikalne id', () => {
    const t = talia(p, STANY);
    const { projekt, kartaId } = dodajKarte(p, STANY, 'mausritter-stan', t.karty[0]!.id);
    expect(talia(projekt, STANY).karty[1]!.id).toBe(kartaId);
    const drugi = dodajKarte(projekt, STANY, 'mausritter-stan');
    expect(drugi.kartaId).not.toBe(kartaId);
  });

  it('kopia trafia do tej samej grupy, tuż za oryginałem', () => {
    const t = talia(p, STANY);
    const g = t.grupy![0]!;
    const { projekt, kartaId } = kopiujKarte(p, STANY, g.karty[0]!);
    const g2 = talia(projekt, STANY).grupy![0]!;
    expect(g2.karty[1]).toBe(kartaId);
  });

  it('usunięcie czyści grupy i przypięcia arkuszy', () => {
    const t = talia(p, STANY);
    const id = t.grupy![0]!.karty[0]!;
    const arkusz = p.arkusze.find((a) => a.taliaId === STANY)!;
    const zPrzypieciem: Projekt = {
      ...p,
      arkusze: p.arkusze.map((a) =>
        a === arkusz ? { ...a, przypiete: [{ kartaId: id, kolumna: 0, rzad: 0 }] } : a,
      ),
    };
    const x = usunKarte(zPrzypieciem, STANY, id);
    expect(talia(x, STANY).grupy!.flatMap((g) => g.karty)).not.toContain(id);
    expect(x.arkusze.find((a) => a.id === arkusz.id)!.przypiete).toEqual([]);
    expect(() => przygotujProjekt(x)).not.toThrow();
  });

  it('pusta wartość usuwa klucz; ilość zaokrąglana i ograniczana', () => {
    const k = talia(p, STANY).karty[0]!;
    const x = ustawDane(p, STANY, k.id, 'nazwa', '');
    expect('nazwa' in talia(x, STANY).karty[0]!.dane).toBe(false);
    expect(talia(ustawIlosc(p, STANY, k.id, -3), STANY).karty[0]!.ilosc).toBe(0);
    expect(talia(ustawIlosc(p, STANY, k.id, NaN), STANY).karty[0]!.ilosc).toBe(0);
  });

  it('rozmiar domyślny bez nadpisania; zmiana szablonu kasuje rozmiar', () => {
    const T = 'mausritter-bron-i-pancerze';
    const s = p.szablony.find((x) => x.id === 'mausritter-bron')!;
    const k = talia(p, T).karty.find((x) => x.szablonId === s.id)!;
    let x = ustawRozmiar(p, T, k.id, { kolumny: 1, rzedy: 2 }, s);
    expect(talia(x, T).karty.find((y) => y.id === k.id)!.rozmiar).toEqual({ kolumny: 1, rzedy: 2 });
    x = ustawRozmiar(x, T, k.id, { kolumny: 1, rzedy: 1 }, s);
    expect(talia(x, T).karty.find((y) => y.id === k.id)!.rozmiar).toBeUndefined();
    x = ustawRozmiar(x, T, k.id, { kolumny: 1, rzedy: 2 }, s);
    x = ustawSzablon(x, T, k.id, 'mausritter-przedmiot');
    expect(talia(x, T).karty.find((y) => y.id === k.id)!.rozmiar).toBeUndefined();
  });

  it('ustawienia obrazu: zapis i reset', () => {
    const k = talia(p, STANY).karty[0]!;
    let x = ustawObrazKarty(p, STANY, k.id, 'obraz', { skala: 2 });
    expect(talia(x, STANY).karty[0]!.obrazy).toEqual({ obraz: { skala: 2 } });
    x = ustawObrazKarty(x, STANY, k.id, 'obraz', undefined);
    expect(talia(x, STANY).karty[0]!.obrazy).toBeUndefined();
  });
});

describe('biblioteka czcionek i role', () => {
  it('role: przypisane i użyte w stylach szablonów oraz arkuszy', () => {
    expect(roleProjektu(p).sort()).toEqual(['tresc', 'tytul']);
  });

  it('zmiana nazwy rodziny przenosi role; usunięcie przypisania roli', () => {
    let x = zmienNazweRodziny(p, 'EB Garamond', 'Garamond');
    expect(x.role.tresc).toBe('Garamond');
    expect(
      x.zasoby.filter((z) => z.rodzaj === 'czcionka' && z.rodzina === 'Garamond'),
    ).toHaveLength(4);
    expect(ostrzezeniaProjektu(x)).toEqual([]);
    x = ustawRole(x, 'tresc', '');
    expect(x.role.tresc).toBeUndefined();
    expect(roleProjektu(x)).toContain('tresc');
  });

  it('wariant i usunięcie czcionki (z ostrzeżeniem, nie błędem)', () => {
    const c = p.zasoby.find((z) => z.rodzaj === 'czcionka' && z.wariant === 'kursywa')!;
    const x = ustawWariantCzcionki(p, c.id, 'pogrubiony');
    expect(ostrzezeniaProjektu(x).join()).toMatch(/dwie czcionki/);
    const grenze = p.zasoby.filter(
      (z) => z.rodzaj === 'czcionka' && z.rodzina === 'Grenze Gotisch',
    );
    let y = { projekt: p, dane: new Map<string, Uint8Array>() };
    for (const g of grenze) y = usunZasob(y.projekt, y.dane, g.id);
    expect(() => przygotujProjekt(y.projekt)).not.toThrow();
    expect(ostrzezeniaProjektu(y.projekt).join()).toMatch(/rola „tytul”/);
  });
});

describe('ręczna korekta arkusza', () => {
  const A = 'mausritter-arkusz-bron';
  const siatka = { kolumny: 10, rzedy: 7 };
  const rozmiar = (id: string) => {
    const k = p.talie.flatMap((t) => t.karty).find((x) => x.id === id)!;
    return { kolumny: k.rozmiar?.kolumny ?? 1, rzedy: k.rozmiar?.rzedy ?? 1 };
  };
  const arkusz = (x: Projekt) => x.arkusze.find((a) => a.id === A)!;

  it('przypięcie, przeniesienie, kolizja, poza siatką, odpięcie', () => {
    const p0 = odepnijWszystkie(p, A);
    const w1 = przypnijKarte(
      p0,
      A,
      undefined,
      { kartaId: 'bron-igla', strona: 0, kolumna: 9, rzad: 6 },
      rozmiar,
      siatka,
    );
    if (!('projekt' in w1)) throw new Error('oczekiwano przypięcia');
    expect(arkusz(w1.projekt).przypiete).toEqual([{ kartaId: 'bron-igla', kolumna: 9, rzad: 6 }]);
    // Przeniesienie tego samego egzemplarza.
    const z = { kartaId: 'bron-igla', strona: 0, kolumna: 9, rzad: 6 };
    const w2 = przypnijKarte(w1.projekt, A, z, { ...z, kolumna: 0, rzad: 0 }, rozmiar, siatka);
    if (!('projekt' in w2)) throw new Error('oczekiwano przypięcia');
    expect(arkusz(w2.projekt).przypiete).toEqual([{ kartaId: 'bron-igla', kolumna: 0, rzad: 0 }]);
    // Ciężka broń 1×2 na (0,0) nachodzi na przypiętą igłę.
    expect(
      przypnijKarte(
        w2.projekt,
        A,
        undefined,
        { kartaId: 'bron-mlot-bojowy', strona: 0, kolumna: 0, rzad: 0 },
        rozmiar,
        siatka,
      ),
    ).toEqual({ blad: 'koliduje' });
    // 1×2 w ostatnim rzędzie wychodzi poza siatkę.
    expect(
      przypnijKarte(
        w2.projekt,
        A,
        undefined,
        { kartaId: 'bron-mlot-bojowy', strona: 0, kolumna: 3, rzad: 6 },
        rozmiar,
        siatka,
      ),
    ).toEqual({ blad: 'poza-siatka' });
    const w3 = odepnijKarte(w2.projekt, A, {
      kartaId: 'bron-igla',
      strona: 0,
      kolumna: 0,
      rzad: 0,
    });
    expect(arkusz(w3).przypiete).toBeUndefined();
  });

  it('zamiana miejscami dwóch przypiętych kart tego samego rozmiaru', () => {
    const x = zamrozUklad(odepnijWszystkie(p, A), A, [
      { kartaId: 'bron-igla', strona: 0, kolumna: 0, rzad: 0 },
      { kartaId: 'bron-sztylet', strona: 0, kolumna: 1, rzad: 0 },
      { kartaId: 'bron-mlot-bojowy', strona: 0, kolumna: 2, rzad: 0 },
    ]);
    const w = przypnijKarte(
      x,
      A,
      { kartaId: 'bron-igla', strona: 0, kolumna: 0, rzad: 0 },
      { kartaId: 'bron-igla', strona: 0, kolumna: 1, rzad: 0 },
      rozmiar,
      siatka,
    );
    if (!('projekt' in w)) throw new Error('oczekiwano zamiany');
    expect(arkusz(w.projekt).przypiete).toEqual(
      expect.arrayContaining([
        { kartaId: 'bron-sztylet', kolumna: 0, rzad: 0 },
        { kartaId: 'bron-igla', kolumna: 1, rzad: 0 },
      ]),
    );
    // Inny rozmiar (1×1 na 1×2) – brak zamiany.
    expect(
      przypnijKarte(
        x,
        A,
        { kartaId: 'bron-igla', strona: 0, kolumna: 0, rzad: 0 },
        { kartaId: 'bron-igla', strona: 0, kolumna: 2, rzad: 0 },
        rozmiar,
        siatka,
      ),
    ).toEqual({ blad: 'koliduje' });
  });

  it('zmniejszenie ilości usuwa nadmiarowe przypięcia tej karty', () => {
    const x = zamrozUklad(odepnijWszystkie(p, A), A, [
      { kartaId: 'bron-igla', strona: 0, kolumna: 0, rzad: 0 },
      { kartaId: 'bron-sztylet', strona: 0, kolumna: 1, rzad: 0 },
      { kartaId: 'bron-igla', strona: 0, kolumna: 2, rzad: 0 },
      { kartaId: 'bron-igla', strona: 0, kolumna: 3, rzad: 0 },
    ]);
    const y = ustawIlosc(x, 'mausritter-bron-i-pancerze', 'bron-igla', 1);
    expect(arkusz(y).przypiete).toEqual([
      { kartaId: 'bron-igla', kolumna: 0, rzad: 0 },
      { kartaId: 'bron-sztylet', kolumna: 1, rzad: 0 },
    ]);
  });

  it('zamrożenie układu i odpięcie wszystkich', () => {
    const x = zamrozUklad(p, A, [
      { kartaId: 'bron-igla', strona: 0, kolumna: 1, rzad: 2 },
      { kartaId: 'bron-igla', strona: 1, kolumna: 0, rzad: 0 },
    ]);
    expect(arkusz(x).przypiete).toEqual([
      { kartaId: 'bron-igla', kolumna: 1, rzad: 2 },
      { kartaId: 'bron-igla', kolumna: 0, rzad: 0, strona: 1 },
    ]);
    expect(() => przygotujProjekt(x)).not.toThrow();
    expect(arkusz(odepnijWszystkie(x, A)).przypiete).toBeUndefined();
  });

  it('ustawienia i tytuł arkusza', () => {
    let x = ustawUstawieniaArkusza(p, A, { czarnoBialy: true, papier: 'Letter' });
    x = ustawTytulArkusza(x, A, 'Moje karty');
    expect(arkusz(x).ustawienia).toMatchObject({ czarnoBialy: true, papier: 'Letter' });
    expect(arkusz(x).ustawienia.tytul?.tekst).toBe('Moje karty');
    expect(arkusz(p).ustawienia.czarnoBialy).toBeFalsy();
  });
});
