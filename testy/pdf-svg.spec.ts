import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { porownaj, przygotujStrone } from './pdfSvg';
import { zbudujArkusz } from '../src/druk/arkusz';
import { scenyDoPdf } from '../src/druk/pdf';
import { arkuszeMausrittera } from '../src/pakiety/mausritter/arkusze';
import { pt } from '../src/model/jednostki';
import type { Szablon } from '../src/model/szablon';
import { renderujKarte } from '../src/silnik/karta';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy, szablonBroni } from '../src/silnik/__testy__/pomoc';
import { szablonBron, szablonyMausrittera } from '../src/pakiety/mausritter/szablony';
import { OBRAZ_ZASTEPCZY, talieMausrittera } from '../src/pakiety/mausritter/talie';

const PNG_ZASTEPCZY = readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png');
/** Ciemna, niesymetryczna litera „F” – obrót lub odbicie od razu widać w porównaniu. */
const PNG_LITERA = readFileSync('testy/zasoby/litera-f.png');
const LITERA = 'litera-f';
const PNGI: Record<string, Buffer> = { [OBRAZ_ZASTEPCZY]: PNG_ZASTEPCZY, [LITERA]: PNG_LITERA };

/**
 * Podgląd = wydruk: ta sama scena zapisana jako SVG (rysuje Chromium) i jako PDF (rysuje pdf.js)
 * musi dać prawie ten sam obraz. Różnice dopuszczamy tylko na wygładzanych krawędziach.
 */

const czcionki = rejestrTestowy();

const szablonOpisu: Szablon = {
  id: 'opis',
  nazwa: 'Opis',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 44 },
  korzen: {
    id: 'k',
    typ: 'kolumna',
    padding: 2,
    odstep: 1,
    obramowanie: { grubosc: 0.3, kolor: '#7a2e1f', styl: 'przerywana' },
    dzieci: [
      {
        id: 'tytul',
        typ: 'tekst',
        klucz: 'tytul',
        styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(14), wyrownanie: 'srodek' },
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        styl: { czcionka: 'tresc', wariant: 'kursywa', rozmiar: pt(8) },
      },
      {
        id: 'gwiazdka',
        typ: 'ikona',
        ikona: 'gwiazdka',
        rozmiar: 4,
        wyrownanie: { poziomo: 'koniec' },
      },
    ],
  },
};

/** Tryb swobodny: kotwice, obroty 90/180/270 tekstu i obrazu, kolumna w obróconym kontenerze. */
const szablonSwobodny: Szablon = {
  id: 'swobodny',
  nazwa: 'Swobodny',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo: '#f4ecd8',
  korzen: {
    id: 'k',
    typ: 'swobodny',
    dzieci: [
      {
        id: 'ilustracja',
        typ: 'obraz',
        zasob: LITERA,
        dopasowanie: 'dopasuj',
        szerokosc: { mm: 30 },
        wysokosc: { mm: 30 },
        pozycja: { x: 4, y: 4, obrot: 90 },
      },
      {
        id: 'tytul',
        typ: 'tekst',
        tekst: 'Bagienny troll',
        wieleWierszy: false,
        szerokosc: { mm: 44 },
        wysokosc: { mm: 9 },
        tlo: '#2a3b50',
        padding: 1,
        pozycja: { x: 0, y: -4, kotwica: 'dolny' },
        styl: {
          czcionka: 'tytul',
          wariant: 'pogrubiony',
          rozmiar: pt(12),
          kolor: '#ffffff',
          wyrownanie: 'srodek',
          wyrownaniePionowe: 'srodek',
        },
      },
      {
        id: 'bok',
        typ: 'tekst',
        tekst: 'STWÓR · BAGNA',
        wieleWierszy: false,
        szerokosc: { mm: 40 },
        wysokosc: { mm: 5 },
        pozycja: { x: -2, y: 4, kotwica: 'prawy-gorny', obrot: 270 },
        styl: { czcionka: 'tresc', rozmiar: pt(8), wyrownanie: 'srodek' },
      },
      {
        id: 'kolumna',
        typ: 'kolumna',
        odstep: 1,
        szerokosc: { mm: 26 },
        wysokosc: { mm: 22 },
        tlo: '#ffffff',
        padding: 1,
        obramowanie: { grubosc: 0.3, kolor: '#7a2e1f' },
        pozycja: { x: 36, y: 40, obrot: 180 },
        dzieci: [
          {
            id: 'a',
            typ: 'tekst',
            tekst: 'Regeneracja: 2 rany na turę.',
            styl: { czcionka: 'tresc', rozmiar: pt(8) },
          },
          { id: 'g', typ: 'ikona', ikona: 'gwiazdka', rozmiar: 4 },
        ],
      },
    ],
  },
};

