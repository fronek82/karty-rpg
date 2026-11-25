import { expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { LIMIT_TABELI, odczytajCsv, otworzTabele, sprawdzImport, szablonCsv } from './importTabeli';
import type { KolumnaDanych } from './edycja';
import type { OpisObrazu } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { pt } from '../model/jednostki';

const pola: KolumnaDanych[] = [
  { klucz: 'nazwa', nazwa: 'Nazwa', rodzaj: 'pole', typPola: 'tekst' },
  { klucz: 'obraz', nazwa: 'Ilustracja', rodzaj: 'pole', typPola: 'obraz' },
];
const zasob: OpisObrazu = {
  id: 'obraz-mapa',
  rodzaj: 'obraz',
  format: 'png',
  nazwa: 'mapa.png',
  szerokosc: 100,
  wysokosc: 100,
};

it('CSV zachowuje zera wiodące, cudzysłowy, separatory i nowe linie oraz numer wiersza', async () => {
  const plik = new File(
    ['\ufeff\r\nNazwa;Opis;Ilość\r\n007;"Śnieg; i ""wiatr""\r\nDrugi wiersz";2\r\n;;\r\n008;;'],
    'karty.csv',
  );
  const w = (await otworzTabele(plik)).odczytaj(0);
  expect(w.naglowki).toEqual(['Nazwa', 'Opis', 'Ilość']);
  expect(w.wiersze).toEqual([
    { numer: 3, komorki: ['007', 'Śnieg; i "wiatr"\nDrugi wiersz', '2'] },
    { numer: 6, komorki: ['008', '', ''] },
  ]);
  expect(odczytajCsv('Nazwa,Opis\nLas,"A;B"').wiersze[0]?.komorki).toEqual(['Las', 'A;B']);
  expect(() => odczytajCsv('Nazwa,Opis\nLas,"zły')).toThrow(/wiersz 2/);
  expect(() =>
    odczytajCsv(Array.from({ length: LIMIT_TABELI.kolumny + 1 }, () => 'K').join(',')),
  ).toThrow(/przekracza/);
  await expect(otworzTabele(new File([Uint8Array.of(0xff)], 'karty.csv'))).rejects.toThrow(/UTF-8/);
});

it('XLSX wybiera kartę skoroszytu, pomija puste wiersze, czyta zapisaną wartość formuły i wykazuje błędy', async () => {
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([['Nieużywana']]), 'Nieużywana');
  const s = utils.aoa_to_sheet([['Nazwa', 'Ilość']]);
  s.A3 = { t: 's', v: '007' };
  s.B3 = { t: 'n', f: '40+2', v: 3 };
  s.A1000 = { t: 'e', v: 7 };
  s.B4 = { t: 'n', v: 1.5, z: '0' };
  s.A6 = { t: 'n', f: '2+2' };
  s['!ref'] = 'A1:B1000';
  utils.book_append_sheet(workbook, s, 'Dane');
  const bajty: ArrayBuffer = write(workbook, { type: 'array', bookType: 'xlsx' });
  const plik = await otworzTabele(new File([bajty], 'karty.xlsx'));
  expect(plik.arkusze).toEqual(['Nieużywana', 'Dane']);
  const tabela = plik.odczytaj(1);
  expect(tabela.wiersze[0]).toMatchObject({ numer: 3, komorki: ['007', '3'] });
  expect(tabela.wiersze.find((w) => w.numer === 1000)).toMatchObject({ bledy: new Set([0]) });
  expect(tabela.wiersze.find((w) => w.numer === 4)).toMatchObject({ liczby: new Map([[1, 1.5]]) });
  const w = sprawdzImport(tabela, { pola: new Map([['nazwa', 0]]), ilosc: 1 }, pola, []);
  expect(w.bledy).toEqual([
    expect.stringMatching(/Wiersz 4/),
    expect.stringMatching(/Wiersz 6/),
    expect.stringMatching(/Wiersz 1000/),
  ]);
  await expect(otworzTabele(new File(['nie plik xlsx'], 'karty.xlsx'))).rejects.toThrow(
    /niepoprawny/,
  );
});

