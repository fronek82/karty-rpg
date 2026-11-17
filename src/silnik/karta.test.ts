import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import {
  czyPuste,
  daneZParametrami,
  konturRombu,
  konturScietego,
  renderujKarte,
  wartoscPola,
  normalizujUstawieniaObrazu,
  wolnyObszar,
} from './karta';
import { kluczeTabeli, korzenKarty } from '../model/szablon';
import type { ElementSceny, Scena } from './scena';
import { scenaDoSvg } from './svg';
import { rejestrTestowy, szablonBroni } from './__testy__/pomoc';
import {
  daneCzaru,
  daneStatystyk,
  daneWroga,
  szablonCzaru,
  szablonStatystyk,
  szablonWroga,
} from './__testy__/przyklady';

const czcionki = rejestrTestowy();
const ctx = {
  czcionki,
  obraz: (z: string) => (z === 'kij.png' ? { szerokosc: 400, wysokosc: 300 } : undefined),
};

const daneBroni = { nazwa: 'Kij z sękiem', obrazenia: 'k6', klasa: 'Lekka', obraz: 'kij.png' };

const wszystkie = (s: Scena): ElementSceny[] =>
  s.elementy.flatMap((e) => (e.typ === 'grupa' ? [e, ...e.elementy] : [e]));
const ile = (s: Scena, typ: ElementSceny['typ']) =>
  wszystkie(s).filter((e) => e.typ === typ).length;

describe('renderujKarte', () => {
  it('karta broni 1×1 – wzorzec SVG', async () => {
    const { scena, ostrzezenia } = renderujKarte(szablonBroni, { dane: daneBroni }, ctx);
    expect(ostrzezenia).toEqual([]);
    expect(scena.szer).toBeCloseTo(25.75);
    expect(scena.wys).toBeCloseTo(25.75);
    const svg = scenaDoSvg(scena, { adresObrazu: () => 'kij.png' });
    await expect(svg).toMatchFileSnapshot('./__snapshots__/bron-1x1.svg');
  });

  it('jest deterministyczna', () => {
    const a = scenaDoSvg(renderujKarte(szablonBroni, { dane: daneBroni }, ctx).scena);
    const b = scenaDoSvg(renderujKarte(szablonBroni, { dane: daneBroni }, ctx).scena);
    expect(a).toBe(b);
  });

  it('rozmiar w slotach z karty: 1×2', () => {
    const { scena } = renderujKarte(
      szablonBroni,
      { dane: daneBroni, rozmiar: { kolumny: 1, rzedy: 2 } },
      ctx,
    );
    expect(scena.wys).toBeCloseTo(51.5);
  });

  it('pusta karta: ramka nagłówka i znaczniki zostają, ukryta wartość znika', () => {
    const { scena } = renderujKarte(szablonBroni, { dane: {} }, ctx);
    expect(ile(scena, 'tekst')).toBe(0);
    expect(ile(scena, 'okrag')).toBe(3);
    expect(ile(scena, 'linia')).toBe(1); // linia pod nagłówkiem
    expect(ile(scena, 'prostokat')).toBe(1); // tylko tło karty – ramka wartości ukryta
  });

  it('liczba znaczników z danych łamie się na rzędy', () => {
    const { scena } = renderujKarte(szablonBroni, { dane: { uzycia: '6' } }, ctx);
    const okregi = wszystkie(scena).filter((e) => e.typ === 'okrag');
    expect(okregi).toHaveLength(6);
    expect(new Set(okregi.map((o) => (o.typ === 'okrag' ? o.cy : 0))).size).toBe(2);
  });

  it('ostrzega o brakującym obrazie i znakach spoza czcionki', () => {
    const { ostrzezenia } = renderujKarte(
      szablonBroni,
      { dane: { nazwa: '★ Gwiazda', obraz: 'brak.png' } },
      ctx,
    );
    expect(ostrzezenia).toContainEqual({
      pole: 'naglowek',
      komunikat: 'brak-znakow',
      szczegoly: '★',
    });
    expect(ostrzezenia).toContainEqual({
      pole: 'obraz',
      komunikat: 'brak-obrazu',
      szczegoly: 'brak.png',
    });
  });

  it('auto-dopasowanie nagłówka i ostrzeżenie o przepełnieniu', () => {
    const krotki = renderujKarte(szablonBroni, { dane: { nazwa: 'Średni tytuł karty' } }, ctx);
    expect(krotki.ostrzezenia).toEqual([]);
    const dlugi = renderujKarte(
      szablonBroni,
      { dane: { nazwa: 'Bardzo długi tytuł, który nie ma szans się zmieścić' } },
      ctx,
    );
    expect(dlugi.ostrzezenia).toContainEqual({
      pole: 'naglowek',
      komunikat: 'tekst-nie-miesci-sie',
    });
  });
});

