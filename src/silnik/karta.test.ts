import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import { czyPuste, konturScietego, renderujKarte, wartoscPola } from './karta';
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