it('mapowanie akceptuje puste komórki i tylko jednoznaczne nazwy lokalnych obrazów', () => {
  const mapa = {
    pola: new Map([
      ['nazwa', 0],
      ['obraz', 1],
    ]),
    ilosc: 2,
  };
  const tabla = odczytajCsv('Nazwa,Ilustracja,Ilość\nA,mapa.png,3\nB,,');
  expect(sprawdzImport(tabla, mapa, pola, [zasob])).toEqual({
    wiersze: [
      { dane: { nazwa: 'A', obraz: zasob.id }, ilosc: 3 },
      { dane: { nazwa: 'B' }, ilosc: 1 },
    ],
    bledy: [],
    sztuki: 4,
  });
  const wadliwa = odczytajCsv('Nazwa,Ilustracja,Ilość\nA,mapa.png,0\nB,nieznany,1.5');
  expect(sprawdzImport(wadliwa, mapa, pola, [zasob, { ...zasob, id: 'drugi' }]).bledy).toEqual([
    expect.stringMatching(/Wiersz 2.*liczbą całkowitą/),
    expect.stringMatching(/Wiersz 2.*kilka lokalnych obrazów/),
    expect.stringMatching(/Wiersz 3.*liczbą całkowitą/),
    expect.stringMatching(/Wiersz 3.*brak lokalnego obrazu/),
  ]);
});

it('szablonCsv generuje plik UTF-8 z nagłówkami pól szablonu oraz kolumną Ilość i przechodzi przez odczytajCsv', () => {
  const szablon: Szablon = {
    id: 'sz-csv',
    nazwa: 'Zaklęcie',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    korzen: {
      id: 'k',
      typ: 'kolumna',
      dzieci: [
        {
          id: 'p1',
          typ: 'tekst',
          klucz: 'tytul',
          nazwa: 'Tytuł',
          styl: { czcionka: 'tytul', rozmiar: pt(12), kolor: '#000000' },
        },
        {
          id: 'p2',
          typ: 'tekst',
          klucz: 'opis',
          nazwa: 'Opis; efekt',
          styl: { czcionka: 'tresc', rozmiar: pt(9), kolor: '#000000' },
        },
      ],
    },
  };
  const csv = szablonCsv(szablon, { separator: ';', etykietaIlosci: 'Ilość' });
  expect(csv.startsWith('\uFEFF')).toBe(true);
  const wczytane = odczytajCsv(`${csv}Ognista kula;Zadaje 3k6 obrażeń;2\r\n`);
  expect(wczytane.naglowki).toEqual(['Tytuł', 'Opis; efekt', 'Ilość']);
  expect(wczytane.wiersze[0]?.komorki).toEqual(['Ognista kula', 'Zadaje 3k6 obrażeń', '2']);
});

it('opcja „tekst z PDF” łączy złamane wiersze tylko w polach tekstowych', () => {
  const tabela = odczytajCsv(
    'Nazwa;Ilustracja\n"Ten czar powoduje, że\nprzeciwnik upada na zie-\nmię.";',
  );
  const mapa = { pola: new Map([['nazwa', 0]]) };
  expect(sprawdzImport(tabela, mapa, pola, []).wiersze[0]?.dane.nazwa).toBe(
    'Ten czar powoduje, że\nprzeciwnik upada na zie-\nmię.',
  );
  expect(sprawdzImport(tabela, mapa, pola, [], { tekstZPdf: true }).wiersze[0]?.dane.nazwa).toBe(
    'Ten czar powoduje, że przeciwnik upada na ziemię.',
  );
  // Przełącznik odmian, parametr i liczba – bez zmian.
  const inne: KolumnaDanych[] = [
    { klucz: 'odm', nazwa: 'Odmiana', rodzaj: 'pole', opcje: [] },
    { klucz: 'par', nazwa: 'Parametr', rodzaj: 'parametr' },
    { klucz: 'wart', nazwa: 'Wartość', rodzaj: 'pole', typPola: 'wartosc' },
  ];
  const surowa = 'a-\nb\u00AD';
  const t2 = {
    naglowki: ['A', 'B', 'C'],
    wiersze: [{ numer: 2, komorki: [surowa, surowa, surowa] }],
  };
  const m2 = { pola: new Map(inne.map((p, i) => [p.klucz, i])) };
  expect(sprawdzImport(t2, m2, inne, [], { tekstZPdf: true }).wiersze[0]?.dane).toEqual({
    odm: surowa,
    par: surowa,
    wart: surowa,
  });
});
