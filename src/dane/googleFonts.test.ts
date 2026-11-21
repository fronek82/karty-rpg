import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tn, ustawJezyk } from '../i18n';
import { pt } from '../model/jednostki';
import { WERSJA_SCHEMATU, type OpisZasobu, type Projekt } from '../model/projekt';
import type { Karta, Rewers, Szablon } from '../model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import { renderujKarte } from '../silnik/karta';
import type { ElementSceny } from '../silnik/scena';
import {
  dodajSzablon,
  eksportujProjekt,
  eksportujSzablon,
  importujProjekt,
  importujSzablon,
} from './archiwum';
import { dodajZasoby, ustawRole } from './edycja';
import {
  KATALOG_GOOGLE_FONTS,
  POLSKIE_ZNAKI,
  adresyPodgladuGoogleFonts,
  adresyWariantuGoogle,
  brakujaceWariantyRodziny,
  czyRodzinaDodana,
  maPolskieZnaki,
  pobierzRodzineGoogle,
  zapasowaRodzinaKategorii,
  type FunkcjaPobierania,
} from './googleFonts';
import { BladDanych } from './schemat';

const ttf = (nazwa: string) => new Uint8Array(readFileSync(resolve('public/czcionki', nazwa)));

const GARAMOND = {
  normalny: ttf('EBGaramond-Regular.ttf'),
  pogrubiony: ttf('EBGaramond-Bold.ttf'),
  kursywa: ttf('EBGaramond-Italic.ttf'),
  'pogrubiona-kursywa': ttf('EBGaramond-BoldItalic.ttf'),
};

function bajtyDlaAdresu(url: string): Uint8Array {
  if (/BoldItalic/i.test(url)) return GARAMOND['pogrubiona-kursywa'];
  if (/Bold/i.test(url)) return GARAMOND.pogrubiony;
  if (/Italic/i.test(url)) return GARAMOND.kursywa;
  return GARAMOND.normalny;
}

function odpowiedzOk(bajty: Uint8Array) {
  const kopia = bajty.slice();
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => kopia.buffer,
  };
}

function odpowiedzBlad(status: number) {
  return {
    ok: false,
    status,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

const projektBazowy = (nazwa: string, szablony: Szablon[] = []): Projekt => ({
  id: `proj-${nazwa.toLowerCase().replace(/\s+/g, '-')}`,
  wersja: WERSJA_SCHEMATU,
  nazwa,
  utworzono: '2026-11-20T12:00:00.000Z',
  zmieniono: '2026-11-20T12:00:00.000Z',
  role: {},
  zasoby: [],
  szablony,
  talie: [],
  arkusze: [],
});

const szablonTestowy = (rodzina: string): Szablon => ({
  id: 'szablon-google-test',
  nazwa: 'Karta testowa',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo: '#ffffff',
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 4,
    odstep: 2,
    dzieci: [
      {
        id: 'tytul',
        typ: 'tekst',
        klucz: 'nazwa',
        styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(12), kolor: '#111111' },
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        styl: { czcionka: rodzina, wariant: 'kursywa', rozmiar: pt(9), kolor: '#222222' },
      },
    ],
  },
});

const kartaTestowa: Karta = {
  id: 'karta-pl',
  szablonId: 'szablon-google-test',
  ilosc: 1,
  dane: {
    nazwa: 'Zażółć gęślą jaźń',
    opis: 'ĄĆĘŁŃÓŚŹŻ · ąćęłńóśźż – próba znaków',
  },
};

