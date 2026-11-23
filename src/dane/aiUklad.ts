import { z } from 'zod';
import { t } from '../i18n';
import { pt, type Mm } from '../model/jednostki';
import type {
  Pole,
  PoleObraz,
  PoleSeparator,
  PoleTabela,
  PoleTekst,
  PoleWartosc,
  PoleZnaczniki,
  RamkaKarty,
  StylTekstu,
  Szablon,
  WariantCzcionki,
} from '../model/szablon';
import { BladDanych } from './schemat';
import { kluczZNazwy } from './szablon';

/** Klucz w `localStorage` – klucz API żyje wyłącznie lokalnie w tej przeglądarce. */
export const KLUCZ_STORAGE_AI = 'karty-rpg:claude-api-klucz';

export const ADRES_CLAUDE_API = 'https://api.anthropic.com/v1/messages';
export const MODEL_CLAUDE_DOMYSLNY = 'claude-sonnet-4-5';
export const WERSJA_CLAUDE_API = '2023-06-01';
export const LIMIT_CZASU_AI_MS = 45_000;
export const MAKS_BAJTOW_OBRAZU_AI = 5 * 1024 * 1024;

export type TypMimeObrazuAi = 'image/jpeg' | 'image/png' | 'image/webp';

const HEX = /^#[0-9a-fA-F]{6}$/;
const kolorOpc = z.string().regex(HEX).optional();
const liczba = (min: number, max: number) => z.number().finite().min(min).max(max);

export const schematPolaAi = z.object({
  typ: z.enum(['tekst', 'wartosc', 'obraz', 'separator', 'znaczniki', 'tabela']),
  nazwa: z.string().trim().min(1).max(60).optional(),
  /** Położenie i rozmiar jako procent wymiarów karty (0–100). */
  xPct: liczba(0, 99),
  yPct: liczba(0, 99),
  szerPct: liczba(2, 100),
  wysPct: liczba(1, 100),
  rozmiarPt: liczba(5, 36).optional(),
  wariant: z.enum(['normalny', 'pogrubiony', 'kursywa', 'pogrubiona-kursywa']).optional(),
  wyrownanie: z.enum(['lewo', 'srodek', 'prawo']).optional(),
  kolor: kolorOpc,
  tlo: kolorOpc,
  obramowanieKolor: kolorOpc,
  ksztalt: z.enum(['prostokat', 'kolo', 'tarcza', 'romb']).optional(),
  etykieta: z.string().trim().max(40).optional(),
  kolumny: z.number().int().min(1).max(6).optional(),
  wiersze: z.number().int().min(1).max(8).optional(),
  liczbaZnacznikow: z.number().int().min(1).max(10).optional(),
});

export const schematOdpowiedziAi = z.object({
  nazwa: z.string().trim().min(1).max(80).optional(),
  tlo: kolorOpc,
  promienRogowMm: liczba(0, 20).optional(),
  ramka: z
    .object({
      styl: z.enum(['ciagla', 'przerywana', 'kropkowana', 'podwojna']).optional(),
      kolor: kolorOpc,
      gruboscMm: liczba(0.1, 4).optional(),
      odsuniecieMm: liczba(0, 10).optional(),
    })
    .optional(),
  pola: z.array(schematPolaAi).min(1).max(40),
});

export type OdpowiedzAi = z.infer<typeof schematOdpowiedziAi>;

export type MagazynKlucza = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function domyslnyMagazyn(): MagazynKlucza | undefined {
  return typeof localStorage !== 'undefined' ? localStorage : undefined;
}

/** Odczytuje klucz API z `localStorage` (nigdy nie trafia do projektu ani paczki). */
export function wczytajKluczAi(magazyn: MagazynKlucza | undefined = domyslnyMagazyn()): string {
  try {
    return magazyn ? (magazyn.getItem(KLUCZ_STORAGE_AI) ?? '') : '';
  } catch {
    return '';
  }
}

