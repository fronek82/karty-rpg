import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wymiaryKarty } from '../model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import { renderujKarte, renderujRewers } from '../silnik/karta';
import { importujSzablon, LIMITY_ARCHIWUM } from './archiwum';
import {
  adresPlikuGalerii,
  filtrujGalerie,
  parsujManifestGalerii,
  pobierzManifestGalerii,
  pobierzSzablonZUrl,
  walidujUrlSzablonu,
  type FunkcjaPobieraniaGalerii,
} from './galeriaOnline';
import { BladDanych, przygotujProjekt } from './schemat';
import { danePodgladu } from './szablon';
import { nowyProjektWlasny } from './wlasneKarty';

const KATALOG_GALERII = resolve('public/galeria');
const KATALOG_CZCIONEK = resolve('public/czcionki');

const wczytajCzcionkeZPliku = async (plik: string) =>
  new Uint8Array(readFileSync(resolve(KATALOG_CZCIONEK, plik)));

function rejestrTestowyGalerii(): RejestrCzcionek {
  const r = new RejestrCzcionek();
  for (const [wariant, plik] of [
    ['normalny', 'EBGaramond-Regular.ttf'],
    ['pogrubiony', 'EBGaramond-Bold.ttf'],
    ['kursywa', 'EBGaramond-Italic.ttf'],
    ['pogrubiona-kursywa', 'EBGaramond-BoldItalic.ttf'],
  ] as const) {
    r.dodaj(
      'EB Garamond',
      wariant,
      wczytajCzcionke(plik, new Uint8Array(readFileSync(resolve(KATALOG_CZCIONEK, plik)))),
    );
  }
  r.przypiszRole('tresc', 'EB Garamond');
  r.przypiszRole('tytul', 'EB Garamond');
  r.ustawZapasowa('EB Garamond');
  return r;
}

