import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import { renderujKarte } from '../silnik/karta';
import { polaczGlify, type ElementSceny, type Scena } from '../silnik/scena';
import { rejestrTestowy, szablonBroni } from '../silnik/__testy__/pomoc';
import {
  daneCzaru,
  daneStatystyk,
  daneWroga,
  szablonCzaru,
  szablonStatystyk,
  szablonWroga,
} from '../silnik/__testy__/przyklady';
import { scenyDoPdf } from './pdf';

const czcionki = rejestrTestowy();

// 1×1 px, PNG (czarny piksel).
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

const LOREM =
  'Mysz przemierza ciemne korytarze pod starym młynem, niosąc pochodnię, linę i odrobinę sera. ' +
  'Każdy krok odbija się echem, a w szczelinach coś szeleści. Gdy płomień przygasa, trzeba zdecydować: ' +
  'zawrócić czy iść dalej w głąb, tam gdzie żaby strzegą zapomnianego skarbu? Źdźbła słomy, żołędzie i ości ' +
  'zaścielają podłogę.';

const szablonOpisu: Szablon = {
  id: 'opis',
  nazwa: 'Opis',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: {
    id: 'k',
    typ: 'kolumna',
    padding: 3,
    dzieci: [
      { id: 'opis', typ: 'tekst', klucz: 'opis', styl: { czcionka: 'tresc', rozmiar: pt(7.5) } },
    ],
  },
};

/** Arkusz A4 z wieloma kartami pełnymi tekstu – karty wstawione jako grupy. */
function arkuszZTekstem(liczbaKart: number): Scena {
  const elementy: ElementSceny[] = [];
  const slowniki = [];
  for (let i = 0; i < liczbaKart; i++) {
    const { scena } = renderujKarte(
      szablonOpisu,
      { dane: { opis: `${i + 1}. ${LOREM}` } },
      { czcionki },
    );
    slowniki.push(scena.glify);
    elementy.push({
      typ: 'grupa',
      x: (i % 4) * 64,
      y: (Math.floor(i / 4) % 2) * 89,
      elementy: scena.elementy,
    });
  }
  return { szer: 297, wys: 210, elementy, glify: polaczGlify(...slowniki) };
}

const liczUzyciaGlifow = (s: Scena) =>
  s.elementy.reduce(
    (suma, e) =>
      suma +
      (e.typ === 'grupa' ? e.elementy : [e]).reduce(
        (a, x) => a + (x.typ === 'tekst' ? x.glify.length : 0),
        0,
      ),
    0,
  );

describe('scenyDoPdf', () => {
  it('karty z klockami M2 (romb, tabela, separator, ramka karty) dają poprawny PDF', async () => {
    const sceny = [
      renderujKarte(szablonCzaru, { dane: daneCzaru }, { czcionki }).scena,
      renderujKarte(szablonStatystyk, { dane: daneStatystyk }, { czcionki }).scena,
      renderujKarte(szablonWroga, { dane: daneWroga }, { czcionki }).scena,
    ];
    const { bajty } = await scenyDoPdf(sceny);
    const doc = await PDFDocument.load(bajty);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getPage(1).getWidth()).toBeCloseTo((88 / 25.4) * 72, 1);
  });

  it('tworzy stronę o wymiarach sceny (mm → pt)', async () => {
    const { scena } = renderujKarte(
      szablonBroni,
      { dane: { nazwa: 'Kij', obrazenia: 'k6', klasa: 'Lekka' } },
      { czcionki },
    );
    const { bajty } = await scenyDoPdf([scena]);
    const doc = await PDFDocument.load(bajty);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(73, 1);
    expect(height).toBeCloseTo(73, 1);
  });

  it('każdy glif zapisany raz – liczba XObjectów = liczba różnych glifów', async () => {
    const scena = arkuszZTekstem(8);
    const { liczbaGlifow } = await scenyDoPdf([scena]);
    expect(liczbaGlifow).toBe(Object.keys(scena.glify).length);
    expect(liczUzyciaGlifow(scena)).toBeGreaterThan(liczbaGlifow * 20);
  });

  it('rozmiar: arkusz z dużą ilością tekstu i 10 stron nie puchnie', async () => {
    const scena = arkuszZTekstem(12);
    const uzycia = liczUzyciaGlifow(scena);
    const jedna = (await scenyDoPdf([scena])).bajty.length;
    const dziesiec = (await scenyDoPdf(Array.from({ length: 10 }, () => scena))).bajty.length;
    // ~3 tys. glifów na stronie (12 kart po ~270 znaków). Kontury zapisane raz; każde wstawienie to kilka bajtów po kompresji.
    expect(uzycia).toBeGreaterThan(2500);
    console.info(`PDF: ${uzycia} wstawień glifów, 1 strona ${jedna} B, 10 stron ${dziesiec} B`);
    expect(jedna).toBeLessThan(80_000);
    expect(jedna / uzycia).toBeLessThan(20);
    // Kolejne strony z tymi samymi glifami kosztują tylko wstawienia, nie kontury.
    expect((dziesiec - jedna) / 9 / uzycia).toBeLessThan(4);
  });

  it('jest deterministyczny', async () => {
    const scena = arkuszZTekstem(2);
    const a = (await scenyDoPdf([scena])).bajty;
    const b = (await scenyDoPdf([scena])).bajty;
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('osadza obraz raz, nawet użyty wiele razy', async () => {
    const scena: Scena = {
      szer: 50,
      wys: 50,
      glify: {},
      elementy: [
        { typ: 'obraz', zasob: 'a', x: 0, y: 0, szer: 10, wys: 10 },
        {
          typ: 'obraz',
          zasob: 'a',
          x: 20,
          y: 0,
          szer: 10,
          wys: 10,
          przyciecie: { x: 20, y: 0, szer: 5, wys: 5 },
        },
      ],
    };
    const { bajty } = await scenyDoPdf([scena], { obraz: () => ({ dane: PNG, format: 'png' }) });
    const tekst = Buffer.from(bajty).toString('latin1');
    expect(tekst.match(/\/Subtype \/Image/g)).toHaveLength(1);
  });

  it('uszkodzony obraz nie przerywa PDF, tylko jest zgłaszany', async () => {
    const scena: Scena = {
      szer: 20,
      wys: 20,
      glify: {},
      elementy: [{ typ: 'obraz', zasob: 'zly', x: 0, y: 0, szer: 10, wys: 10 }],
    };
    const wynik = await scenyDoPdf([scena], {
      obraz: () => ({ dane: new Uint8Array([1, 2, 3]), format: 'png' }),
    });
    expect(wynik.pominieteObrazy).toEqual(['zly']);
    expect((await PDFDocument.load(wynik.bajty)).getPageCount()).toBe(1);
  });
});