/** Zapisuje klucz API wyłącznie lokalnie w `localStorage`. */
export function zapiszKluczAi(
  klucz: string,
  magazyn: MagazynKlucza | undefined = domyslnyMagazyn(),
): void {
  try {
    if (!magazyn) return;
    const czysty = klucz.trim();
    if (czysty) magazyn.setItem(KLUCZ_STORAGE_AI, czysty);
    else magazyn.removeItem(KLUCZ_STORAGE_AI);
  } catch {
    // Tryb prywatny bez localStorage – klucz zostaje tylko w pamięci formularza.
  }
}

/** Usuwa zapisany lokalnie klucz API z `localStorage`. */
export function usunKluczAi(magazyn: MagazynKlucza | undefined = domyslnyMagazyn()): void {
  try {
    magazyn?.removeItem(KLUCZ_STORAGE_AI);
  } catch {
    // Brak dostępu do localStorage – ignorujemy.
  }
}

const zaokrMm = (v: number): Mm => Math.round(v * 10) / 10;
const przytnij = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Wydobywa obiekt JSON z odpowiedzi tekstowej modelu (obsługuje bloki ```json i tekst wokół). */
export function wyodrebnijJsonAi(tekst: string): unknown {
  const czysty = tekst.trim();
  const blok = /```(?:json)?\s*([\s\S]*?)```/i.exec(czysty);
  const kandydat = (blok?.[1] ?? czysty).trim();
  try {
    return JSON.parse(kandydat);
  } catch {
    const start = kandydat.indexOf('{');
    const koniec = kandydat.lastIndexOf('}');
    if (start >= 0 && koniec > start) {
      try {
        return JSON.parse(kandydat.slice(start, koniec + 1));
      } catch {
        // Niżej rzucimy czytelny BladDanych.
      }
    }
    throw new BladDanych(t('ai.bladJson'));
  }
}

/** Waliduje surowy JSON z modelu według schematu układu AI. */
export function parsujOdpowiedzAi(surowy: unknown): OdpowiedzAi {
  const wynik = schematOdpowiedziAi.safeParse(surowy);
  if (!wynik.success) {
    throw new BladDanych(t('ai.bladSchematu'));
  }
  return wynik.data;
}

/**
 * Konwertuje zwalidowaną odpowiedź AI (współrzędne procentowe 0–100) na poprawny `Szablon`
 * w trybie swobodnym z wymiarami w mm i neutralnymi wartościami przykładowymi.
 */
export function szablonZOdpowiedziAi(
  odpowiedz: OdpowiedzAi,
  opcje: {
    nazwa?: string;
    szer: Mm;
    wys: Mm;
    promien?: Mm;
    podkladZasob?: string;
  },
): Szablon {
  const szer = przytnij(zaokrMm(opcje.szer), 10, 300);
  const wys = przytnij(zaokrMm(opcje.wys), 10, 300);
  const nazwa = opcje.nazwa?.trim() || odpowiedz.nazwa || t('ai.nazwaDomyslna');
  const zajeteKlucze = new Set<string>();
  const przyklad: Record<string, string> = {};

  const dzieci: Pole[] = odpowiedz.pola.map((p, idx) => {
    const id = `ai-pole-${idx + 1}`;
    const minWys = p.typ === 'separator' ? 1 : 3;
    const x = zaokrMm(przytnij((p.xPct / 100) * szer, 0, Math.max(0, szer - 4)));
    const y = zaokrMm(przytnij((p.yPct / 100) * wys, 0, Math.max(0, wys - minWys)));
    const szerPola = zaokrMm(przytnij((p.szerPct / 100) * szer, 4, szer - x));
    const wysPola = zaokrMm(przytnij((p.wysPct / 100) * wys, minWys, wys - y));
    const pozycja = { x, y };
    const kolor = p.kolor ?? '#1f2937';
    const wariant: WariantCzcionki = p.wariant ?? 'normalny';
    const wyrownanie: NonNullable<StylTekstu['wyrownanie']> = p.wyrownanie ?? 'lewo';
    const rozmiar = pt(p.rozmiarPt ?? (idx === 0 ? 12 : 9));
    const obramowanie = p.obramowanieKolor
      ? { grubosc: 0.35, kolor: p.obramowanieKolor }
      : undefined;

    if (p.typ === 'separator') {
      const sep: PoleSeparator = {
        id,
        typ: 'separator',
        nazwa: p.nazwa ?? t('wezel.separator'),
        kierunek: szerPola >= wysPola ? 'poziomy' : 'pionowy',
        pozycja,
        szerokosc: { mm: szerPola },
        wysokosc: { mm: Math.max(1, wysPola) },
        grubosc: 0.35,
        kolor: p.kolor ?? '#475569',
      };
      return sep;
    }

    if (p.typ === 'obraz') {
      const nazwaPola = p.nazwa ?? t('wezel.obraz');
      const klucz = kluczZNazwy(nazwaPola, zajeteKlucze);
      zajeteKlucze.add(klucz);
      const obr: PoleObraz = {
        id,
        typ: 'obraz',
        nazwa: nazwaPola,
        klucz,
        pozycja,
        szerokosc: { mm: szerPola },
        wysokosc: { mm: wysPola },
        dopasowanie: 'wypelnij',
        ...(p.tlo ? { tlo: p.tlo } : {}),
        ...(obramowanie ? { obramowanie } : {}),
      };
      return obr;
    }

    if (p.typ === 'znaczniki') {
      const nazwaPola = p.nazwa ?? t('wezel.znaczniki');
      const klucz = kluczZNazwy(nazwaPola, zajeteKlucze);
      zajeteKlucze.add(klucz);
      const ile = p.liczbaZnacznikow ?? 3;
      przyklad[klucz] = String(ile);
      const zn: PoleZnaczniki = {
        id,
        typ: 'znaczniki',
        nazwa: nazwaPola,
        klucz,
        pozycja,
        szerokosc: { mm: szerPola },
        wysokosc: { mm: wysPola },
        kolumny: ile,
        rzedy: 1,
        ksztalt: 'kolo',
        srednica: 3,
        odstep: 1.2,
        grubosc: 0.35,
        kolor,
        ...(p.tlo ? { tlo: p.tlo } : {}),
        ...(obramowanie ? { obramowanie } : {}),
      };
      return zn;
    }

    if (p.typ === 'tabela') {
      const nazwaPola = p.nazwa ?? t('wezel.tabela');
      const ileKol = p.kolumny ?? 3;
      const ileWier = p.wiersze ?? 2;
      const kolumny = Array.from({ length: ileKol }, (_, c) => {
        const k = kluczZNazwy(`${nazwaPola}-${c + 1}`, zajeteKlucze);
        zajeteKlucze.add(k);
        for (let r = 1; r <= ileWier; r++) {
          przyklad[r === 1 ? k : `${k}.${r}`] = `${r}.${c + 1}`;
        }
        return { klucz: k, naglowek: String(c + 1) };
      });
      const tab: PoleTabela = {
        id,
        typ: 'tabela',
        nazwa: nazwaPola,
        pozycja,
        szerokosc: { mm: szerPola },
        wysokosc: { mm: wysPola },
        kolumny,
        wiersze: ileWier,
        styl: { czcionka: 'tresc', rozmiar: pt(p.rozmiarPt ?? 8), kolor },
        linie: { grubosc: 0.25, kolor: p.obramowanieKolor ?? '#64748b' },
        ...(p.tlo ? { tlo: p.tlo } : {}),
      };
      return tab;
    }

    if (p.typ === 'wartosc') {
      const nazwaPola = p.nazwa ?? t('wezel.wartosc');
      const klucz = kluczZNazwy(nazwaPola, zajeteKlucze);
      zajeteKlucze.add(klucz);
      przyklad[klucz] = '10';
      const wart: PoleWartosc = {
        id,
        typ: 'wartosc',
        nazwa: nazwaPola,
        klucz,
        pozycja,
        szerokosc: { mm: szerPola },
        wysokosc: { mm: wysPola },
        styl: { czcionka: 'tresc', wariant, rozmiar, kolor, wyrownanie: 'srodek' },
        ksztalt: p.ksztalt ?? 'prostokat',
        ...(p.etykieta ? { etykieta: { tekst: p.etykieta, pozycja: 'nad' as const } } : {}),
        ...(p.tlo ? { tlo: p.tlo } : {}),
        obramowanie: obramowanie ?? { grubosc: 0.35, kolor },
      };
      return wart;
    }

    const nazwaPola = p.nazwa ?? (idx === 0 ? t('rola.tytul') : t('wezel.tekst'));
    const klucz = kluczZNazwy(nazwaPola, zajeteKlucze);
    zajeteKlucze.add(klucz);
    przyklad[klucz] = idx === 0 ? nazwa : `${nazwaPola}…`;
    const tekstPole: PoleTekst = {
      id,
      typ: 'tekst',
      nazwa: nazwaPola,
      klucz,
      pozycja,
      szerokosc: { mm: szerPola },
      wysokosc: { mm: wysPola },
      styl: {
        czcionka: idx === 0 ? 'tytul' : 'tresc',
        wariant: idx === 0 && !p.wariant ? 'pogrubiony' : wariant,
        rozmiar,
        kolor,
        wyrownanie,
      },
      ...(p.tlo ? { tlo: p.tlo } : {}),
      ...(obramowanie ? { obramowanie } : {}),
    };
    return tekstPole;
  });

  const ramka: RamkaKarty | undefined = odpowiedz.ramka
    ? {
        styl: odpowiedz.ramka.styl ?? 'ciagla',
        grubosc: odpowiedz.ramka.gruboscMm ?? 0.4,
        kolor: odpowiedz.ramka.kolor ?? '#1f2937',
        odsuniecie: odpowiedz.ramka.odsuniecieMm ?? 2,
      }
    : undefined;

  const maksPromien = Math.min(szer, wys) / 2;
  const promienRogow = przytnij(opcje.promien ?? odpowiedz.promienRogowMm ?? 3, 0, maksPromien);

  return {
    id: `szablon-ai-${Date.now().toString(36)}`,
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
    promienRogow,
    tlo: odpowiedz.tlo ?? '#ffffff',
    ...(ramka ? { ramka } : {}),
    ...(opcje.podkladZasob
      ? { podklad: { zasob: opcje.podkladZasob, przezroczystosc: 55, widoczny: true } }
      : {}),
    przyklad,
    korzen: {
      id: 'korzen',
      typ: 'swobodny',
      dzieci,
    },
  };
}

/** Treść promptu wymuszająca zwrot wyłącznie geometrii i struktury pól (bez treści ani grafik). */
export const PROMPT_UKLADU_AI = [
  'Analyze the card photo and return ONLY a single JSON object describing its visual layout structure.',
  'Do NOT transcribe copyrighted text or copy artwork. Use neutral generic Polish or English field names (e.g. "Tytuł", "Ilustracja", "Opis", "Wartość", "Tabela").',
  'All coordinates (xPct, yPct, szerPct, wysPct) must be percentages of the card dimensions (0 to 100).',
  'Schema:',
  '{',
  '  "nazwa": "short generic template name",',
  '  "tlo": "#RRGGBB",',
  '  "promienRogowMm": 3,',
  '  "ramka": { "styl": "ciagla|przerywana|kropkowana|podwojna", "kolor": "#RRGGBB", "gruboscMm": 0.4, "odsuniecieMm": 2 },',
  '  "pola": [',
  '    {',
  '      "typ": "tekst|wartosc|obraz|separator|znaczniki|tabela",',
  '      "nazwa": "Field name",',
  '      "xPct": 6, "yPct": 5, "szerPct": 88, "wysPct": 12,',
  '      "rozmiarPt": 11, "wariant": "normalny|pogrubiony|kursywa|pogrubiona-kursywa",',
  '      "wyrownanie": "lewo|srodek|prawo",',
  '      "kolor": "#1f2937", "tlo": "#ffffff", "obramowanieKolor": "#1f2937",',
  '      "ksztalt": "prostokat|kolo|tarcza|romb", "kolumny": 3, "wiersze": 2, "liczbaZnacznikow": 3',
  '    }',
  '  ]',
  '}',
  'Return raw JSON only, without explanations.',
].join('\n');

export type FunkcjaPobieraniaAi = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

function bladAnulowania(): Error {
  const err = new Error('Aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * Wysyła obraz karty do Claude API i zwraca zwalidowany szablon `Szablon` (układ swobodny w mm).
 * Klucz API podawany jest jawnie przez wywołującego i nigdy nie trafia do wynikowego szablonu.
 */
export async function rozpoznajUkladZeZdjecia({
  obrazBase64,
  typMime,
  kluczApi,
  szer,
  wys,
  promien,
  nazwa,
  podkladZasob,
  model = MODEL_CLAUDE_DOMYSLNY,
  pobierz = (url, init) => fetch(url, init),
  signal,
  limitCzasuMs = LIMIT_CZASU_AI_MS,
}: {
  obrazBase64: string;
  typMime: TypMimeObrazuAi;
  kluczApi: string;
  szer: Mm;
  wys: Mm;
  promien?: Mm;
  nazwa?: string;
  podkladZasob?: string;
  model?: string;
  pobierz?: FunkcjaPobieraniaAi;
  signal?: AbortSignal;
  limitCzasuMs?: number;
}): Promise<Szablon> {
  const klucz = kluczApi.trim();
  if (!klucz) throw new BladDanych(t('ai.brakKlucza'));
  if (!obrazBase64) throw new BladDanych(t('ai.brakObrazu'));
  if (signal?.aborted) throw bladAnulowania();

  const szerDoc = przytnij(zaokrMm(Number.isFinite(szer) ? szer : 63), 10, 300);
  const wysDoc = przytnij(zaokrMm(Number.isFinite(wys) ? wys : 88), 10, 300);

  const kontroler = new AbortController();
  let przekroczonoCzas = false;
  const naZewnetrzne = () => kontroler.abort();
  signal?.addEventListener('abort', naZewnetrzne, { once: true });
  const timer =
    limitCzasuMs > 0 && Number.isFinite(limitCzasuMs)
      ? setTimeout(() => {
          przekroczonoCzas = true;
          kontroler.abort();
        }, limitCzasuMs)
      : undefined;

  let tekstOdpowiedzi: string;
  try {
    const cialo = JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: typMime, data: obrazBase64 },
            },
            {
              type: 'text',
              text: `${PROMPT_UKLADU_AI}\nTarget card format: ${szerDoc}x${wysDoc} mm.`,
            },
          ],
        },
      ],
    });

    const res = await pobierz(ADRES_CLAUDE_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': klucz,
        'anthropic-version': WERSJA_CLAUDE_API,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: cialo,
      signal: kontroler.signal,
    });
    if (signal?.aborted) throw bladAnulowania();

    const surowyTekst = await res.text();
    if (signal?.aborted) throw bladAnulowania();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new BladDanych(t('ai.bladKlucza'));
      }
      if (res.status === 429) {
        throw new BladDanych(t('ai.bladLimitu'));
      }
      throw new BladDanych(t('ai.bladHttp', { status: res.status }));
    }

    let pakiet: { content?: { type?: string; text?: string }[] };
    try {
      pakiet = JSON.parse(surowyTekst) as { content?: { type?: string; text?: string }[] };
    } catch {
      throw new BladDanych(t('ai.bladJson'));
    }
    tekstOdpowiedzi = (pakiet.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text!)
      .join('\n');
  } catch (e) {
    if (signal?.aborted) throw bladAnulowania();
    if (e instanceof BladDanych) throw e;
    if (przekroczonoCzas) throw new BladDanych(t('ai.bladCzasu'));
    throw new BladDanych(
      t('ai.bladSieci', { szczegoly: e instanceof Error ? e.message : String(e) }),
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', naZewnetrzne);
  }

  const json = wyodrebnijJsonAi(tekstOdpowiedzi);
  const odpowiedz = parsujOdpowiedzAi(json);
  return szablonZOdpowiedziAi(odpowiedz, { nazwa, szer, wys, promien, podkladZasob });
}
