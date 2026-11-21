import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import { renderujKarte } from '../silnik/karta';
import type { Scena } from '../silnik/scena';
import { scenaDoSvg } from '../silnik/svg';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { zbudujPdf } from './budowaPdf';
import { scenyDoPdf } from './pdf';

const czcionki = rejestrTestowy();

async function wyciagnijTekstZPdf(bajty: Uint8Array): Promise<string[]> {
  // Kopia bufora – pdf.js może odłączyć przekazany ArrayBuffer.
  const kopia = new Uint8Array(bajty);
  const zadanie = getDocument({ data: kopia, verbosity: 0 });
  const dok = await zadanie.promise;
  const strony: string[] = [];
  for (let nr = 1; nr <= dok.numPages; nr++) {
    const strona = await dok.getPage(nr);
    const tresc = await strona.getTextContent();
    const tekst = tresc.items
      .map((i) => ('str' in i ? i.str : ''))
      .filter(Boolean)
      .join(' ');
    strony.push(tekst);
  }
  await zadanie.destroy();
  return strony;
}

const szablonPolski: Szablon = {
  id: 'pl-tekst',
  nazwa: 'Polska karta',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo: '#fbf6ea',
  korzen: {
    id: 'k',
    typ: 'swobodny',
    dzieci: [
      {
        id: 'tytul',
        typ: 'tekst',
        klucz: 'tytul',
        pozycja: { x: 4, y: 4 },
        szerokosc: { mm: 55 },
        wysokosc: { mm: 12 },
        styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(12), wyrownanie: 'srodek' },
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        ikonyWTekscie: true,
        etykieta: {
          tekst: 'Efekt:',
          pozycja: 'przed',
          styl: { kolor: '#7a2e1f', wariant: 'pogrubiony' },
        },
        pozycja: { x: 4, y: 18 },
        szerokosc: { mm: 55 },
        wysokosc: { mm: 30 },
        styl: { czcionka: 'tresc', rozmiar: pt(8.5), kolor: '#111111' },
      },
      {
        id: 'luk',
        typ: 'tekst',
        tekst: 'PIECZĘĆ ŁĄKOWA',
        pozycja: { x: 4, y: 50 },
        szerokosc: { mm: 55 },
        wysokosc: { mm: 16 },
        styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(9), wyrownanie: 'srodek' },
        luk: { promien: 32, kierunek: 'gora' },
      },
      {
        id: 'przezroczysty',
        typ: 'tekst',
        tekst: 'Źdźbło mgły',
        krycie: 0.7,
        pozycja: { x: 4, y: 70, obrot: 90 },
        szerokosc: { mm: 24 },
        wysokosc: { mm: 8 },
        styl: { czcionka: 'tresc', rozmiar: pt(8) },
      },
    ],
  },
};