describe('etykieta i pole do wpisania', () => {
  const szablon: Szablon = {
    id: 'stan',
    nazwa: 'Stan (test)',
    rozmiar: { tryb: 'mm', szerokosc: 25.75, wysokosc: 25.75 },
    korzen: {
      id: 'k',
      typ: 'kolumna',
      padding: 1,
      dzieci: [
        {
          id: 'opis',
          typ: 'tekst',
          klucz: 'opis',
          wysokosc: { wypelnij: 1 },
          styl: { czcionka: 'tresc', wariant: 'kursywa', rozmiar: pt(6) },
        },
        {
          id: 'usuniecie',
          typ: 'tekst',
          klucz: 'usuniecie',
          etykieta: { tekst: 'Usunięcie:', pozycja: 'nad', styl: { wariant: 'pogrubiony' } },
          styl: { czcionka: 'tresc', rozmiar: pt(6) },
        },
        {
          id: 'sakiewka',
          typ: 'wpis',
          klucz: 'stan',
          sufiks: '/ 250p',
          styl: { czcionka: 'tresc', wariant: 'pogrubiony', rozmiar: pt(6) },
          obramowanie: { grubosc: 0.2, kolor: '#000000' },
          padding: 0.6,
        },
      ],
    },
  };

  it('etykieta zostaje przy pustej wartości', () => {
    const { scena } = renderujKarte(szablon, { dane: {} }, { czcionki });
    const tekst = wszystkie(scena).filter((e) => e.typ === 'tekst');
    // „Usunięcie:” + sufiks wpisu.
    const glify = tekst.flatMap((e) => (e.typ === 'tekst' ? e.glify : []));
    expect(glify.length).toBe('Usunięcie:'.length + '/250p'.length);
  });

  it('etykieta nad wartością = dwa wiersze', () => {
    const { scena } = renderujKarte(szablon, { dane: { usuniecie: 'Odpoczynek' } }, { czcionki });
    const ys = new Set(
      wszystkie(scena)
        .flatMap((e) => (e.typ === 'tekst' ? e.glify : []))
        .map((g) => Math.round(g.y * 100)),
    );
    expect(ys.size).toBe(3); // etykieta, wartość, sufiks wpisu
  });

  it('wartoscPola i czyPuste', () => {
    const p = szablon.korzen.dzieci[1]!;
    if (p.typ !== 'tekst') throw new Error();
    expect(wartoscPola(p, { usuniecie: '  ' })).toBe('');
    expect(czyPuste(p, {})).toBe(true);
  });
});

describe('poprawki po przeglądzie E2', () => {
  const okregi = (dane: Record<string, string>) =>
    wszystkie(renderujKarte(szablonBroni, { dane }, ctx).scena).filter((e) => e.typ === 'okrag')
      .length;

  it('znaczniki: ułamki w dół, limit, pusta komórka = wartość domyślna', () => {
    expect(okregi({ uzycia: '2.5' })).toBe(2);
    expect(okregi({ uzycia: '2,9' })).toBe(2);
    expect(okregi({ uzycia: '100000' })).toBe(60);
    expect(okregi({ uzycia: '' })).toBe(3);
    expect(okregi({})).toBe(3);
    expect(okregi({ uzycia: '0' })).toBe(0);
  });

  it('wpis z kluczem i pustymi danymi nadal pokazuje sufiks', () => {
    const szablon: Szablon = {
      id: 'sakiewka',
      nazwa: 'Sakiewka',
      rozmiar: { tryb: 'mm', szerokosc: 25, wysokosc: 6 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 'wpis',
            typ: 'wpis',
            klucz: 'stan',
            sufiks: '/ 250p',
            styl: { czcionka: 'tresc', rozmiar: pt(6) },
            obramowanie: { grubosc: 0.2, kolor: '#000000' },
          },
        ],
      },
    };
    const pusty = renderujKarte(szablon, { dane: {} }, { czcionki }).scena;
    expect(ile(pusty, 'tekst')).toBe(1);
    expect(ile(pusty, 'prostokat')).toBe(1);
    const wypelniony = renderujKarte(szablon, { dane: { stan: '120' } }, { czcionki }).scena;
    const glify = wszystkie(wypelniony).flatMap((e) => (e.typ === 'tekst' ? e.glify : []));
    expect(glify).toHaveLength('/250p'.length + '120'.length);
  });
});

