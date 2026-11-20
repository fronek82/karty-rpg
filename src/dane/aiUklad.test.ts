import { beforeEach, describe, expect, it } from 'vitest';
import {
  ADRES_CLAUDE_API,
  KLUCZ_STORAGE_AI,
  WERSJA_CLAUDE_API,
  parsujOdpowiedzAi,
  rozpoznajUkladZeZdjecia,
  szablonZOdpowiedziAi,
  usunKluczAi,
  wczytajKluczAi,
  wyodrebnijJsonAi,
  zapiszKluczAi,
  type FunkcjaPobieraniaAi,
  type OdpowiedzAi,
} from './aiUklad';
import { eksportujProjekt } from './archiwum';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import { BladDanych, przygotujProjekt, sprawdzSpojnosc } from './schemat';

const ODPOWIEDZ_PRZYKLADOWA: OdpowiedzAi = {
  nazwa: 'Karta znaleziska',
  tlo: '#fbf6ea',
  promienRogowMm: 3,
  ramka: { styl: 'ciagla', kolor: '#1e3a5f', gruboscMm: 0.5, odsuniecieMm: 2 },
  pola: [
    {
      typ: 'tekst',
      nazwa: 'Tytuł',
      xPct: 6,
      yPct: 5,
      szerPct: 70,
      wysPct: 10,
      rozmiarPt: 13,
      wariant: 'pogrubiony',
      wyrownanie: 'srodek',
      kolor: '#1e3a5f',
    },
    {
      typ: 'wartosc',
      nazwa: 'Koszt',
      xPct: 78,
      yPct: 4,
      szerPct: 16,
      wysPct: 11,
      ksztalt: 'romb',
      etykieta: 'K',
      tlo: '#f4e1ba',
      obramowanieKolor: '#493336',
    },
    { typ: 'obraz', nazwa: 'Ilustracja', xPct: 8, yPct: 18, szerPct: 84, wysPct: 35 },
    { typ: 'separator', xPct: 8, yPct: 55, szerPct: 84, wysPct: 1, kolor: '#1e3a5f' },
    { typ: 'tekst', nazwa: 'Opis', xPct: 8, yPct: 58, szerPct: 84, wysPct: 22, rozmiarPt: 9 },
    {
      typ: 'znaczniki',
      nazwa: 'Użycia',
      xPct: 8,
      yPct: 82,
      szerPct: 40,
      wysPct: 6,
      liczbaZnacznikow: 4,
    },
    {
      typ: 'tabela',
      nazwa: 'Statystyki',
      xPct: 50,
      yPct: 82,
      szerPct: 42,
      wysPct: 12,
      kolumny: 2,
      wiersze: 2,
    },
  ],
};

