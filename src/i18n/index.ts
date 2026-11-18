import {
  pl,
  plMnoga,
  type KluczMnogi,
  type KluczTekstu,
  type Slownik,
  type SlownikMnogi,
} from './pl';
import { en, enMnoga } from './en';
import { jezykDomyslny, KLUCZ_JEZYKA } from '../wspolne/ustawienia';

export type { KluczMnogi, KluczTekstu, Slownik, SlownikMnogi };

export type Jezyk = 'pl' | 'en';

export const JEZYKI: readonly Jezyk[] = ['pl', 'en'];

export { jezykDomyslny, KLUCZ_JEZYKA };

const slowniki: Record<Jezyk, Slownik> = { pl, en };
const slownikiMnogie: Record<Jezyk, SlownikMnogi> = { pl: plMnoga, en: enMnoga };

export function czyJezyk(v: unknown): v is Jezyk {
  return v === 'pl' || v === 'en';
}

/** Wybór z tej sesji strony, gdy zapis do localStorage się nie udał (np. tryb prywatny). */
let pamiecSesji: Jezyk | undefined;

function jezykPrzegladarki(): string | undefined {
  try {
    return typeof navigator === 'undefined' ? undefined : navigator.language;
  } catch {
    return undefined;
  }
}

/** Zapamiętany wybór; przy braku, błędnej wartości lub zablokowanym localStorage – z przeglądarki. */
export function odczytajJezyk(): Jezyk {
  if (pamiecSesji) return pamiecSesji;
  try {
    const v = globalThis.localStorage?.getItem(KLUCZ_JEZYKA);
    if (czyJezyk(v)) return v;
  } catch {
    // Zablokowany localStorage – język z przeglądarki.
  }
  return jezykDomyslny(jezykPrzegladarki());
}

let aktywnyJezyk: Jezyk = odczytajJezyk();

const sluchacze = new Set<() => void>();

function zastosuj(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = aktywnyJezyk;
    document.title = slowniki[aktywnyJezyk]['aplikacja.nazwa'];
  }
}

function powiadom(): void {
  const nowy = odczytajJezyk();
  const zmiana = nowy !== aktywnyJezyk;
  aktywnyJezyk = nowy;
  zastosuj();
  if (zmiana) sluchacze.forEach((s) => s());
}

/** Zapisuje wybór (best-effort), ustawia `lang` na <html> i powiadamia subskrybentów. */
export function ustawJezyk(jezyk: Jezyk): void {
  pamiecSesji = undefined;
  try {
    globalThis.localStorage?.setItem(KLUCZ_JEZYKA, jezyk);
  } catch {
    pamiecSesji = jezyk;
  }
  aktywnyJezyk = jezyk;
  zastosuj();
  sluchacze.forEach((s) => s());
}

export function jezyk(): Jezyk {
  return aktywnyJezyk;
}

/** Subskrypcja zmian języka (dla `useSyncExternalStore`). */
export function subskrybujJezyk(cb: () => void): () => void {
  sluchacze.add(cb);
  return () => sluchacze.delete(cb);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  zastosuj();
  // Zmiana wyboru w innej karcie przeglądarki.
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === KLUCZ_JEZYKA) powiadom();
  });
}

function podstaw(tekst: string, parametry?: Record<string, string | number>): string {
  if (!parametry) return tekst;
  return tekst.replace(/\{(\w+)\}/g, (calosc, nazwa: string) =>
    nazwa in parametry ? String(parametry[nazwa]) : calosc,
  );
}

/**
 * Zwraca przetłumaczony tekst. Parametry `{nazwa}` są zastępowane wartościami z `parametry`;
 * parametr bez wartości zostaje w tekście bez zmian, żeby błąd był widoczny.
 */
export function t(klucz: KluczTekstu, parametry?: Record<string, string | number>): string {
  return podstaw(slowniki[aktywnyJezyk][klucz], parametry);
}

/** Tekst dla klucza zbudowanego dynamicznie (np. `pole.<klucz danych>`), gdy istnieje. */
export function tJesliJest(klucz: string): string | undefined {
  const slownik: Record<string, string> = slowniki[aktywnyJezyk];
  return Object.hasOwn(slownik, klucz) ? slownik[klucz] : undefined;
}

/**
 * Tekst z liczbą mnogą: forma według `Intl.PluralRules` języka (PL: one/few/many/other,
 * EN: one/other). Parametr `{n}` dostaje liczbę sformatowaną w bieżącym języku; pozostałe
 * parametry jak w `t`.
 */
export function tn(
  klucz: KluczMnogi,
  n: number,
  parametry?: Record<string, string | number>,
): string {
  const formy = slownikiMnogie[aktywnyJezyk][klucz];
  const kategoria = pluralRules().select(n);
  const tekst = formy[kategoria] ?? formy.other;
  return podstaw(tekst, { n: liczbaFmt('tn').format(n), ...parametry });
}

const bufor = new Map<string, Intl.PluralRules | Intl.NumberFormat | Intl.DateTimeFormat>();

/** Formatery Intl są drogie w tworzeniu – jeden na język i zestaw opcji. */
function zBufora<T extends Intl.PluralRules | Intl.NumberFormat | Intl.DateTimeFormat>(
  klucz: string,
  utworz: () => T,
): T {
  const k = `${aktywnyJezyk}|${klucz}`;
  let f = bufor.get(k) as T | undefined;
  if (!f) {
    f = utworz();
    bufor.set(k, f);
  }
  return f;
}

const pluralRules = () => zBufora('plural', () => new Intl.PluralRules(aktywnyJezyk));

function liczbaFmt(rodzaj: string, min = 0, max = 3): Intl.NumberFormat {
  return zBufora(
    `liczba|${rodzaj}|${min}|${max}`,
    () =>
      new Intl.NumberFormat(aktywnyJezyk, {
        minimumFractionDigits: min,
        maximumFractionDigits: max,
        useGrouping: rodzaj !== 'bez',
        // Bez „-0” po zaokrągleniu małych liczb ujemnych.
        signDisplay: rodzaj === 'bez' ? 'negative' : 'auto',
      }),
  );
}

/** Liczba w bieżącym języku (PL: przecinek, EN: kropka), co najwyżej `miejsca` cyfr po przecinku. */
export function formatujLiczbe(x: number, miejsca = 1): string {
  return liczbaFmt('bez', 0, miejsca).format(x);
}

/** Liczba z co najmniej jedną cyfrą po przecinku (np. „2,0”). */
export function formatujLiczbeZUlamkiem(x: number, miejsca = 1): string {
  return liczbaFmt('bez', 1, miejsca).format(x);
}

/** Data i godzina w bieżącym języku. */
export function formatujDate(wartosc: Date | number | string): string {
  return zBufora(
    'data',
    () => new Intl.DateTimeFormat(aktywnyJezyk, { dateStyle: 'medium', timeStyle: 'short' }),
  ).format(new Date(wartosc));
}