describe('ramka ze ściętymi rogami', () => {
  it('kontur to ośmiokąt ze ścięciem ograniczonym do połowy krótszego boku', () => {
    const k = konturScietego({ x: 0, y: 0, szer: 10, wys: 4 }, 3);
    expect(k).toHaveLength(9);
    expect(k[0]).toEqual(['M', 2, 0]);
    expect(k[2]).toEqual(['L', 10, 2]);
  });

  it('obrys leży wewnątrz tła: zewnętrzna krawędź linii pokrywa się z krawędzią tła', () => {
    const szablon: Szablon = {
      id: 'z',
      nazwa: 'z',
      rozmiar: { tryb: 'mm', szerokosc: 20, wysokosc: 10 },
      korzen: {
        id: 'k',
        typ: 'warstwy',
        dzieci: [
          {
            id: 'w',
            typ: 'wartosc',
            tekst: '-1 obr',
            ksztalt: 'sciety',
            promien: 1,
            tlo: '#ffffff',
            obramowanie: { grubosc: 0.2, kolor: '#000000' },
            styl: { czcionka: 'tresc', rozmiar: pt(8) },
          },
        ],
      },
    };
    const sciezki = renderujKarte(szablon, { dane: {} }, { czcionki }).scena.elementy.filter(
      (e) => e.typ === 'sciezka',
    );
    expect(sciezki).toHaveLength(2);
    const [tlo, obrys] = sciezki;
    if (tlo?.typ !== 'sciezka' || obrys?.typ !== 'sciezka') throw new Error();
    // Ukośny bok: odległość między równoległymi ukosami tła i osi linii = g/2.
    const odlUkosu = (kontur: typeof tlo.kontur) => {
      const [, x1, y1] = kontur[0] as ['M', number, number];
      const [, x2, y2] = kontur[7] as ['L', number, number];
      // Prosta przez (x1,y1) i (x2,y2); odległość od początku układu (lewy górny róg).
      return (
        Math.abs((y2 - y1) * 0 - (x2 - x1) * 0 + x2 * y1 - y2 * x1) / Math.hypot(y2 - y1, x2 - x1)
      );
    };
    expect(odlUkosu(obrys.kontur) - odlUkosu(tlo.kontur)).toBeCloseTo(0.1, 6);
  });
});

describe('parametry szablonu i warianty układu', () => {
  const zParametrem: Szablon = {
    id: 'p',
    nazwa: 'p',
    rozmiar: { tryb: 'sloty', slot: { szerokosc: 25.75, wysokosc: 25.75 }, kolumny: 1, rzedy: 1 },
    parametry: [{ klucz: 'etykieta', nazwa: 'Etykieta', domyslnie: 'Usunięcie:' }],
    korzen: {
      id: 'k',
      typ: 'kolumna',
      dzieci: [
        {
          id: 't',
          typ: 'tekst',
          klucz: 'wartosc',
          etykieta: { tekst: { parametr: 'etykieta' }, pozycja: 'przed' },
          styl: { czcionka: 'tresc', rozmiar: pt(8) },
        },
      ],
    },
    warianty: [{ kolumny: 1, rzedy: 2, korzen: { id: 'inny', typ: 'kolumna', dzieci: [] } }],
  };
  const liczbaGlifow = (
    dane: Record<string, string>,
    rozmiar?: { kolumny: number; rzedy: number },
  ) =>
    wszystkie(renderujKarte(zParametrem, { dane, rozmiar }, { czcionki }).scena).flatMap((e) =>
      e.typ === 'tekst' ? e.glify : [],
    ).length;

  it('daneZParametrami: domyślna wartość, nadpisanie niepustą wartością z danych', () => {
    expect(daneZParametrami(zParametrem, {})).toEqual({ etykieta: 'Usunięcie:' });
    expect(daneZParametrami(zParametrem, { etykieta: '  ' })).toEqual({ etykieta: 'Usunięcie:' });
    expect(daneZParametrami(zParametrem, { etykieta: 'Leczenie:' }).etykieta).toBe('Leczenie:');
  });

  it('etykieta z parametru i jej nadpisanie w danych karty', () => {
    expect(liczbaGlifow({})).toBe('Usunięcie:'.length);
    expect(liczbaGlifow({ etykieta: 'Leczenie:' })).toBe('Leczenie:'.length);
    expect(liczbaGlifow({ etykieta: 'Ok:', wartosc: 'sen' })).toBe('Ok:sen'.length);
  });

  it('wariant układu wybierany wg rozmiaru karty w slotach', () => {
    expect(korzenKarty(zParametrem).id).toBe('k');
    expect(korzenKarty(zParametrem, { rozmiar: { kolumny: 1, rzedy: 2 } }).id).toBe('inny');
    expect(liczbaGlifow({}, { kolumny: 1, rzedy: 2 })).toBe(0);
  });

  it('obwódka trafia do elementu tekstu sceny', () => {
    const s: Szablon = {
      ...zParametrem,
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 't',
            typ: 'tekst',
            tekst: 'Lekka',
            styl: {
              czcionka: 'tresc',
              rozmiar: pt(8),
              obwodka: { grubosc: 0.7, kolor: '#ffffff' },
            },
          },
        ],
      },
    };
    const [tekst] = wszystkie(renderujKarte(s, { dane: {} }, { czcionki }).scena).filter(
      (e) => e.typ === 'tekst',
    );
    expect(tekst).toMatchObject({ obwodka: { grubosc: 0.7, kolor: '#ffffff' } });
  });
});