describe('opcjonalna niewidoczna warstwa tekstowa w PDF (3 Tr, M5-4)', () => {
  it('ekstrahuje polskie znaki, tekst po łuku, ikony śródtekstowe (bez podwójnych spacji), wielokolorowe pole bez duplikacji i grupę przezroczystości', async () => {
    const { scena } = renderujKarte(
      szablonPolski,
      {
        dane: {
          tytul: 'Zażółć gęślą jaźń',
          opis: 'ĄĆĘŁŃÓŚŹŻ :star: ąćęłńóśźż',
        },
      },
      { czcionki },
    );

    // SVG pozostaje oparte wyłącznie na konturach (bez <text>).
    expect(scenaDoSvg(scena)).not.toContain('<text');

    // Domyślnie (bez opcji) warstwa tekstowa jest wyłączona.
    const bez = await scenyDoPdf([scena]);
    expect(await wyciagnijTekstZPdf(bez.bajty)).toEqual(['']);

    // Z opcją warstwaTekstowa: pdfjs-dist odczytuje wszystkie polskie napisy dokładnie raz.
    const z = await scenyDoPdf([scena], { warstwaTekstowa: true });
    const [strona] = await wyciagnijTekstZPdf(z.bajty);
    expect(strona).toContain('Zażółć gęślą jaźń');
    // Wielokolorowe pole (etykieta + treść) bez duplikacji i bez podwójnej spacji po usunięciu :star:.
    expect(strona).toContain('Efekt: ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż');
    expect(strona!.match(/Efekt:/g)?.length).toBe(1);
    expect(strona).not.toContain('  ');
    expect(strona).toContain('PIECZĘĆ ŁĄKOWA');
    expect(strona).toContain('Źdźbło mgły');

    // Determinizm i niewielki narzut rozmiaru (< 6 KB).
    const z2 = await scenyDoPdf([scena], { warstwaTekstowa: true });
    expect(z.bajty).toEqual(z2.bajty);
    expect(z.bajty.length - bez.bajty.length).toBeLessThan(6000);
  });

  it('zapisuje CIDSystemInfo jako PDFString (ISO 32000-1) i współdzieli czcionkę Type0 między stronami', async () => {
    const s1 = renderujKarte(
      szablonPolski,
      { dane: { tytul: 'Strona pierwsza', opis: 'Łódź' } },
      { czcionki },
    ).scena;
    const s2 = renderujKarte(
      szablonPolski,
      { dane: { tytul: 'Strona druga', opis: 'Żubr' } },
      { czcionki },
    ).scena;
    const { bajty } = await scenyDoPdf([s1, s2], { warstwaTekstowa: true });

    const strony = await wyciagnijTekstZPdf(bajty);
    expect(strony[0]).toContain('Strona pierwsza');
    expect(strony[1]).toContain('Strona druga');

    const dok = await PDFDocument.load(bajty);
    const font0 = dok
      .getPage(0)
      .node.Resources()
      ?.lookup(PDFName.of('Font'), PDFDict)
      ?.get(PDFName.of('FTxt'));
    const font1 = dok
      .getPage(1)
      .node.Resources()
      ?.lookup(PDFName.of('Font'), PDFDict)
      ?.get(PDFName.of('FTxt'));
    expect(font0).toBeDefined();
    expect(font0).toEqual(font1);

    // Weryfikacja CIDSystemInfo: Registry i Ordering muszą być PDFString, nie PDFName.
    const type0 = dok.context.lookup(font0!, PDFDict);
    const potomki = type0.lookup(PDFName.of('DescendantFonts'), PDFArray);
    const cidDict = dok.context.lookup(potomki.get(0), PDFDict);
    const sysInfo = cidDict.lookup(PDFName.of('CIDSystemInfo'), PDFDict);
    expect(sysInfo.get(PDFName.of('Registry'))).toBeInstanceOf(PDFString);
    expect(sysInfo.get(PDFName.of('Ordering'))).toBeInstanceOf(PDFString);
    expect((sysInfo.get(PDFName.of('Registry')) as PDFString).decodeText()).toBe('Adobe');
    expect((sysInfo.get(PDFName.of('Ordering')) as PDFString).decodeText()).toBe('Identity');
  });

  it('nie dodaje pustego słownika /Font ani nieprzypisanej referencji dla sceny bez tekstu (np. same ikony)', async () => {
    const szablonIkony: Szablon = {
      id: 'same-ikony',
      nazwa: 'Same ikony',
      rozmiar: { tryb: 'mm', szerokosc: 40, wysokosc: 40 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 't',
            typ: 'tekst',
            tekst: ':star: :star:',
            ikonyWTekscie: true,
            styl: { czcionka: 'tresc', rozmiar: pt(10) },
          },
        ],
      },
    };
    const { scena } = renderujKarte(szablonIkony, { dane: {} }, { czcionki });
    const { bajty } = await scenyDoPdf([scena], { warstwaTekstowa: true });
    expect(await wyciagnijTekstZPdf(bajty)).toEqual(['']);
    const dok = await PDFDocument.load(bajty);
    const fonty = dok.getPage(0).node.Resources()?.lookupMaybe(PDFName.of('Font'), PDFDict);
    expect(fonty?.get(PDFName.of('FTxt'))).toBeUndefined();
    expect(fonty?.entries().length ?? 0).toBe(0);
  });

  it('poprawnie dzieli CMap ToUnicode powyżej 100 unikalnych znaków i obsługuje znaki spoza BMP', async () => {
    const dlugiAlfabet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
      'ĄĆĘŁŃÓŚŹŻąćęłńóśźżÄÖÜäöüßÉÈÊéèêČŘŠŽčřšž!@#$%^&*()_+-=[]{}|;:,.<>?/~`★🎲';
    const scena: Scena = {
      szer: 100,
      wys: 50,
      glify: {},
      elementy: [
        {
          typ: 'tekst',
          kolor: '#000000',
          glify: [],
          wierszeTekst: [{ tekst: dlugiAlfabet, x: 5, y: 20, szer: 90, rozmiar: 3.5 }],
        },
      ],
    };

    const { bajty } = await scenyDoPdf([scena], { warstwaTekstowa: true });
    const [odczytany] = await wyciagnijTekstZPdf(bajty);
    expect(odczytany).toBe(dlugiAlfabet);
  });

  it('przekazuje warstwaTekstowa przez zbudujPdf także w trybie czarno-białym i wydruku testowym', async () => {
    const daneCzcionki = new Uint8Array(
      readFileSync(resolve('public/czcionki/EBGaramond-Regular.ttf')),
    );
    const bazoweZadanie = {
      tytul: 'Test',
      arkusze: [
        {
          id: 'a1',
          nazwa: 'Arkusz',
          taliaId: 't1',
          ustawienia: {
            papier: 'A4' as const,
            orientacja: 'pionowa' as const,
            marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
            linie: { grubosc: 0.2, kolor: '#000000', kreska: 2, przerwa: 1.5 },
            czarnoBialy: true,
          },
        },
      ],
      talie: [
        {
          id: 't1',
          nazwa: 'Talia',
          karty: [
            {
              id: 'k1',
              szablonId: 'pl-tekst',
              ilosc: 1,
              dane: { tytul: 'Bursztynowy klucz', opis: 'Otwiera każde drzwi.' },
            },
          ],
        },
      ],
      szablony: [szablonPolski],
      czcionki: [
        { id: 'eb', rodzina: 'EB Garamond', wariant: 'normalny' as const, dane: daneCzcionki },
      ],
      role: { tresc: 'EB Garamond', tytul: 'EB Garamond' },
      zapasowa: 'EB Garamond',
      obrazy: [],
      warstwaTekstowa: true,
    };

    const pdfSzary = await zbudujPdf(bazoweZadanie);
    const [stronaSzara] = await wyciagnijTekstZPdf(pdfSzary);
    expect(stronaSzara).toContain('Bursztynowy klucz');

    const pdfTestowy = await zbudujPdf({ ...bazoweZadanie, testowy: 'a1' });
    const [stronaTestowa] = await wyciagnijTekstZPdf(pdfTestowy);
    expect(stronaTestowa).toContain('1');
  });
});
