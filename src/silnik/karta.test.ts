import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import {
  czyPuste,
  daneZParametrami,
  konturScietego,
  renderujKarte,
  wartoscPola,
  normalizujUstawieniaObrazu,
  wolnyObszar,
} from './karta';
import { korzenKarty } from '../model/szablon';
import type { ElementSceny, Scena } from './scena';
import { scenaDoSvg } from './svg';
import { rejestrTestowy, szablonBroni } from './__testy__/pomoc';

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
