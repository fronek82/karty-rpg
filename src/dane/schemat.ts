import { z } from 'zod';
import { t } from '../i18n';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import type { Szablon, Wezel } from '../model/szablon';

/** Błąd wczytywania danych z komunikatem po polsku, gotowym do pokazania użytkownikowi. */
export class BladDanych extends Error {
  constructor(komunikat: string) {
    super(komunikat);
    this.name = 'BladDanych';
  }
}

/**
 * Schematy sprawdzają kształt danych (typy, wymagane pola, liczby skończone), ale nie usuwają
 * pól, których nie znają (`looseObject`) – import nie może po cichu gubić danych.
 */
const liczba = z.number().finite();
const nieujemna = liczba.min(0);
const identyfikator = z.string().min(1);
const idZasobu = z.string().regex(/^[\w./-]{1,100}$/);
const obj = z.looseObject;

const rozmiar = z.union([
  obj({ mm: liczba }),
  obj({ procent: liczba }),
  obj({ wypelnij: liczba.positive() }),
  z.literal('auto'),
]);
const odstepy = z.union([liczba, obj({})]);

const baza = {
  id: identyfikator,
  szerokosc: rozmiar.optional(),
  wysokosc: rozmiar.optional(),
  margines: odstepy.optional(),
  padding: odstepy.optional(),
  promien: nieujemna.optional(),
  minSzerokosc: nieujemna.optional(),
  minWysokosc: nieujemna.optional(),
};
const stylTekstu = obj({ czcionka: z.string().min(1), rozmiar: liczba.positive() });
const napis = z.union([z.string(), obj({ parametr: z.string() })]);

const pole = z.discriminatedUnion('typ', [
  obj({ ...baza, typ: z.literal('tekst'), styl: stylTekstu, tekst: napis.optional() }),
  obj({
    ...baza,
    typ: z.literal('wartosc'),
    styl: stylTekstu,
    ksztalt: z.enum(['prostokat', 'kolo', 'sciety']),
  }),
  obj({
    ...baza,
    typ: z.literal('obraz'),
    dopasowanie: z.enum(['dopasuj', 'wypelnij', 'rozciagnij']),
    zasob: z.string().optional(),
  }),
  obj({
    ...baza,
    typ: z.literal('znaczniki'),
    kolumny: liczba.int().min(1),
    rzedy: liczba.int().min(1),
    ksztalt: z.enum(['kolo', 'kwadrat']),
    srednica: liczba.positive(),
    odstep: nieujemna,
    grubosc: nieujemna,
  }),
  obj({ ...baza, typ: z.literal('wpis'), styl: stylTekstu, sufiks: napis.optional() }),
  obj({
    ...baza,
    typ: z.literal('ikona'),
    ikona: z.enum(['gwiazdka', 'nozyczki']),
    rozmiar: liczba,
  }),
]);

const wezel: z.ZodType<Wezel> = z.lazy(() =>
  z.union([
    obj({
      ...baza,
      typ: z.enum(['wiersz', 'kolumna', 'warstwy']),
      dzieci: z.array(wezel),
      odstep: nieujemna.optional(),
    }),
    pole,
  ]),
) as unknown as z.ZodType<Wezel>;
const kontener = obj({
  ...baza,
  typ: z.enum(['wiersz', 'kolumna', 'warstwy']),
  dzieci: z.array(wezel),
});

const rozmiarKarty = z.discriminatedUnion('tryb', [
  obj({
    tryb: z.literal('sloty'),
    slot: obj({ szerokosc: liczba.positive(), wysokosc: liczba.positive() }),
    kolumny: liczba.int().min(1),
    rzedy: liczba.int().min(1),
  }),
  obj({ tryb: z.literal('mm'), szerokosc: liczba.positive(), wysokosc: liczba.positive() }),
]);

const szablon = obj({
  id: identyfikator,
  nazwa: z.string(),
  rozmiar: rozmiarKarty,
  korzen: kontener,
  parametry: z
    .array(obj({ klucz: z.string(), nazwa: z.string(), domyslnie: z.string() }))
    .optional(),
  warianty: z
    .array(obj({ kolumny: liczba.int().min(1), rzedy: liczba.int().min(1), korzen: kontener }))
    .optional(),
});

