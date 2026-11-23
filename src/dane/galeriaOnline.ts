import { z } from 'zod';
import { formatujLiczbe, t } from '../i18n';
import {
  importujSzablon,
  LIMITY_ARCHIWUM,
  ROZSZERZENIE_SZABLONU,
  type PaczkaSzablonu,
} from './archiwum';
import { BladDanych } from './schemat';

/**
 * Kuratorowana galeria neutralnych szablonów i rewersów online oraz import szablonu z adresu URL.
 * Czysty moduł warstwy danych (bez DOM/Reacta): waliduje manifest schematem `zod`, pobiera paczkę
 * strumieniowo z limitem rozmiaru i czasu oraz przepuszcza ją przez `importujSzablon` przed zapisem.
 */

export const KATEGORIE_GALERII = ['karty', 'postacie', 'zdarzenia', 'zasoby', 'rewersy'] as const;
export type KategoriaGalerii = (typeof KATEGORIE_GALERII)[number];

export const DOMYSLNY_LIMIT_CZASU_GALERII_MS = 15_000;
export const LIMIT_MANIFESTU_BAJTOW = 1024 * 1024;
const MB = 1024 * 1024;

const tekstDwujezyczny = z.object({
  pl: z.string().trim().min(1).max(400),
  en: z.string().trim().min(1).max(400),
});

/** Biała lista nazw plików w statycznym katalogu galerii (bez ścieżek i zakodowanych znaków). */
const bezpiecznyPlik = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (s) =>
      !s.includes('..') &&
      /^[a-z0-9][a-z0-9._-]*$/i.test(s) &&
      [ROZSZERZENIE_SZABLONU, '.zip'].some((r) => s.toLowerCase().endsWith(r)),
    'niebezpieczna ścieżka pliku szablonu',
  );

export const schematWpisuGalerii = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/i),
  nazwa: tekstDwujezyczny,
  opis: tekstDwujezyczny,
  kategoria: z.enum(KATEGORIE_GALERII),
  format: z.object({
    szerokosc: z.number().finite().min(10).max(300),
    wysokosc: z.number().finite().min(10).max(300),
    nazwa: z.string().trim().min(1).max(80),
  }),
  maRewers: z.boolean(),
  plik: bezpiecznyPlik,
  autor: z.string().trim().min(1).max(120),
  licencja: z.string().trim().min(1).max(120),
  tagi: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

export const schematManifestuGalerii = z.object({
  wersja: z.literal(1),
  szablony: z.array(schematWpisuGalerii).min(1).max(200),
});

export type WpisGaleriiOnline = z.infer<typeof schematWpisuGalerii>;
export type ManifestGaleriiOnline = z.infer<typeof schematManifestuGalerii>;