describe('obraz – omijanie pól i ustawienia karty', () => {
  const kwadrat = { szerokosc: 100, wysokosc: 100 };
  const ramka = { x: 0, y: 0, szer: 20, wys: 14 };

  it('wolny obszar: największy prostokąt obok przeszkody, z odstępem', () => {
    // Przeszkoda w prawym górnym rogu: lewa strona 13 × 14 > dół 20 × 6.
    const p = { x: 14, y: 0, szer: 6, wys: 7.5 };
    expect(wolnyObszar(ramka, [p], 0.5, kwadrat, 'dopasuj')).toEqual({
      x: 0,
      y: 0,
      szer: 13.5,
      wys: 14,
    });
    // Dla „wypełnij” liczy się powierzchnia prostokąta: 13,5 × 14 = 189 > 20 × 6 = 120.
    expect(wolnyObszar(ramka, [p], 0.5, kwadrat, 'wypelnij').szer).toBe(13.5);
    // Szeroki obraz (4:1) lepiej mieści się pod przeszkodą.
    expect(wolnyObszar(ramka, [p], 0.5, { szerokosc: 4, wysokosc: 1 }, 'dopasuj')).toEqual({
      x: 0,
      y: 8,
      szer: 20,
      wys: 6,
    });
    // Przeszkoda poza ramką nic nie zmienia.
    expect(wolnyObszar(ramka, [{ x: 30, y: 0, szer: 5, wys: 5 }], 0.5, kwadrat, 'dopasuj')).toEqual(
      ramka,
    );
  });

  const szablon: Szablon = {
    id: 'o',
    nazwa: 'Obraz',
    rozmiar: { tryb: 'mm', szerokosc: 30, wysokosc: 20 },
    korzen: {
      id: 'k',
      typ: 'warstwy',
      dzieci: [
        { id: 'obraz', typ: 'obraz', klucz: 'obraz', dopasowanie: 'dopasuj', omijaj: ['znak'] },
        {
          id: 'znak',
          typ: 'ikona',
          ikona: 'gwiazdka',
          rozmiar: 8,
          wyrownanie: { poziomo: 'koniec', pionowo: 'poczatek' },
        },
      ],
    },
  };
  const obrazy = (sc: Scena) => wszystkie(sc).filter((e) => e.typ === 'obraz');

  it('obraz nie wchodzi pod omijane pole', () => {
    const [o] = obrazy(renderujKarte(szablon, { dane: { obraz: 'kij.png' } }, ctx).scena);
    // Ramka 30 × 20, gwiazdka 8 × 8 w prawym górnym rogu: wolne 21,5 × 20 po lewej.
    expect(o).toMatchObject({ typ: 'obraz' });
    if (o?.typ !== 'obraz') return;
    expect(o.x + o.szer).toBeLessThanOrEqual(21.5 + 1e-9);
    expect(o.szer / o.wys).toBeCloseTo(4 / 3);
    expect(o.przyciecie).toBeUndefined();
  });

  it('skala, przesunięcie i obrót z danych karty; przycięcie do ramki pola', () => {
    const bez = obrazy(renderujKarte(szablon, { dane: { obraz: 'kij.png' } }, ctx).scena)[0]!;
    const z = obrazy(
      renderujKarte(
        szablon,
        {
          dane: { obraz: 'kij.png' },
          obrazy: { obraz: { skala: 2, przesuniecie: { x: 1, y: -2 }, obrot: 30 } },
        },
        ctx,
      ).scena,
    )[0]!;
    if (bez.typ !== 'obraz' || z.typ !== 'obraz') throw new Error('brak obrazu');
    expect(z.szer).toBeCloseTo(bez.szer * 2);
    expect(z.x + z.szer / 2).toBeCloseTo(bez.x + bez.szer / 2 + 1);
    expect(z.y + z.wys / 2).toBeCloseTo(bez.y + bez.wys / 2 - 2);
    expect(z.obrot).toBe(30);
    expect(z.przyciecie).toEqual({ x: 0, y: 0, szer: 30, wys: 20 });
  });

  it('ustawienia neutralne nic nie zmieniają; dopasowanie z karty nadpisuje szablon', () => {
    const bez = renderujKarte(szablon, { dane: { obraz: 'kij.png' } }, ctx).scena;
    const neutralne = renderujKarte(
      szablon,
      {
        dane: { obraz: 'kij.png' },
        obrazy: { obraz: { skala: 1, obrot: 360, przesuniecie: { x: 0, y: 0 } } },
      },
      ctx,
    ).scena;
    expect(scenaDoSvg(neutralne)).toBe(scenaDoSvg(bez));
    const [r] = obrazy(
      renderujKarte(
        szablon,
        { dane: { obraz: 'kij.png' }, obrazy: { obraz: { dopasowanie: 'rozciagnij' } } },
        ctx,
      ).scena,
    );
    expect(r).toMatchObject({ x: 0, y: 0, szer: 21.5, wys: 20 });
  });

  it('SVG: obrót na obrazie, przycięcie na grupie (nie obraca się z obrazem)', () => {
    const { scena } = renderujKarte(
      szablon,
      { dane: { obraz: 'kij.png' }, obrazy: { obraz: { obrot: 90 } } },
      ctx,
    );
    const svg = scenaDoSvg(scena, { adresObrazu: () => 'kij.png' });
    expect(svg).toMatch(
      /<g clip-path="url\(#p0\)"><image [^>]*transform="rotate\(90 [\d.]+ [\d.]+\)"\/><\/g>/,
    );
  });
});

