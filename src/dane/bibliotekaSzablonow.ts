import type { Projekt } from '../model/projekt';
import type { Rewers, Szablon } from '../model/szablon';
import { czcionkiSzablonu } from './archiwum';
import { stabilnyJson } from './biblioteka';
import { skrotBajtow } from './bibliotekaUzytkownika';

/** Rodzaj wpisu w tabeli `szablony` (biblioteka szablonów, Plan S). */
export type RodzajSzablonu = 'awers' | 'rewers';

/**
 * Rekord w bibliotece szablonów użytkownika (Dexie tabela `szablony`, wersja 6).
 * Przechowuje pełny dokument szablonu (przodu) albo tyłu (rewersu), używane role czcionek
 * i skrót treści (`hash`) do deduplikacji oraz wykrywania nowszych wersji w projektach.
 */
export interface WpisSzablonu {
  id: string;
  rodzaj: RodzajSzablonu;
  nazwa: string;
  zmieniono: string;
  /** Skrót SHA-256 treści (bez `id`, `nazwa`, dat, `zrodlo`, `rewersId`, `podklad`). */
  hash: string;
  /** Role czcionek używane przez szablon albo tył (np. `{ tytul: 'Inter', tresc: 'Inter' }`). */
  role: Record<string, string>;
  /** Pełny dokument szablonu przodu (gdy `rodzaj === 'awers'`). */
  szablon?: Szablon;
  /** Pełny dokument tyłu (gdy `rodzaj === 'rewers'`). */
  rewers?: Rewers;
  /** Opcjonalny przypięty tył z biblioteki szablonów (id rekordu `rewers`) – tylko dla `awers`. */
  domyslnyRewersId?: string;
}

/** Techniczny limit liczby wpisów w bibliotece szablonów. */
export const MAKS_SZABLONOW_BIBLIOTEKI = 2000;

/**
 * Skrót SHA-256 treści szablonu albo tyłu – bez identyfikatora, nazwy, dat, źródła,
 * przypisanego rewersu projektu ani podkładu. Identyczne układy mają ten sam skrót.
 */
export async function skrotSzablonu(dokument: Szablon | Rewers): Promise<string> {
  const kopia: Record<string, unknown> = { ...dokument };
  delete kopia.id;
  delete kopia.nazwa;
  delete kopia.rewersId;
  delete kopia.podklad;
  delete kopia.zrodlo;
  return skrotBajtow(new TextEncoder().encode(stabilnyJson(kopia)));
}

/** Zwraca podzbiór ról czcionek projektu używanych przez dany szablon lub tył. */
export function roleSzablonu(
  dokument: Szablon | Rewers,
  roleProjektu: Record<string, string>,
): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const nazwa of new Set(czcionkiSzablonu(dokument))) {
    const rodzina = roleProjektu[nazwa];
    if (rodzina !== undefined) wynik[nazwa] = rodzina;
  }
  return wynik;
}

const kluczNazwy = (nazwa: string) => nazwa.trim().toLocaleLowerCase('pl');

/**
 * Unikalna nazwa szablonu w bibliotece: jeśli `nazwa` jest już zajęta (bez rozróżniania
 * wielkości liter), dopisuje kolejny sufiks „(2)”, „(3)”…
 */
export function unikalnaNazwaSzablonu(nazwa: string, zajete: ReadonlySet<string>): string {
  const baza = nazwa.trim() || 'Szablon';
  const znormalizowane = new Set([...zajete].map(kluczNazwy));
  if (!znormalizowane.has(kluczNazwy(baza))) return baza;
  let n = 2;
  while (znormalizowane.has(kluczNazwy(`${baza} (${n})`))) n++;
  return `${baza} (${n})`;
}

/** Kopia szablonu przygotowana do zapisu w bibliotece (bez `zrodlo`, `rewersId` i `podklad`). */
export function oczyscSzablonDoBiblioteki(s: Szablon, id: string, nazwa: string): Szablon {
  const kopia = structuredClone(s);
  delete kopia.zrodlo;
  delete kopia.rewersId;
  delete kopia.podklad;
  return { ...kopia, id, nazwa };
}

/** Kopia tyłu przygotowana do zapisu w bibliotece (bez `zrodlo`). */
export function oczyscRewersDoBiblioteki(r: Rewers, id: string, nazwa: string): Rewers {
  const kopia = structuredClone(r);
  delete kopia.zrodlo;
  return { ...kopia, id, nazwa };
}

/** Czy szablon przodu jest używany przez choć jedną kartę lub własną kartkę w projekcie. */
export function czySzablonUzywanyWProjekcie(projekt: Projekt, szablonId: string): boolean {
  if (projekt.talie.some((tl) => tl.karty.some((k) => k.szablonId === szablonId))) return true;
  if (projekt.arkusze.some((a) => a.wlasnySzablonId === szablonId)) return true;
  return false;
}

/** Czy tył jest przypisany do zachowanego szablonu, talii albo karty w projekcie. */
export function czyRewersUzywanyWProjekcie(
  projekt: Projekt,
  rewersId: string,
  zachowaneSzablony: readonly Szablon[],
): boolean {
  if (zachowaneSzablony.some((s) => s.rewersId === rewersId)) return true;
  if (
    projekt.talie.some(
      (tl) => tl.rewersId === rewersId || tl.karty.some((k) => k.rewersId === rewersId),
    )
  ) {
    return true;
  }
  return false;
}