describe('rozpoznawanie układu karty ze zdjęcia AI (M5-2)', () => {
  beforeEach(() => {
    usunKluczAi();
  });

  it('wyodrębnia JSON z surowego tekstu, bloku markdown oraz tekstu z komentarzem', () => {
    expect(wyodrebnijJsonAi('{"pola": []}')).toEqual({ pola: [] });
    expect(wyodrebnijJsonAi('Oto wynik:\n```json\n{"pola": [{"typ": "tekst"}]}\n```')).toEqual({
      pola: [{ typ: 'tekst' }],
    });
    expect(() => wyodrebnijJsonAi('bez obiektu json')).toThrow(BladDanych);
  });

  it('odrzuca niepoprawny schemat odpowiedzi AI (brak pól, zły kolor, współrzędne poza zakresem)', () => {
    expect(() => parsujOdpowiedzAi({ pola: [] })).toThrow(BladDanych);
    expect(() =>
      parsujOdpowiedzAi({
        tlo: 'czerwony',
        pola: [{ typ: 'tekst', xPct: 5, yPct: 5, szerPct: 50, wysPct: 10 }],
      }),
    ).toThrow(BladDanych);
    expect(() =>
      parsujOdpowiedzAi({
        pola: [{ typ: 'tekst', xPct: 120, yPct: 5, szerPct: 50, wysPct: 10 }],
      }),
    ).toThrow(BladDanych);
  });

  it('konwertuje odpowiedź AI na poprawny szablon swobodny w mm ze wszystkimi typami pól i bez wycieku klucza w eksporcie', () => {
    const szablon = szablonZOdpowiedziAi(ODPOWIEDZ_PRZYKLADOWA, {
      szer: 63,
      wys: 88,
      podkladZasob: 'podklad-ai',
    });

    expect(szablon.rozmiar).toEqual({ tryb: 'mm', szerokosc: 63, wysokosc: 88 });
    expect(szablon.korzen.typ).toBe('swobodny');
    expect(szablon.korzen.dzieci).toHaveLength(7);
    expect(szablon.podklad).toEqual({ zasob: 'podklad-ai', przezroczystosc: 55, widoczny: true });
    expect(szablon.ramka).toMatchObject({ styl: 'ciagla', kolor: '#1e3a5f' });

    // Wszystkie pola mieszczą się w wymiarach karty (mm).
    for (const d of szablon.korzen.dzieci) {
      expect(d.pozycja).toBeDefined();
      expect(d.pozycja!.x).toBeGreaterThanOrEqual(0);
      expect(d.pozycja!.y).toBeGreaterThanOrEqual(0);
      if (typeof d.szerokosc === 'object' && 'mm' in d.szerokosc) {
        expect(d.pozycja!.x + d.szerokosc.mm).toBeLessThanOrEqual(63.1);
      }
      if (typeof d.wysokosc === 'object' && 'mm' in d.wysokosc) {
        expect(d.pozycja!.y + d.wysokosc.mm).toBeLessThanOrEqual(88.1);
      }
    }

    // Spójność z całym modelem projektu i brak wycieku klucza API w archiwum ZIP.
    zapiszKluczAi('sk-ant-tajny-klucz-123');
    const projekt: Projekt = {
      id: 'proj-ai',
      wersja: WERSJA_SCHEMATU,
      nazwa: 'Projekt AI',
      utworzono: '2026-11-20T12:00:00.000Z',
      zmieniono: '2026-11-20T12:00:00.000Z',
      role: {},
      zasoby: [
        {
          id: 'podklad-ai',
          rodzaj: 'obraz',
          nazwa: 'skan.png',
          format: 'png',
          szerokosc: 100,
          wysokosc: 140,
        },
      ],
      szablony: [szablon],
      talie: [],
      arkusze: [],
    };
    expect(() => sprawdzSpojnosc(projekt)).not.toThrow();
    expect(() => przygotujProjekt(projekt)).not.toThrow();
    const zip = eksportujProjekt(
      projekt,
      new Map([['podklad-ai', new Uint8Array([137, 80, 78, 71])]]),
    );
    expect(new TextDecoder('latin1').decode(zip)).not.toContain('sk-ant-tajny-klucz-123');
  });

  it('przycina skrajne współrzędne (yPct: 99) i promień rogów do wymiarów karty', () => {
    const szablon = szablonZOdpowiedziAi(
      {
        promienRogowMm: 20,
        pola: [
          { typ: 'tekst', nazwa: 'Stopka', xPct: 95, yPct: 99, szerPct: 20, wysPct: 10 },
          { typ: 'separator', xPct: 98, yPct: 99, szerPct: 50, wysPct: 2 },
        ],
      },
      { szer: 30, wys: 40 },
    );
    expect(szablon.promienRogow).toBeLessThanOrEqual(15);
    for (const d of szablon.korzen.dzieci) {
      const szerMm = typeof d.szerokosc === 'object' && 'mm' in d.szerokosc ? d.szerokosc.mm : 0;
      const wysMm = typeof d.wysokosc === 'object' && 'mm' in d.wysokosc ? d.wysokosc.mm : 0;
      expect(d.pozycja!.x).toBeGreaterThanOrEqual(0);
      expect(d.pozycja!.y).toBeGreaterThanOrEqual(0);
      expect(d.pozycja!.x + szerMm).toBeLessThanOrEqual(30.01);
      expect(d.pozycja!.y + wysMm).toBeLessThanOrEqual(40.01);
    }
  });

  it('wysyła żądanie do Claude API z wymaganymi nagłówkami i zwraca zwalidowany szablon z zapisanej odpowiedzi', async () => {
    let wyslaneUrl = '';
    let naglowki: Record<string, string> = {};
    const pobierz: FunkcjaPobieraniaAi = async (url, init) => {
      wyslaneUrl = url;
      naglowki = init.headers;
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: `\`\`\`json\n${JSON.stringify(ODPOWIEDZ_PRZYKLADOWA)}\n\`\`\``,
              },
            ],
          }),
      };
    };

    const szablon = await rozpoznajUkladZeZdjecia({
      obrazBase64: 'AAAA',
      typMime: 'image/png',
      kluczApi: 'sk-ant-test',
      szer: 63,
      wys: 88,
      pobierz,
    });

    expect(wyslaneUrl).toBe(ADRES_CLAUDE_API);
    expect(naglowki['x-api-key']).toBe('sk-ant-test');
    expect(naglowki['anthropic-version']).toBe(WERSJA_CLAUDE_API);
    expect(naglowki['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(szablon.nazwa).toBe('Karta znaleziska');
    expect(szablon.korzen.dzieci).toHaveLength(7);
  });

  it('zgłasza czytelne błędy BladDanych dla błędnego klucza (401), limitu (429), timeoutu i wspiera AbortSignal', async () => {
    const zStatusem =
      (status: number): FunkcjaPobieraniaAi =>
      async () => ({ ok: false, status, text: async () => 'err' });

    await expect(
      rozpoznajUkladZeZdjecia({
        obrazBase64: 'AAAA',
        typMime: 'image/png',
        kluczApi: 'zly',
        szer: 63,
        wys: 88,
        pobierz: zStatusem(401),
      }),
    ).rejects.toThrow(/401\/403/);

    await expect(
      rozpoznajUkladZeZdjecia({
        obrazBase64: 'AAAA',
        typMime: 'image/png',
        kluczApi: 'ok',
        szer: 63,
        wys: 88,
        pobierz: zStatusem(429),
      }),
    ).rejects.toThrow(/429/);

    await expect(
      rozpoznajUkladZeZdjecia({
        obrazBase64: 'AAAA',
        typMime: 'image/png',
        kluczApi: 'ok',
        szer: 63,
        wys: 88,
        limitCzasuMs: 15,
        pobierz: async (_url, init) =>
          await new Promise((_, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('timeout')), {
              once: true,
            });
          }),
      }),
    ).rejects.toThrow(BladDanych);

    const kontroler = new AbortController();
    kontroler.abort();
    await expect(
      rozpoznajUkladZeZdjecia({
        obrazBase64: 'AAAA',
        typMime: 'image/png',
        kluczApi: 'ok',
        szer: 63,
        wys: 88,
        signal: kontroler.signal,
        pobierz: zStatusem(200),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('zapisuje i usuwa klucz API wyłącznie w lokalnym magazynie', () => {
    const mapa = new Map<string, string>();
    const magazyn = {
      getItem: (k: string) => mapa.get(k) ?? null,
      setItem: (k: string, v: string) => void mapa.set(k, v),
      removeItem: (k: string) => void mapa.delete(k),
    };
    expect(wczytajKluczAi(magazyn)).toBe('');
    zapiszKluczAi('  sk-ant-demo  ', magazyn);
    expect(wczytajKluczAi(magazyn)).toBe('sk-ant-demo');
    expect(mapa.get(KLUCZ_STORAGE_AI)).toBe('sk-ant-demo');
    usunKluczAi(magazyn);
    expect(wczytajKluczAi(magazyn)).toBe('');
  });
});