describe('obraz – przypadki z przeglądu E4a', () => {
  const szablon = (omijaj: string[], extra: Record<string, unknown> = {}): Szablon => ({
    id: 'o',
    nazwa: 'Obraz',
    rozmiar: { tryb: 'mm', szerokosc: 20, wysokosc: 14 },
    korzen: {
      id: 'k',
      typ: 'warstwy',
      dzieci: [
        { id: 'obraz', typ: 'obraz', klucz: 'obraz', dopasowanie: 'dopasuj', omijaj, ...extra },
        {
          id: 'znak',
          typ: 'ikona',
          ikona: 'gwiazdka',
          klucz: 'znak',
          gdyPuste: 'ukryj',
          rozmiar: 6,
          minWysokosc: 7.5,
          wyrownanie: { poziomo: 'koniec', pionowo: 'poczatek' },
        },
        {
          id: 'drugi',
          typ: 'ikona',
          ikona: 'gwiazdka',
          rozmiar: 4,
          wyrownanie: { poziomo: 'poczatek', pionowo: 'koniec' },
        },
      ],
    },
  });
  const kwadrat = {
    czcionki,
    obraz: (z: string) => (z === 'k.png' ? { szerokosc: 100, wysokosc: 100 } : undefined),
  };
  const obraz = (sz: Szablon, dane: Record<string, string>, obrazy?: Record<string, object>) => {
    const w = renderujKarte(
      sz,
      { dane: { obraz: 'k.png', ...dane }, ...(obrazy ? { obrazy } : {}) },
      kwadrat,
    );
    const o = wszystkie(w.scena).find((e) => e.typ === 'obraz');
    return { o: o?.typ === 'obraz' ? o : undefined, ostrzezenia: w.ostrzezenia };
  };

  it('„wypełnij” z omijaniem przycina do wolnego obszaru, nie do ramki pola', () => {
    const { o } = obraz(szablon(['znak'], { dopasowanie: 'wypelnij' }), { znak: '1' });
    // Wolny obszar po lewej: 20 − 6 − 0,5 = 13,5 × 14.
    expect(o!.przyciecie).toEqual({ x: 0, y: 0, szer: 13.5, wys: 14 });
  });

  it('ukryte omijane pole nie zabiera miejsca; kilka przeszkód naraz', () => {
    const pelny = obraz(szablon(['znak']), {}).o!;
    expect([pelny.x, pelny.y, pelny.szer, pelny.wys].map((v) => +v.toFixed(6) + 0)).toEqual([
      3, 0, 14, 14,
    ]);
    // Znak (prawy górny róg, do y 7,5) i drugi (lewy dolny, od y 10): obraz omija oba z odstępem.
    const { o } = obraz(szablon(['znak', 'drugi']), { znak: '1' });
    const rozlaczne = (p: { x: number; y: number; szer: number; wys: number }) =>
      o!.x + o!.szer <= p.x + 1e-9 ||
      p.x + p.szer <= o!.x + 1e-9 ||
      o!.y + o!.wys <= p.y + 1e-9 ||
      p.y + p.wys <= o!.y + 1e-9;
    expect(rozlaczne({ x: 13.5, y: 0, szer: 6.5, wys: 8 })).toBe(true);
    expect(rozlaczne({ x: 0, y: 9.5, szer: 4.5, wys: 4.5 })).toBe(true);
    expect(o!.wys).toBeCloseTo(9.5);
  });

  it('brak miejsca – ostrzeżenie zamiast obrazu 0×0; nieznany identyfikator – ostrzeżenie', () => {
    const pelna = obraz(szablon(['k']), {});
    expect(pelna.o).toBeUndefined();
    expect(pelna.ostrzezenia.map((x) => x.komunikat)).toContain('brak-miejsca-na-obraz');
    const literowka = obraz(szablon(['znakk']), {});
    expect(literowka.ostrzezenia).toContainEqual({
      pole: 'obraz',
      komunikat: 'nieznane-pole-do-omijania',
      szczegoly: 'znakk',
    });
  });

  it('niepoprawne ustawienia z danych są normalizowane; obrót ujemny działa', () => {
    expect(
      normalizujUstawieniaObrazu({
        skala: 0,
        przesuniecie: { x: Number.NaN, y: Infinity },
        obrot: Infinity,
        dopasowanie: 'zle' as never,
      }),
    ).toEqual({ skala: 1, przesuniecie: { x: 0, y: 0 }, obrot: 0 });
    expect(normalizujUstawieniaObrazu({ skala: -2, obrot: -400 })).toMatchObject({
      skala: 1,
      obrot: -40,
    });
    const bez = obraz(szablon([]), {}).o!;
    const nan = obraz(szablon([]), {}, { obraz: { skala: Number.NaN, obrot: Number.NaN } }).o!;
    expect(nan).toEqual(bez);
    const ujemny = obraz(szablon([]), {}, { obraz: { obrot: -30 } }).o!;
    expect(ujemny.obrot).toBe(-30);
    expect(
      scenaDoSvg(
        { szer: 20, wys: 14, elementy: [ujemny], glify: {} },
        { adresObrazu: () => 'k.png' },
      ),
    ).toContain('rotate(-30 ');
  });
});