describe('katalog Google Fonts (M4-6)', () => {
  it('zawiera spójne, udokumentowane w LICENCJE.md rodziny SIL OFL 1.1 z polskimi znakami', () => {
    expect(KATALOG_GOOGLE_FONTS.length).toBeGreaterThanOrEqual(50);
    const kategorie = new Set(KATALOG_GOOGLE_FONTS.map((p) => p.kategoria));
    expect(kategorie).toEqual(
      new Set(['ozdobna', 'szeryfowa', 'bezszeryfowa', 'pisana', 'maszynowa']),
    );
    const licencje = readFileSync(resolve('LICENCJE.md'), 'utf8');
    const ids = new Set<string>();
    const rodziny = new Set<string>();

    for (const poz of KATALOG_GOOGLE_FONTS) {
      expect(ids.has(poz.id)).toBe(false);
      expect(rodziny.has(poz.rodzina)).toBe(false);
      ids.add(poz.id);
      rodziny.add(poz.rodzina);
      expect(poz.licencja).toBe('SIL OFL 1.1');
      expect(poz.polskieZnaki).toBe(true);
      expect(poz.warianty.length).toBeGreaterThan(0);
      expect(licencje).toContain(poz.rodzina);

      const warianty = new Set(poz.warianty.map((w) => w.wariant));
      expect(warianty.size).toBe(poz.warianty.length);
      expect(warianty.has('normalny')).toBe(true);

      for (const w of poz.warianty) {
        expect(w.plik.endsWith('.ttf')).toBe(true);
        const adresy = adresyWariantuGoogle(poz, w);
        expect(adresy).toHaveLength(2);
        expect(adresy[0]).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/google\/fonts@main\/ofl\//);
        expect(adresy[1]).toMatch(
          /^https:\/\/raw\.githubusercontent\.com\/google\/fonts\/main\/ofl\//,
        );
      }
    }
  });

  it('buduje lekkie adresy podglądu CSS2 ograniczone do unikalnych znaków próbki', () => {
    const adresy = adresyPodgladuGoogleFonts(
      ['Almendra', 'Press Start 2P', 'IBM Plex Mono'],
      'Zażółć Zażółć',
      2,
    );
    expect(adresy).toHaveLength(2);
    expect(adresy[0]).toContain('family=Almendra&family=Press+Start+2P');
    expect(adresy[0]).toContain(`text=${encodeURIComponent('Zażółć ')}`);
    expect(adresy[0]).toContain('display=swap');
    expect(adresy[1]).toContain('family=IBM+Plex+Mono');
    expect(zapasowaRodzinaKategorii('pisana')).toBe('cursive');
    expect(zapasowaRodzinaKategorii('maszynowa')).toBe('monospace');
  });

  it('pobiera wszystkie warianty rodziny ze źródłem „google” i pomija już obecne', async () => {
    const almendra = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'almendra')!;
    const wywolania: string[] = [];
    const pobierz: FunkcjaPobierania = async (url) => {
      wywolania.push(url);
      return odpowiedzOk(bajtyDlaAdresu(url));
    };

    const wgrane = await pobierzRodzineGoogle(almendra, { pobierz });
    expect(wgrane).toHaveLength(4);
    expect(wywolania).toHaveLength(4);
    expect(wgrane.map((w) => w.opis.wariant)).toEqual([
      'normalny',
      'pogrubiony',
      'kursywa',
      'pogrubiona-kursywa',
    ]);
    for (const w of wgrane) {
      expect(w.opis.rodzina).toBe('Almendra');
      expect(w.opis.zrodlo).toBe('google');
      expect(w.dane.byteLength).toBeGreaterThan(0);
    }

    const zasoby: OpisZasobu[] = wgrane.map((w) => w.opis);
    expect(czyRodzinaDodana(almendra, zasoby)).toBe(true);
    expect(brakujaceWariantyRodziny(almendra, zasoby)).toEqual([]);

    // Ponowne wywołanie nie wykonuje żadnych zapytań sieciowych.
    wywolania.length = 0;
    const ponowne = await pobierzRodzineGoogle(almendra, { zasoby, pobierz });
    expect(ponowne).toEqual([]);
    expect(wywolania).toEqual([]);

    // Gdy brakuje części wariantów – dociąga tylko brakujące bez kolizji ID.
    const czesciowe = zasoby.slice(0, 2);
    expect(czyRodzinaDodana(almendra, czesciowe)).toBe(false);
    const brakujace = await pobierzRodzineGoogle(almendra, { zasoby: czesciowe, pobierz });
    expect(brakujace).toHaveLength(2);
    expect(brakujace.map((w) => w.opis.wariant)).toEqual(['kursywa', 'pogrubiona-kursywa']);
    const wszystkieId = new Set([
      ...czesciowe.map((z) => z.id),
      ...brakujace.map((w) => w.opis.id),
    ]);
    expect(wszystkieId.size).toBe(4);
  });

  it('przełącza się na zapasowy adres raw.githubusercontent.com, gdy główny CDN zawiedzie', async () => {
    const medieval = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'medievalsharp')!;
    const odwiedzone: string[] = [];
    const pobierz: FunkcjaPobierania = async (url) => {
      odwiedzone.push(url);
      if (url.includes('cdn.jsdelivr.net')) return odpowiedzBlad(503);
      return odpowiedzOk(GARAMOND.normalny);
    };

    const wgrane = await pobierzRodzineGoogle(medieval, { pobierz });
    expect(wgrane).toHaveLength(1);
    expect(wgrane[0]!.opis.rodzina).toBe('MedievalSharp');
    expect(wgrane[0]!.opis.zrodlo).toBe('google');
    expect(odwiedzone).toHaveLength(2);
    expect(odwiedzone[0]).toContain('cdn.jsdelivr.net');
    expect(odwiedzone[1]).toContain('raw.githubusercontent.com');
  });

  it('zwraca czytelny BladDanych i nie zapisuje częściowych wariantów przy błędzie sieci lub uszkodzonym pliku', async () => {
    const almendra = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'almendra')!;
    let licznik = 0;
    const bladDrugiego: FunkcjaPobierania = async (url) => {
      licznik++;
      if (url.includes('Bold.ttf')) throw new Error('offline');
      return odpowiedzOk(bajtyDlaAdresu(url));
    };

    await expect(pobierzRodzineGoogle(almendra, { pobierz: bladDrugiego })).rejects.toThrow(
      BladDanych,
    );
    await expect(pobierzRodzineGoogle(almendra, { pobierz: bladDrugiego })).rejects.toThrow(
      /Almendra.*offline/,
    );
    expect(licznik).toBeGreaterThan(2);

    const uszkodzony: FunkcjaPobierania = async () =>
      odpowiedzOk(new Uint8Array([0, 1, 2, 3, 4, 5]));
    await expect(pobierzRodzineGoogle(almendra, { pobierz: uszkodzony })).rejects.toThrow(
      BladDanych,
    );
  });

  it('weryfikuje pokrycie polskich znaków i renderuje kartę z lokalnych bajtów bez sieci', async () => {
    const almendra = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'almendra')!;
    const wgrane = await pobierzRodzineGoogle(almendra, {
      pobierz: async (url) => odpowiedzOk(bajtyDlaAdresu(url)),
    });

    for (const w of wgrane) {
      const czcionka = wczytajCzcionke(w.opis.id, w.dane);
      expect(maPolskieZnaki(czcionka)).toBe(true);
      expect(czcionka.brakujaceZnaki(POLSKIE_ZNAKI)).toEqual([]);
    }
    expect(maPolskieZnaki({ brakujaceZnaki: () => ['ą'] })).toBe(false);

    // Zapis do projektu, eksport ZIP i ponowne otwarcie w pełni lokalnie (offline).
    const szablon = szablonTestowy('Almendra');
    let stan = dodajZasoby(
      projektBazowy('Test Google Fonts', [szablon]),
      new Map(),
      wgrane.map((w) => ({ opis: w.opis, dane: w.dane })),
    );
    stan = { ...stan, projekt: ustawRole(stan.projekt, 'tytul', 'Almendra') };

    const zip = eksportujProjekt(stan.projekt, stan.dane);
    const poOtwarciu = importujProjekt(zip);
    expect(poOtwarciu.projekt.zasoby.filter((z) => z.rodzaj === 'czcionka')).toHaveLength(4);
    for (const w of wgrane) {
      expect(poOtwarciu.zasoby.get(w.opis.id)).toEqual(w.dane);
    }

    const rejestr = new RejestrCzcionek();
    for (const z of poOtwarciu.projekt.zasoby) {
      if (z.rodzaj !== 'czcionka') continue;
      const dane = poOtwarciu.zasoby.get(z.id)!;
      rejestr.dodaj(z.rodzina, z.wariant, wczytajCzcionke(z.id, dane));
    }
    rejestr.ustawRole(poOtwarciu.projekt.role);

    const wynik = renderujKarte(szablon, kartaTestowa, { czcionki: rejestr });
    expect(wynik.ostrzezenia.filter((o) => o.komunikat === 'brak-znakow')).toEqual([]);
    const glify = wynik.scena.elementy
      .filter((e): e is Extract<ElementSceny, { typ: 'tekst' }> => e.typ === 'tekst')
      .flatMap((e) => e.glify);
    expect(glify.length).toBeGreaterThan(25);
  });

  it('przenosi krój Google Fonts w paczce szablonu bez ostrzeżenia o własnej licencji (w odróżnieniu od kroju własnego)', async () => {
    const almendra = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'almendra')!;
    const wgrane = await pobierzRodzineGoogle(almendra, {
      pobierz: async (url) => odpowiedzOk(bajtyDlaAdresu(url)),
    });

    const szablon = szablonTestowy('Almendra');
    const projektGoogle = dodajZasoby(
      ustawRole(projektBazowy('Google', [szablon]), 'tytul', 'Almendra'),
      new Map(),
      wgrane.map((w) => ({ opis: w.opis, dane: w.dane })),
    );

    const eksportGoogle = eksportujSzablon(projektGoogle.projekt, projektGoogle.dane, szablon.id);
    expect(eksportGoogle.ostrzezenia).toEqual([]);

    const paczka = importujSzablon(eksportGoogle.bajty);
    expect(paczka.zasoby.filter((z) => z.rodzaj === 'czcionka')).toHaveLength(4);
    expect(paczka.zasoby.every((z) => z.rodzaj === 'czcionka' && z.zrodlo === 'google')).toBe(true);

    const docelowy = projektBazowy('Docelowy');
    const poDodaniu = dodajSzablon(docelowy, new Map(), paczka);
    expect(poDodaniu.projekt.zasoby.filter((z) => z.rodzaj === 'czcionka')).toHaveLength(4);
    expect(poDodaniu.zasoby.size).toBe(4);

    // Dla kontrastu: identyczny krój oznaczony jako `wlasna` musi zgłosić ostrzeżenie licencyjne.
    const projektWlasny = dodajZasoby(
      ustawRole(projektBazowy('Wlasna', [szablon]), 'tytul', 'Almendra'),
      new Map(),
      wgrane.map((w) => ({ opis: { ...w.opis, zrodlo: 'wlasna' as const }, dane: w.dane })),
    );
    const eksportWlasny = eksportujSzablon(projektWlasny.projekt, projektWlasny.dane, szablon.id);
    expect(eksportWlasny.ostrzezenia.some((o) => /Almendra/.test(o))).toBe(true);
  });

  it('przełącza się na zapasowy adres także gdy główny CDN zwróci HTTP 200 z uszkodzonym ciałem lub przekroczy limit czasu', async () => {
    const medieval = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'medievalsharp')!;
    const adresyUszkodzone: string[] = [];
    const wgranePoUszkodzonym = await pobierzRodzineGoogle(medieval, {
      pobierz: async (url) => {
        adresyUszkodzone.push(url);
        if (url.includes('cdn.jsdelivr.net')) {
          return odpowiedzOk(new TextEncoder().encode('<html>error</html>'));
        }
        return odpowiedzOk(GARAMOND.normalny);
      },
    });
    expect(wgranePoUszkodzonym).toHaveLength(1);
    expect(adresyUszkodzone).toHaveLength(2);
    expect(adresyUszkodzone[1]).toContain('raw.githubusercontent.com');

    const adresyTimeout: string[] = [];
    const wgranePoTimeout = await pobierzRodzineGoogle(medieval, {
      limitCzasuMs: 15,
      pobierz: async (url, init) => {
        adresyTimeout.push(url);
        if (url.includes('cdn.jsdelivr.net')) {
          return await new Promise((_, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), {
              once: true,
            });
          });
        }
        return odpowiedzOk(GARAMOND.normalny);
      },
    });
    expect(wgranePoTimeout).toHaveLength(1);
    expect(adresyTimeout).toHaveLength(2);
    expect(adresyTimeout[1]).toContain('raw.githubusercontent.com');
  });

  it('przerywa pobieranie kolejnych wariantów po sygnale AbortSignal bez przełączania na fallback', async () => {
    const almendra = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'almendra')!;
    const kontroler = new AbortController();
    let wywolania = 0;

    await expect(
      pobierzRodzineGoogle(almendra, {
        signal: kontroler.signal,
        pobierz: async (url) => {
          wywolania++;
          if (wywolania === 1) kontroler.abort();
          return odpowiedzOk(bajtyDlaAdresu(url));
        },
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(wywolania).toBe(1);
  });

  it('poprawnie odmienia komunikat pobrania dla rodziny jednowariantowej w PL i EN', () => {
    ustawJezyk('pl');
    expect(tn('googleFonts.pobrano', 1, { rodzina: 'MedievalSharp' })).toBe(
      'Pobrano krój „MedievalSharp” (1 wariant) i zapisano lokalnie w projekcie.',
    );
    ustawJezyk('en');
    expect(tn('googleFonts.pobrano', 1, { rodzina: 'MedievalSharp' })).toBe(
      'Downloaded “MedievalSharp” (1 variant) and saved locally in the project.',
    );
    ustawJezyk('pl');
  });

  it('pakuje krój Google Fonts użyty wyłącznie na rewersie szablonu bez ostrzeżenia licencyjnego', async () => {
    const medieval = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'medievalsharp')!;
    const wgrane = await pobierzRodzineGoogle(medieval, {
      pobierz: async () => odpowiedzOk(GARAMOND.normalny),
    });

    const rewers: Rewers = {
      id: 'rev-google',
      nazwa: 'Rewers z Google Fonts',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#1f2937',
      korzen: {
        id: 'rk',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'napis',
            typ: 'tekst',
            tekst: 'Żółty Gryf',
            pozycja: { x: 8, y: 36 },
            szerokosc: { mm: 47 },
            styl: { czcionka: 'MedievalSharp', rozmiar: pt(12), kolor: '#f8fafc' },
          },
        ],
      },
    };
    const szablon: Szablon = {
      id: 'szablon-z-rewersem-google',
      nazwa: 'Karta z rewersem',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#ffffff',
      rewersId: rewers.id,
      korzen: { id: 'k', typ: 'kolumna', dzieci: [] },
    };
    const stan = dodajZasoby(
      { ...projektBazowy('RewersGoogle', [szablon]), rewersy: [rewers] },
      new Map(),
      wgrane.map((w) => ({ opis: w.opis, dane: w.dane })),
    );

    const eksport = eksportujSzablon(stan.projekt, stan.dane, szablon.id);
    expect(eksport.ostrzezenia).toEqual([]);
    const paczka = importujSzablon(eksport.bajty);
    expect(paczka.rewers?.id).toBe(rewers.id);
    expect(paczka.zasoby).toHaveLength(1);
    expect(paczka.zasoby[0]).toMatchObject({
      rodzaj: 'czcionka',
      rodzina: 'MedievalSharp',
      zrodlo: 'google',
    });
  });

  it('katalog zawiera co najmniej 120 zweryfikowanych rodzin i pobierzDowolnaRodzineGoogle pobiera dowolny krój po nazwie', async () => {
    expect(KATALOG_GOOGLE_FONTS.length).toBeGreaterThanOrEqual(120);
    const { pobierzDowolnaRodzineGoogle } = await import('./googleFonts');
    const wynik = await pobierzDowolnaRodzineGoogle('Cinzel', {
      pobierz: async (url) => {
        if (url.endsWith('/ofl/cinzel')) {
          return {
            ok: true,
            status: 200,
            arrayBuffer: async () => new ArrayBuffer(0),
            json: async () => [
              { name: 'Cinzel-Regular.ttf', type: 'file' },
              { name: 'Cinzel-Bold.ttf', type: 'file' },
            ],
          };
        }
        const buf = bajtyDlaAdresu(url);
        return {
          ...odpowiedzOk(buf),
          json: async () => ({}),
        };
      },
    });
    expect(wynik.wgrane).toHaveLength(2);
    expect(wynik.wgrane.every((w) => w.opis.zrodlo === 'google')).toBe(true);
    expect(wynik.brakPolskichZnakow).toBe(false);

    await expect(
      pobierzDowolnaRodzineGoogle('NieistniejacaCzcionkaXYZ', {
        pobierz: async () => ({
          ...odpowiedzBlad(404),
          json: async () => ({}),
        }),
      }),
    ).rejects.toBeInstanceOf(BladDanych);
  });
});