describe('kuratorowana galeria szablonów online i import z URL (M5-3)', () => {
  it('statyczny manifest i wszystkie paczki w public/galeria/ przechodzą walidację schematu oraz renderują awers i rewers bez ostrzeżeń', async () => {
    const manifestJson = JSON.parse(
      readFileSync(resolve(KATALOG_GALERII, 'manifest.json'), 'utf8'),
    );
    const manifest = parsujManifestGalerii(manifestJson);
    expect(manifest.szablony.length).toBeGreaterThanOrEqual(5);

    const czcionki = rejestrTestowyGalerii();

    for (const wpis of manifest.szablony) {
      const bajty = new Uint8Array(readFileSync(resolve(KATALOG_GALERII, wpis.plik)));
      const paczka = importujSzablon(bajty);
      expect(Boolean(paczka.rewers), `zgodność maRewers dla ${wpis.id}`).toBe(wpis.maRewers);
      const wym = wymiaryKarty(paczka.szablon);
      expect(wym.szer, `szerokość ${wpis.id}`).toBe(wpis.format.szerokosc);
      expect(wym.wys, `wysokość ${wpis.id}`).toBe(wpis.format.wysokosc);

      const { projekt } = await nowyProjektWlasny(paczka, wczytajCzcionkeZPliku);
      expect(() => przygotujProjekt(projekt), `schemat projektu dla ${wpis.id}`).not.toThrow();

      // Renderowanie awersu i ewentualnego rewersu w silniku bez ostrzeżeń i z glifami tekstu.
      const ctx = {
        czcionki,
        ...(paczka.biblioteka ? { elementy: paczka.biblioteka } : {}),
      };
      const awers = renderujKarte(paczka.szablon, { dane: danePodgladu(paczka.szablon) }, ctx);
      expect(awers.ostrzezenia, `ostrzeżenia awersu ${wpis.id}`).toEqual([]);
      expect(Object.keys(awers.scena.glify).length, `glify awersu ${wpis.id}`).toBeGreaterThan(0);

      if (paczka.rewers) {
        const rewers = renderujRewers(paczka.rewers, ctx);
        expect(rewers.ostrzezenia, `ostrzeżenia rewersu ${wpis.id}`).toEqual([]);
        expect(Object.keys(rewers.scena.glify).length, `glify rewersu ${wpis.id}`).toBeGreaterThan(
          0,
        );
      }
    }
  });

  it('odrzuca niepoprawny manifest (duplikaty id, path traversal, zakodowane znaki, podkatalogi, nieznana kategoria)', () => {
    const manifest = parsujManifestGalerii(
      JSON.parse(readFileSync(resolve(KATALOG_GALERII, 'manifest.json'), 'utf8')),
    );
    const wzor = manifest.szablony[0]!;

    expect(() => parsujManifestGalerii({ wersja: 1, szablony: [] })).toThrow(BladDanych);
    expect(() => parsujManifestGalerii({ wersja: 1, szablony: [wzor, wzor] })).toThrow(BladDanych);
    for (const zlyPlik of [
      '../tajny.kartyrpg-szablon',
      'a/b.kartyrpg-szablon',
      '%2e%2e.kartyrpg-szablon',
      'plik.kartyrpg-szablon?x=1',
      'h2:test.zip',
    ]) {
      expect(
        () =>
          parsujManifestGalerii({
            wersja: 1,
            szablony: [{ ...wzor, plik: zlyPlik }],
          }),
        zlyPlik,
      ).toThrow(BladDanych);
    }
    expect(() =>
      parsujManifestGalerii({
        wersja: 1,
        szablony: [{ ...wzor, kategoria: 'nieznana' }],
      }),
    ).toThrow(BladDanych);
  });

  it('waliduje adres URL szablonu (tylko http/https) i buduje adresy plików galerii', () => {
    expect(walidujUrlSzablonu('  https://example.com/a.kartyrpg-szablon  ')).toBe(
      'https://example.com/a.kartyrpg-szablon',
    );
    expect(walidujUrlSzablonu('http://localhost:4173/test.zip')).toBe(
      'http://localhost:4173/test.zip',
    );
    expect(() => walidujUrlSzablonu('')).toThrow(BladDanych);
    expect(() => walidujUrlSzablonu('javascript:alert(1)')).toThrow(BladDanych);
    expect(() => walidujUrlSzablonu('data:application/zip;base64,AA==')).toThrow(BladDanych);
    expect(() => walidujUrlSzablonu('file:///etc/passwd')).toThrow(BladDanych);
    expect(adresPlikuGalerii('/karty-rpg/', 'manifest.json')).toBe(
      '/karty-rpg/galeria/manifest.json',
    );
    expect(adresPlikuGalerii('/karty-rpg', 'a.kartyrpg-szablon')).toBe(
      '/karty-rpg/galeria/a.kartyrpg-szablon',
    );
  });

  it('pobiera manifest i paczkę z zapisanych odpowiedzi oraz obsługuje błędy (HTTP, limit rozmiaru i strumień, uszkodzony ZIP, timeout, AbortSignal)', async () => {
    const manifestTekst = readFileSync(resolve(KATALOG_GALERII, 'manifest.json'), 'utf8');
    const paczkaBajty = readFileSync(
      resolve(KATALOG_GALERII, 'przedmiot-z-rewersem.kartyrpg-szablon'),
    );

    const okManifest: FunkcjaPobieraniaGalerii = async () => ({
      ok: true,
      status: 200,
      text: async () => manifestTekst,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const manifest = await pobierzManifestGalerii({ bazaUrl: '/app/', pobierz: okManifest });
    expect(manifest.szablony.length).toBeGreaterThanOrEqual(5);

    const okPaczka: FunkcjaPobieraniaGalerii = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      arrayBuffer: async () =>
        paczkaBajty.buffer.slice(
          paczkaBajty.byteOffset,
          paczkaBajty.byteOffset + paczkaBajty.byteLength,
        ),
    });
    const wynik = await pobierzSzablonZUrl('https://example.com/test.kartyrpg-szablon', {
      wymagajHttp: true,
      pobierz: okPaczka,
    });
    expect(wynik.paczka.szablon.id).toBe('gal-przedmiot');
    expect(wynik.paczka.rewers?.id).toBe('gal-rewers-przedmiot');

    // HTTP 404
    const blad404: FunkcjaPobieraniaGalerii = async () => ({
      ok: false,
      status: 404,
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(
      pobierzSzablonZUrl('https://example.com/brak.kartyrpg-szablon', {
        wymagajHttp: true,
        pobierz: blad404,
      }),
    ).rejects.toThrow(/404/);

    // Przekroczenie limitu rozmiaru w Content-Length
    const zaDuzy: FunkcjaPobieraniaGalerii = async () => ({
      ok: true,
      status: 200,
      headers: {
        get: (n) =>
          n.toLowerCase() === 'content-length' ? String(LIMITY_ARCHIWUM.suma + 1) : null,
      },
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(
      pobierzSzablonZUrl('https://example.com/wielki.kartyrpg-szablon', {
        wymagajHttp: true,
        pobierz: zaDuzy,
      }),
    ).rejects.toThrow(BladDanych);

    // Przekroczenie limitu manifestu strumieniowo (bez Content-Length)
    const strumienManifestu: FunkcjaPobieraniaGalerii = async () => ({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(ctrl) {
          ctrl.enqueue(new Uint8Array(600_000));
          ctrl.enqueue(new Uint8Array(600_000));
          ctrl.close();
        },
      }),
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    await expect(pobierzManifestGalerii({ pobierz: strumienManifestu })).rejects.toThrow(
      BladDanych,
    );

    // Uszkodzony plik (nie-ZIP)
    const uszkodzony: FunkcjaPobieraniaGalerii = async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    });
    await expect(
      pobierzSzablonZUrl('https://example.com/zly.kartyrpg-szablon', {
        wymagajHttp: true,
        pobierz: uszkodzony,
      }),
    ).rejects.toThrow(BladDanych);

    // Timeout
    const zawieszony: FunkcjaPobieraniaGalerii = async (_url, init) =>
      await new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
      });
    await expect(pobierzManifestGalerii({ limitCzasuMs: 15, pobierz: zawieszony })).rejects.toThrow(
      BladDanych,
    );

    // Anulowanie przez AbortSignal
    const kontroler = new AbortController();
    kontroler.abort();
    await expect(
      pobierzManifestGalerii({ signal: kontroler.signal, pobierz: okManifest }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('filtruje wpisy galerii po frazie (PL i EN), kategorii oraz obecności rewersu', () => {
    const manifest = parsujManifestGalerii(
      JSON.parse(readFileSync(resolve(KATALOG_GALERII, 'manifest.json'), 'utf8')),
    );
    expect(filtrujGalerie(manifest.szablony, { zapytanie: 'tarot' }).map((w) => w.id)).toEqual([
      'postac-tarot',
    ]);
    expect(filtrujGalerie(manifest.szablony, { zapytanie: 'landscape' }).map((w) => w.id)).toEqual([
      'zdarzenie-poziome',
    ]);
    expect(filtrujGalerie(manifest.szablony, { kategoria: 'zasoby' }).map((w) => w.id)).toEqual([
      'zasob-mini',
    ]);
    const zRewersem = filtrujGalerie(manifest.szablony, { tylkoZRewersem: true });
    expect(zRewersem.length).toBe(3);
    expect(zRewersem.every((w) => w.maRewers)).toBe(true);
  });
});