describe('klocki M2: ramka karty, romb, etykiety, separator, tabela', () => {
  const svg = (s: Szablon, dane: Record<string, string>) => {
    const { scena, ostrzezenia } = renderujKarte(s, { dane }, ctx);
    return { scena, ostrzezenia, svg: scenaDoSvg(scena) };
  };

  it('A. karta czaru – wzorzec SVG, bez ostrzeżeń', async () => {
    const w = svg(szablonCzaru, daneCzaru);
    expect(w.ostrzezenia).toEqual([]);
    await expect(w.svg).toMatchFileSnapshot('./__snapshots__/m2-czar.svg');
  });

  it('B. blok statystyk – wzorzec SVG, bez ostrzeżeń', async () => {
    const w = svg(szablonStatystyk, daneStatystyk);
    expect(w.ostrzezenia).toEqual([]);
    await expect(w.svg).toMatchFileSnapshot('./__snapshots__/m2-statystyki.svg');
  });

  it('C. karta wroga – wzorzec SVG, puste pole zwinięte', async () => {
    const w = svg(szablonWroga, daneWroga);
    expect(w.ostrzezenia).toEqual([]);
    await expect(w.svg).toMatchFileSnapshot('./__snapshots__/m2-wrog.svg');
    // Puste pole z „ukryj” nie zajmuje miejsca: bez broni zdolności przesuwają się w górę,
    // a pusty opis daje ten sam obraz co brak klucza.
    const yOstatniegoGlifu = (sc: Scena, kolor: string) =>
      Math.max(
        ...sc.elementy.flatMap((e) =>
          e.typ === 'tekst' && e.kolor === kolor ? e.glify.map((g) => g.y) : [],
        ),
      );
    const bezBroni = svg(szablonWroga, { ...daneWroga, bron: '' });
    expect(yOstatniegoGlifu(bezBroni.scena, '#000000')).toBeLessThan(
      yOstatniegoGlifu(w.scena, '#000000') - 2,
    );
    expect(svg(szablonWroga, { ...daneWroga, opis: '' }).svg).toBe(w.svg);
  });

  it('położenia węzłów (do zaznaczania w edytorze szablonu)', () => {
    const { wezly } = renderujKarte(szablonCzaru, { dane: daneCzaru }, ctx);
    expect(wezly.find((w) => w.id === 'korzen')).toMatchObject({ x: 0, y: 0, szer: 63, wys: 88 });
    const nazwa = wezly.find((w) => w.id === 'nazwa')!;
    expect(nazwa.x).toBeCloseTo(2.5, 6);
    expect(nazwa.szer).toBeCloseTo(58, 6);
  });

  it('ramka karty: prostokąt z odsunięciem, rogi zgodne z kartą', () => {
    const { scena } = renderujKarte(szablonCzaru, { dane: {} }, ctx);
    const r = scena.elementy.at(-1)!;
    expect(r).toMatchObject({ typ: 'prostokat', x: 1.15, y: 1.15 });
    if (r.typ !== 'prostokat') throw new Error();
    expect(r.szer).toBeCloseTo(63 - 2.3, 6);
    expect(r.promien).toBeCloseTo(3 - 1.15, 6);
    expect(r.obrys).toMatchObject({ grubosc: 0.3, kolor: '#ffffff' });
  });

  it('romb: tło i obrys to ścieżki rombu, etykieta nad kształtem', () => {
    const s: Szablon = {
      id: 's',
      nazwa: 's',
      rozmiar: { tryb: 'mm', szerokosc: 20, wysokosc: 20 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 'v',
            typ: 'wartosc',
            klucz: 'v',
            ksztalt: 'romb',
            tlo: '#eeeeee',
            obramowanie: { grubosc: 0.4, kolor: '#000000' },
            szerokosc: { mm: 10 },
            wysokosc: { mm: 14 },
            styl: { czcionka: 'tresc', rozmiar: pt(9) },
            etykieta: { tekst: 'SIŁA', pozycja: 'nad', odstep: 1 },
          },
        ],
      },
    };
    const { scena } = renderujKarte(s, { dane: { v: '5' } }, ctx);
    const sciezki = scena.elementy.filter((e) => e.typ === 'sciezka');
    expect(sciezki).toHaveLength(2);
    const [tlo, obr] = sciezki as Extract<ElementSceny, { typ: 'sciezka' }>[];
    // Tło: wierzchołki rombu w obszarze pod etykietą.
    const ys = tlo!.kontur.flatMap((c) => (c[0] === 'Z' ? [] : [c[2] as number]));
    const etykietaWys = 14 - (Math.max(...ys) - Math.min(...ys)) - 1;
    expect(etykietaWys).toBeGreaterThan(2);
    expect(Math.max(...ys)).toBeCloseTo(14, 6);
    expect(obr!.obrys).toMatchObject({ grubosc: 0.4 });
    // Dwa elementy tekstu: etykieta i wartość.
    expect(ile(scena, 'tekst')).toBe(2);
    expect(konturRombu({ x: 0, y: 0, szer: 4, wys: 4 })).toEqual([
      ['M', 2, 0],
      ['L', 4, 2],
      ['L', 2, 4],
      ['L', 0, 2],
      ['Z'],
    ]);
  });

  it('tabela: kolumna danych na komórkę, linie siatki, auto-dopasowanie i rozciągnięcie', () => {
    const tab = szablonStatystyk.korzen.dzieci[1]!;
    if (tab.typ !== 'tabela') throw new Error();
    expect(czyPuste(tab, {})).toBe(true);
    expect(czyPuste(tab, { cecha_ww: '30' })).toBe(false);
    const { scena } = renderujKarte(szablonStatystyk, { dane: daneStatystyk }, ctx);
    const linie = scena.elementy.filter((e) => e.typ === 'linia');
    // 11 pionowych między 12 kolumnami, 1 pod nagłówkiem, 1 separator.
    expect(linie).toHaveLength(13);
    // Tabela rozciągnięta na całą szerokość wnętrza (88 − 2·3).
    const obwodka = scena.elementy.find(
      (e) => e.typ === 'prostokat' && e.obrys?.grubosc === 0.2 && !e.wypelnienie,
    );
    expect(obwodka).toMatchObject({ x: 3.1 });
    if (obwodka?.typ !== 'prostokat') throw new Error();
    expect(obwodka.szer).toBeCloseTo(88 - 6 - 0.2, 6);
  });

  it('tabela z pustymi wartościami rysuje nagłówki i siatkę; pusta lista kolumn – nic', () => {
    const { scena, ostrzezenia } = renderujKarte(szablonStatystyk, { dane: {} }, ctx);
    expect(ostrzezenia).toEqual([]);
    // 11 pionowych + 1 pod nagłówkiem + separator.
    expect(scena.elementy.filter((e) => e.typ === 'linia')).toHaveLength(13);
    const tab = szablonStatystyk.korzen.dzieci[1]!;
    const bezKolumn: Szablon = {
      ...szablonStatystyk,
      korzen: {
        ...szablonStatystyk.korzen,
        dzieci: [{ ...tab, kolumny: [] } as typeof tab],
      },
    };
    expect(renderujKarte(bezKolumn, { dane: {} }, ctx).scena.elementy).toHaveLength(2); // tło, ramka
  });

  it('kolumna tabeli węższa niż treść daje ostrzeżenie', () => {
    const tab = szablonStatystyk.korzen.dzieci[1]!;
    if (tab.typ !== 'tabela') throw new Error();
    const waska: Szablon = {
      ...szablonStatystyk,
      korzen: {
        ...szablonStatystyk.korzen,
        dzieci: [
          {
            ...tab,
            kolumny: [{ naglowek: 'Bardzo długi nagłówek', klucz: 'x', szerokosc: { mm: 3 } }],
          },
        ],
      },
    };
    const { ostrzezenia } = renderujKarte(waska, { dane: { x: '1' } }, ctx);
    expect(ostrzezenia).toContainEqual({ pole: 'cechy', komunikat: 'tekst-nie-miesci-sie' });
  });

  it('separator nie rozpycha kontenera mierzonego wg treści', () => {
    const s: Szablon = {
      id: 's',
      nazwa: 's',
      rozmiar: { tryb: 'mm', szerokosc: 40, wysokosc: 20 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 'srodek',
            typ: 'kolumna',
            wyrownanie: { poziomo: 'srodek' },
            dzieci: [
              { id: 't', typ: 'tekst', tekst: 'Ab', styl: { czcionka: 'tresc', rozmiar: pt(9) } },
              { id: 'sep', typ: 'separator', kierunek: 'poziomy', grubosc: 0.3 },
            ],
          },
        ],
      },
    };
    const l = renderujKarte(s, { dane: {} }, ctx).scena.elementy.find((e) => e.typ === 'linia');
    if (l?.typ !== 'linia') throw new Error();
    expect(l.x2 - l.x1).toBeLessThan(10); // szerokość tekstu „Ab”, nie 40 mm
    expect(l.x1).toBeGreaterThan(15);
  });

  it('etykieta pod tekstem i separator pionowy', () => {
    const s: Szablon = {
      id: 's',
      nazwa: 's',
      rozmiar: { tryb: 'mm', szerokosc: 30, wysokosc: 20 },
      korzen: {
        id: 'k',
        typ: 'wiersz',
        dzieci: [
          {
            id: 't',
            typ: 'tekst',
            klucz: 't',
            szerokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: pt(9) },
            etykieta: { tekst: 'podpis', pozycja: 'pod' },
          },
          {
            id: 'sep',
            typ: 'separator',
            kierunek: 'pionowy',
            grubosc: 0.5,
            stylLinii: 'przerywana',
          },
          {
            id: 'u',
            typ: 'tekst',
            klucz: 'u',
            szerokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: pt(9) },
          },
        ],
      },
    };
    const { scena } = renderujKarte(s, { dane: { t: 'wartość', u: 'x' } }, ctx);
    const l = scena.elementy.find((e) => e.typ === 'linia');
    expect(l).toMatchObject({ y1: 0, y2: 20 });
    if (l?.typ !== 'linia') throw new Error();
    expect(l.x1).toBe(l.x2);
    expect(l.obrys.kreska).toBeDefined();
  });
});