const PRZYPADKI: { nazwa: string; wynik: () => ReturnType<typeof renderujKarte> }[] = [
  {
    nazwa: 'Mausritter: broń z obrazkiem i białą obwódką klasy',
    wynik: () =>
      renderujKarte(
        szablonBron,
        { dane: { nazwa: 'Igła', wartosc: 'k6', klasa: 'Lekka', obraz: OBRAZ_ZASTEPCZY } },
        { czcionki, obraz: () => ({ szerokosc: 512, wysokosc: 512 }) },
      ),
  },
  {
    nazwa: 'ustawienia obrazu karty: skala, przesunięcie, obrót i przycięcie',
    wynik: () =>
      renderujKarte(
        szablonBron,
        {
          dane: { nazwa: 'Kij', wartosc: 'k6/k8', klasa: 'Średnia', obraz: LITERA },
          obrazy: { obraz: { skala: 1.7, przesuniecie: { x: 2.5, y: -1 }, obrot: 33 } },
        },
        { czcionki, obraz: () => ({ szerokosc: 640, wysokosc: 480 }) },
      ),
  },
  {
    nazwa: 'karta broni 1×2',
    wynik: () =>
      renderujKarte(
        szablonBroni,
        {
          dane: { nazwa: 'Żelazny kij', obrazenia: 'k6/k8', klasa: 'Ciężka', uzycia: '6' },
          rozmiar: { kolumny: 1, rzedy: 2 },
        },
        { czcionki },
      ),
  },
  {
    nazwa: 'tryb swobodny: kotwice i obroty 90°, 180°, 270°',
    wynik: () =>
      renderujKarte(
        szablonSwobodny,
        { dane: {} },
        { czcionki, obraz: () => ({ szerokosc: 640, wysokosc: 480 }) },
      ),
  },
  {
    nazwa: 'karta z akapitem, kursywą i kolorami',
    wynik: () =>
      renderujKarte(
        szablonOpisu,
        {
          dane: {
            tytul: 'Źródło światła',
            opis: 'Gdy płomień przygasa, mysz musi zdecydować: zawrócić czy iść dalej w głąb, gdzie żaby strzegą skarbu? Effi, fiolka, flaszka.',
          },
        },
        { czcionki },
      ),
  },
];

for (const p of PRZYPADKI) {
  test(`PDF wygląda jak SVG: ${p.nazwa}`, async ({ page }) => {
    await przygotujStrone(page);
    const { scena, ostrzezenia } = p.wynik();
    expect(ostrzezenia).toEqual([]);
    const { bajty } = await scenyDoPdf([scena], {
      obraz: (z) => (PNGI[z] ? { dane: new Uint8Array(PNGI[z]), format: 'png' } : undefined),
    });
    const svg = scenaDoSvg(scena, {
      adresObrazu: (z) =>
        PNGI[z] ? 'data:image/png;base64,' + PNGI[z].toString('base64') : undefined,
    });
    const w = await porownaj(page, svg, bajty);
    test.info().annotations.push({ type: 'porównanie', description: JSON.stringify(w) });
    console.info(p.nazwa, w);
    // Coś narysowano i oba obrazy mają podobną ilość „tuszu”.
    expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.01);
    expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
    // Piksele wyraźnie różne: tylko krawędzie po wygładzaniu.
    expect(w.rozne / w.wszystkie).toBeLessThan(0.001);
  });
}

for (const arkusz of arkuszeMausrittera) {
  test(`PDF wygląda jak SVG: cały arkusz „${arkusz.nazwa}”`, async ({ page }) => {
    await przygotujStrone(page);
    const wynik = zbudujArkusz(
      arkusz,
      talieMausrittera.find((t) => t.id === arkusz.taliaId)!,
      {
        czcionki,
        szablony: new Map(szablonyMausrittera.map((s) => [s.id, s])),
        obraz: (z) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
      },
    );
    expect(wynik.ostrzezenia).toEqual([]);
    // Każda strona arkusza osobno.
    for (const [i, scena] of wynik.strony.entries()) {
      const { bajty } = await scenyDoPdf([scena], {
        obraz: (z) => (PNGI[z] ? { dane: new Uint8Array(PNGI[z]), format: 'png' } : undefined),
      });
      const svg = scenaDoSvg(scena, {
        adresObrazu: (z) =>
          PNGI[z] ? 'data:image/png;base64,' + PNGI[z].toString('base64') : undefined,
      });
      const w = await porownaj(page, svg, bajty);
      console.info(arkusz.nazwa, i + 1, w);
      expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.005);
      expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
      expect(w.rozne / w.wszystkie).toBeLessThan(0.001);
    }
  });
}