const karta = obj({
  id: identyfikator,
  szablonId: identyfikator,
  dane: z.record(z.string(), z.string()),
  ilosc: liczba.int().min(0),
  rozmiar: obj({ kolumny: liczba.int().min(1), rzedy: liczba.int().min(1) }).optional(),
  obrazy: z.record(z.string(), obj({})).optional(),
});

const talia = obj({
  id: identyfikator,
  nazwa: z.string(),
  karty: z.array(karta),
  grupy: z
    .array(
      obj({
        id: identyfikator,
        naglowek: z.string(),
        opis: z.string().optional(),
        karty: z.array(z.string()),
      }),
    )
    .optional(),
});

const arkusz = obj({
  id: identyfikator,
  nazwa: z.string(),
  taliaId: identyfikator,
  ustawienia: obj({
    papier: z.enum(['A4', 'Letter']),
    orientacja: z.enum(['pionowa', 'pozioma']),
    marginesy: obj({ gora: liczba, prawo: liczba, dol: liczba, lewo: liczba }),
    linie: obj({ grubosc: nieujemna, kolor: z.string(), kreska: liczba, przerwa: liczba }),
  }),
  przypiete: z
    .array(
      obj({
        kartaId: identyfikator,
        kolumna: liczba.int().min(0),
        rzad: liczba.int().min(0),
        strona: liczba.int().min(0).optional(),
      }),
    )
    .optional(),
});

const opisZasobu = z.discriminatedUnion('rodzaj', [
  obj({
    rodzaj: z.literal('obraz'),
    id: idZasobu,
    nazwa: z.string(),
    format: z.enum(['png', 'jpg']),
    szerokosc: liczba.positive(),
    wysokosc: liczba.positive(),
  }),
  obj({
    rodzaj: z.literal('czcionka'),
    id: idZasobu,
    nazwa: z.string(),
    rodzina: z.string().min(1),
    wariant: z.enum(['normalny', 'pogrubiony', 'kursywa', 'pogrubiona-kursywa']),
    format: z.enum(['ttf', 'otf', 'woff', 'woff2']),
    zrodlo: z.enum(['wbudowana', 'google', 'wlasna']),
  }),
]);

export const schematProjektu = obj({
  wersja: liczba.int(),
  id: identyfikator,
  nazwa: z.string(),
  utworzono: z.string(),
  zmieniono: z.string(),
  role: z.record(z.string(), z.string()),
  zasoby: z.array(opisZasobu),
  szablony: z.array(szablon),
  talie: z.array(talia),
  arkusze: z.array(arkusz),
});

export const schematSzablonu = szablon;
export const schematOpisuZasobu = opisZasobu;

function sciezka(p: PropertyKey[]): string {
  return p.length ? p.map(String).join('.') : '(korzeń)';
}

/** Sprawdza dane schematem; błąd zamienia na czytelny komunikat z miejscem w pliku. */
export function sprawdz<T>(schemat: z.ZodType<T>, dane: unknown): T {
  const wynik = schemat.safeParse(dane);
  if (wynik.success) return wynik.data;
  const pierwszy = wynik.error.issues[0];
  throw new BladDanych(
    t('dane.niepoprawnaStruktura', {
      sciezka: sciezka(pierwszy?.path ?? []),
      komunikat: pierwszy?.message ?? '',
    }),
  );
}

/** Migracje: klucz `n` zamienia dane ze schematu `n` na schemat `n + 1`. Na razie brak. */
const MIGRACJE: Record<number, (dane: Record<string, unknown>) => Record<string, unknown>> = {};