describe('M2-4: tabela N wierszy, kształty', () => {
  const zTabela = (tab: Partial<Extract<Szablon['korzen']['dzieci'][number], { typ: 'tabela' }>>) =>
    ({
      id: 't',
      nazwa: 't',
      rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 40 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 'tab',
            typ: 'tabela',
            kolumny: [
              { naglowek: 'A', klucz: 'a' },
              { naglowek: 'B', klucz: 'b', wyrownanie: 'prawo' },
            ],
            styl: { czcionka: 'tresc', rozmiar: pt(8) },
            linie: { grubosc: 0.2, kolor: '#000000' },
            ...tab,
          },
        ],
      },
    }) as Szablon;

  it('trzy wiersze wartości: klucze komórek, linie między wierszami', () => {
    const s = zTabela({ wiersze: 3 });
    const tab = s.korzen.dzieci[0]!;
    if (tab.typ !== 'tabela') throw new Error();
    expect(kluczeTabeli(tab)).toEqual(['a', 'b', 'a_2', 'b_2', 'a_3', 'b_3']);
    const { scena } = renderujKarte(s, { dane: { a: '1', b_3: '9' } }, ctx);
    const poziome = scena.elementy.filter((e) => e.typ === 'linia' && e.y1 === e.y2);
    expect(poziome).toHaveLength(3); // pod nagłówkiem i między trzema wierszami
    expect(czyPuste(tab, { b_3: '9' })).toBe(false);
  });

  it('bez wiersza nagłówków – tylko wiersze wartości', () => {
    const z = renderujKarte(zTabela({ naglowki: false, wiersze: 2 }), { dane: { a: '1' } }, ctx);
    const poziome = z.scena.elementy.filter((e) => e.typ === 'linia' && e.y1 === e.y2);
    expect(poziome).toHaveLength(1);
    const wys = z.wezly.find((w) => w.id === 'tab')!.wys;
    const zNagl = renderujKarte(zTabela({ wiersze: 2 }), { dane: { a: '1' } }, ctx);
    expect(zNagl.wezly.find((w) => w.id === 'tab')!.wys).toBeGreaterThan(wys + 1);
  });

  it('kształty: kwadrat równoboczny, tarcza i sześciokąt jako ścieżki z treścią w środku', () => {
    for (const ksztalt of ['kwadrat', 'tarcza', 'szesciokat'] as const) {
      const s: Szablon = {
        id: 's',
        nazwa: 's',
        rozmiar: { tryb: 'mm', szerokosc: 40, wysokosc: 40 },
        korzen: {
          id: 'k',
          typ: 'kolumna',
          dzieci: [
            {
              id: 'v',
              typ: 'wartosc',
              klucz: 'v',
              ksztalt,
              wyrownanie: { poziomo: 'srodek' },
              tlo: '#eeeeee',
              obramowanie: { grubosc: 0.3, kolor: '#000000' },
              styl: { czcionka: 'tresc', rozmiar: pt(9) },
            },
          ],
        },
      };
      const { scena, wezly, ostrzezenia } = renderujKarte(s, { dane: { v: '12' } }, ctx);
      expect(ostrzezenia, ksztalt).toEqual([]);
      const v = wezly.find((w) => w.id === 'v')!;
      if (ksztalt === 'kwadrat') expect(v.szer).toBeCloseTo(v.wys, 6);
      else expect(scena.elementy.filter((e) => e.typ === 'sciezka')).toHaveLength(2);
    }
  });
});