export interface OdpowiedzPobieraniaGalerii {
  ok: boolean;
  status: number;
  headers?: { get(nazwa: string): string | null };
  body?: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FunkcjaPobieraniaGalerii = (
  adres: string,
  init: { signal?: AbortSignal },
) => Promise<OdpowiedzPobieraniaGalerii>;

const domyslnePobierz: FunkcjaPobieraniaGalerii = (adres, init) => fetch(adres, init);

/** Sprawdza manifest galerii schematem `zod` i pilnuje unikalności identyfikatorów. */
export function parsujManifestGalerii(surowe: unknown): ManifestGaleriiOnline {
  const wynik = schematManifestuGalerii.safeParse(surowe);
  if (!wynik.success) {
    throw new BladDanych(t('galeria.bladManifestu'));
  }
  const widziane = new Set<string>();
  for (const s of wynik.data.szablony) {
    if (widziane.has(s.id)) throw new BladDanych(t('galeria.bladManifestu'));
    widziane.add(s.id);
  }
  return wynik.data;
}

/**
 * Waliduje adres URL podany przez użytkownika (wyłącznie `http:` lub `https:`).
 * Odrzuca schematy niebezpieczne (`javascript:`, `data:`, `file:`) i puste napisy.
 */
export function walidujUrlSzablonu(surowy: string): string {
  const przyciety = surowy.trim();
  if (!przyciety) throw new BladDanych(t('galeria.urlPusty'));
  let parsed: URL;
  try {
    parsed = new URL(przyciety);
  } catch {
    throw new BladDanych(t('galeria.urlNiepoprawny'));
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BladDanych(t('galeria.urlNiepoprawny'));
  }
  return parsed.toString();
}

/** Buduje adres pliku w statycznej galerii aplikacji (uwzględniając `BASE_URL`). */
export function adresPlikuGalerii(bazaUrl: string, plik: string): string {
  const baza = bazaUrl.endsWith('/') ? bazaUrl : `${bazaUrl}/`;
  return `${baza}galeria/${plik}`;
}

function bladRozmiaru(bajty: number, limit: number): BladDanych {
  return new BladDanych(
    t('import.zaDuzy', {
      mb: formatujLiczbe(bajty / MB, 1),
      limit: formatujLiczbe(limit / MB, 0),
    }),
  );
}

/** Odczytuje ciało odpowiedzi z twardym limitem bajtów (strumieniowo, gdy dostępny jest `body`). */
async function odczytajZLimitem(
  odp: OdpowiedzPobieraniaGalerii,
  limit: number,
  bladPrzyPrzekroczeniu: (bajty: number) => BladDanych,
): Promise<Uint8Array> {
  const dlugoscNagl = Number(odp.headers?.get('content-length') ?? '');
  if (Number.isFinite(dlugoscNagl) && dlugoscNagl > limit) {
    throw bladPrzyPrzekroczeniu(dlugoscNagl);
  }
  const czytnik = odp.body?.getReader();
  if (czytnik) {
    const kawalki: Uint8Array[] = [];
    let suma = 0;
    try {
      for (;;) {
        const { done, value } = await czytnik.read();
        if (done) break;
        if (!value) continue;
        suma += value.byteLength;
        if (suma > limit) {
          await czytnik.cancel().catch(() => {});
          throw bladPrzyPrzekroczeniu(suma);
        }
        kawalki.push(value);
      }
    } finally {
      czytnik.releaseLock();
    }
    const wynik = new Uint8Array(suma);
    let poz = 0;
    for (const k of kawalki) {
      wynik.set(k, poz);
      poz += k.byteLength;
    }
    return wynik;
  }
  const bufor = await odp.arrayBuffer();
  if (bufor.byteLength > limit) {
    throw bladPrzyPrzekroczeniu(bufor.byteLength);
  }
  return new Uint8Array(bufor);
}

async function wykonajZLimitem<T>(
  opcje: { signal?: AbortSignal; limitCzasuMs?: number },
  zadanie: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (opcje.signal?.aborted) {
    throw new DOMException('Anulowano', 'AbortError');
  }
  const kontroler = new AbortController();
  let przekroczonoCzas = false;
  const naAnulowanie = () => kontroler.abort();
  opcje.signal?.addEventListener('abort', naAnulowanie, { once: true });
  const zegar = setTimeout(() => {
    przekroczonoCzas = true;
    kontroler.abort();
  }, opcje.limitCzasuMs ?? DOMYSLNY_LIMIT_CZASU_GALERII_MS);

  try {
    const wynik = await zadanie(kontroler.signal);
    if (opcje.signal?.aborted) throw new DOMException('Anulowano', 'AbortError');
    return wynik;
  } catch (e) {
    if (opcje.signal?.aborted) throw new DOMException('Anulowano', 'AbortError');
    if (przekroczonoCzas) throw new BladDanych(t('galeria.bladTimeout'));
    if (e instanceof BladDanych) throw e;
    throw new BladDanych(t('galeria.bladSieci'));
  } finally {
    clearTimeout(zegar);
    opcje.signal?.removeEventListener('abort', naAnulowanie);
  }
}

/** Pobiera i waliduje manifest statycznej galerii szablonów (z limitem 1 MB). */
export async function pobierzManifestGalerii(
  opcje: {
    adres?: string;
    bazaUrl?: string;
    pobierz?: FunkcjaPobieraniaGalerii;
    signal?: AbortSignal;
    limitCzasuMs?: number;
  } = {},
): Promise<ManifestGaleriiOnline> {
  const adres = opcje.adres ?? adresPlikuGalerii(opcje.bazaUrl ?? '/', 'manifest.json');
  const pobierz = opcje.pobierz ?? domyslnePobierz;
  return wykonajZLimitem(opcje, async (signal) => {
    const odp = await pobierz(adres, { signal });
    if (!odp.ok) {
      throw new BladDanych(t('galeria.bladHttp', { status: odp.status }));
    }
    const tekst = odp.body
      ? new TextDecoder().decode(
          await odczytajZLimitem(
            odp,
            LIMIT_MANIFESTU_BAJTOW,
            () => new BladDanych(t('galeria.bladManifestu')),
          ),
        )
      : await odp.text();
    if (tekst.length > LIMIT_MANIFESTU_BAJTOW) {
      throw new BladDanych(t('galeria.bladManifestu'));
    }
    let json: unknown;
    try {
      json = JSON.parse(tekst);
    } catch {
      throw new BladDanych(t('galeria.bladManifestu'));
    }
    return parsujManifestGalerii(json);
  });
}

/**
 * Pobiera paczkę `.kartyrpg-szablon` z podanego adresu (z galerii lub z bezpośredniego linku URL),
 * sprawdza limit rozmiaru (także strumieniowo bez `Content-Length`) oraz pełny schemat
 * `importujSzablon` przed zwróceniem danych.
 */
export async function pobierzSzablonZUrl(
  adres: string,
  opcje: {
    wymagajHttp?: boolean;
    pobierz?: FunkcjaPobieraniaGalerii;
    signal?: AbortSignal;
    limitCzasuMs?: number;
  } = {},
): Promise<{ bajty: Uint8Array; paczka: PaczkaSzablonu }> {
  const docelowy = opcje.wymagajHttp ? walidujUrlSzablonu(adres) : adres;
  const pobierz = opcje.pobierz ?? domyslnePobierz;
  return wykonajZLimitem(opcje, async (signal) => {
    const odp = await pobierz(docelowy, { signal });
    if (!odp.ok) {
      throw new BladDanych(t('galeria.bladHttp', { status: odp.status }));
    }
    const bajty = await odczytajZLimitem(odp, LIMITY_ARCHIWUM.suma, (b) =>
      bladRozmiaru(b, LIMITY_ARCHIWUM.suma),
    );
    const paczka = importujSzablon(bajty);
    return { bajty, paczka };
  });
}

export interface FiltryGalerii {
  zapytanie?: string;
  kategoria?: KategoriaGalerii | 'wszystkie';
  tylkoZRewersem?: boolean;
}

/** Filtruje wpisy galerii po frazie (PL i EN), kategorii oraz obecności rewersu. */
export function filtrujGalerie(
  wpisy: readonly WpisGaleriiOnline[],
  filtry: FiltryGalerii = {},
): WpisGaleriiOnline[] {
  const fraza = (filtry.zapytanie ?? '').trim().toLowerCase();
  const kat = filtry.kategoria ?? 'wszystkie';
  return wpisy.filter((w) => {
    if (kat !== 'wszystkie' && w.kategoria !== kat) return false;
    if (filtry.tylkoZRewersem && !w.maRewers) return false;
    if (!fraza) return true;
    const pola = [
      w.nazwa.pl,
      w.nazwa.en,
      w.opis.pl,
      w.opis.en,
      w.format.nazwa,
      w.autor,
      w.licencja,
      ...w.tagi,
    ];
    return pola.some((p) => p.toLowerCase().includes(fraza));
  });
}