export function migruj(surowe: unknown): unknown {
  if (typeof surowe !== 'object' || surowe === null || Array.isArray(surowe)) {
    throw new BladDanych(t('dane.brakWersji'));
  }
  let dane = surowe as Record<string, unknown>;
  const wersja = dane.wersja;
  if (typeof wersja !== 'number' || !Number.isInteger(wersja) || wersja < 1) {
    throw new BladDanych(t('dane.brakWersji'));
  }
  if (wersja > WERSJA_SCHEMATU) throw new BladDanych(t('dane.nowszaWersja', { wersja }));
  for (let w = wersja; w < WERSJA_SCHEMATU; w++) {
    const krok = MIGRACJE[w];
    if (!krok) throw new BladDanych(t('dane.brakWersji'));
    dane = { ...krok(dane), wersja: w + 1 };
  }
  return dane;
}

function powtorzenia(ids: string[]): string | undefined {
  const widziane = new Set<string>();
  for (const id of ids) {
    if (widziane.has(id)) return id;
    widziane.add(id);
  }
  return undefined;
}

function zasobyPol(w: Wezel, wynik: string[]): void {
  if ('dzieci' in w) for (const d of w.dzieci) zasobyPol(d, wynik);
  else if (w.typ === 'obraz' && w.zasob) wynik.push(w.zasob);
}

/** Identyfikatory zasobów obrazów wskazanych stałymi w szablonie. */
export function zasobySzablonu(s: Szablon): string[] {
  const wynik: string[] = [];
  zasobyPol(s.korzen, wynik);
  for (const w of s.warianty ?? []) zasobyPol(w.korzen, wynik);
  return wynik;
}

/** Sprawdza powiązania między elementami projektu (identyfikatory, odwołania do zasobów). */
export function sprawdzSpojnosc(p: Projekt): void {
  const blad = (opis: string) => {
    throw new BladDanych(t('dane.zlaSpojnosc', { opis }));
  };
  for (const [gdzie, ids] of [
    ['zasoby', p.zasoby.map((z) => z.id)],
    ['szablony', p.szablony.map((s) => s.id)],
    ['talie', p.talie.map((x) => x.id)],
    ['arkusze', p.arkusze.map((a) => a.id)],
  ] as const) {
    const id = powtorzenia([...ids]);
    if (id !== undefined) blad(t('dane.powtorzonyId', { id, gdzie }));
  }
  const szablony = new Set(p.szablony.map((s) => s.id));
  const talie = new Set(p.talie.map((x) => x.id));
  const zasoby = new Set(p.zasoby.map((z) => z.id));
  const rodziny = new Set(p.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])));
  for (const [rola, rodzina] of Object.entries(p.role)) {
    if (!rodziny.has(rodzina)) blad(t('dane.nieznanaRodzina', { rola, rodzina }));
  }
  for (const s of p.szablony) {
    for (const id of zasobySzablonu(s)) {
      if (!zasoby.has(id)) blad(t('dane.nieznanyZasob', { gdzie: `szablon ${s.id}`, id }));
    }
  }
  for (const talia of p.talie) {
    const idKart = talia.karty.map((k) => k.id);
    const id = powtorzenia(idKart);
    if (id !== undefined) blad(t('dane.powtorzonyId', { id, gdzie: `talia ${talia.id}` }));
    for (const k of talia.karty) {
      if (!szablony.has(k.szablonId)) {
        blad(t('dane.nieznanySzablon', { karta: k.id, szablon: k.szablonId }));
      }
    }
    for (const g of talia.grupy ?? []) {
      for (const kartaId of g.karty) {
        if (!idKart.includes(kartaId)) {
          blad(t('dane.nieznanaKartaWGrupie', { grupa: g.id, karta: kartaId }));
        }
      }
    }
  }
  for (const a of p.arkusze) {
    if (!talie.has(a.taliaId)) blad(t('dane.nieznanaTalia', { arkusz: a.id, talia: a.taliaId }));
  }
}

/** Migruje, sprawdza kształt i spójność – wspólne wejście dla pliku i bazy. */
export function przygotujProjekt(surowe: unknown): Projekt {
  const projekt = sprawdz(schematProjektu, migruj(surowe)) as unknown as Projekt;
  sprawdzSpojnosc(projekt);
  return projekt;
}
