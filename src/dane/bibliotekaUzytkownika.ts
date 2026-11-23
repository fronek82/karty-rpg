import type { OpisCzcionki, OpisObrazu, OpisZasobu, Projekt } from '../model/projekt';
import { czyKontener, type Szablon, wszystkieWezly } from '../model/szablon';
import type { ElementOzdobny } from '../ozdobniki/typy';
import {
  odwolaniaDoElementow,
  przepiszOdwolania,
  stabilnyJson,
  zasobyElementow,
} from './biblioteka';
import { zasobySzablonu } from './schemat';

/**
 * Jedna biblioteka zasobów użytkownika (N8): obrazy, czcionki i ozdobniki wspólne dla wszystkich
 * projektów w przeglądarce. Wpis trzyma metadane (lista nie ładuje bajtów); bajty obrazów
 * i czcionek leżą w osobnej tabeli pod tym samym id.
 */
export type RodzajWpisuBiblioteki = 'obraz' | 'czcionka' | 'ozdobnik';

export interface WpisBiblioteki {
  /** Unikalne w całej bibliotece; dla obrazów i czcionek równe `opis.id`, dla ozdobnika `element.id`. */
  id: string;
  rodzaj: RodzajWpisuBiblioteki;
  nazwa: string;
  /** Skrót treści (SHA-256) – ten sam plik to jeden wpis. */
  hash: string;
  /** Rozmiar bajtów (0 dla ozdobnika bez obrazu). */
  rozmiar: number;
  dodano: string;
  opis?: OpisObrazu | OpisCzcionki;
  element?: ElementOzdobny;
  /** Obraz ramki 9-slice – nie pokazuje się na liście obrazów ani w ich wyborach. */
  wewnetrzny?: boolean;
}

/** Techniczny limit liczby wpisów (ochrona przed zapchaniem bazy). */
export const MAKS_WPISOW_BIBLIOTEKI = 5000;

const hex = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Skrót SHA-256 bajtów (hex). */
export async function skrotBajtow(dane: Uint8Array): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', dane as Uint8Array<ArrayBuffer>));
}

/**
 * Skrót treści elementu ozdobnego – bez id i nazwy (ta sama treść pod inną nazwą to ten sam
 * element). Obraz ramki 9-slice wchodzi przez swoje id, które przed liczeniem skrótu jest już
 * kanonicznym id wpisu biblioteki (ten sam plik = to samo id).
 */
export async function skrotElementu(e: ElementOzdobny): Promise<string> {
  const { id: _id, nazwa: _nazwa, ...tresc } = e;
  void [_id, _nazwa];
  return skrotBajtow(new TextEncoder().encode(stabilnyJson(tresc)));
}

export const kluczCzcionki = (o: Pick<OpisCzcionki, 'rodzina' | 'wariant'>) =>
  `${o.rodzina.trim().toLowerCase()}\0${o.wariant}`;

/** Czcionki wbudowane (pakiet) zostają w projekcie – reszta zasobów należy do biblioteki. */
export const czyZasobProjektu = (o: OpisZasobu): boolean =>
  o.rodzaj === 'czcionka' && o.zrodlo === 'wbudowana';

/** Opis zasobu z wpisu biblioteki (id i nazwa z wpisu). */
export function opisZWpisu(w: WpisBiblioteki): OpisZasobu | undefined {
  return w.opis ? { ...w.opis, id: w.id, nazwa: w.nazwa } : undefined;
}

/** Element ozdobny z wpisu biblioteki (id i nazwa z wpisu). */
export function elementZWpisu(w: WpisBiblioteki): ElementOzdobny | undefined {
  return w.element ? { ...w.element, id: w.id, nazwa: w.nazwa } : undefined;
}

const zamien = (mapa: ReadonlyMap<string, string>, id: string) => mapa.get(id) ?? id;

function przepiszObrazySzablonu(s: Szablon, obrazy: ReadonlyMap<string, string>): void {
  if (s.teksturaTla) s.teksturaTla = zamien(obrazy, s.teksturaTla);
  if (s.podklad) s.podklad.zasob = zamien(obrazy, s.podklad.zasob);
  for (const w of wszystkieWezly(s)) {
    if (czyKontener(w)) {
      if (w.teksturaTla) w.teksturaTla = zamien(obrazy, w.teksturaTla);
    } else if (w.typ === 'obraz' && w.zasob) w.zasob = zamien(obrazy, w.zasob);
  }
}

/** Element z przepisanym id obrazu ramki 9-slice. */
export function przepiszObrazElementu(
  e: ElementOzdobny,
  obrazy: ReadonlyMap<string, string>,
): ElementOzdobny {
  const z = e.ramka9?.zrodlo;
  if (z?.typ !== 'obraz' || !obrazy.has(z.zasob)) return e;
  return { ...e, ramka9: { ...e.ramka9!, zrodlo: { ...z, zasob: obrazy.get(z.zasob)! } } };
}

/**
 * Kopia projektu z przepisanymi odwołaniami do obrazów (stałe obrazy, tekstury, podkłady,
 * wartości pól obrazu w kartach, obrazy ramek 9-slice) i do elementów ozdobnych.
 */
export function przepiszZasobyProjektu(
  p: Projekt,
  obrazy: ReadonlyMap<string, string>,
  elementy: ReadonlyMap<string, string>,
): Projekt {
  if (obrazy.size === 0 && elementy.size === 0) return p;
  const kopia = structuredClone(p);
  const strony: Szablon[] = [...kopia.szablony, ...(kopia.rewersy ?? [])];
  for (const s of strony) {
    przepiszObrazySzablonu(s, obrazy);
    przepiszOdwolania(s, elementy);
  }
  if (obrazy.size > 0) {
    const kluczeObrazow = new Map(
      kopia.szablony.map((s) => [
        s.id,
        wszystkieWezly(s).flatMap((w) =>
          !czyKontener(w) && w.typ === 'obraz' && w.klucz ? [w.klucz] : [],
        ),
      ]),
    );
    for (const tl of kopia.talie)
      for (const k of tl.karty)
        for (const klucz of kluczeObrazow.get(k.szablonId) ?? []) {
          const v = k.dane[klucz];
          if (v !== undefined && obrazy.has(v)) k.dane[klucz] = obrazy.get(v)!;
        }
  }
  const widziane = new Set<string>();
  kopia.zasoby = kopia.zasoby.flatMap((o) => {
    const id = o.rodzaj === 'obraz' ? zamien(obrazy, o.id) : o.id;
    if (widziane.has(id)) return [];
    widziane.add(id);
    return [{ ...o, id }];
  });
  if (kopia.biblioteka) {
    const ids = new Set<string>();
    kopia.biblioteka = {
      ozdobniki: kopia.biblioteka.ozdobniki.flatMap((e) => {
        const id = zamien(elementy, e.id);
        if (ids.has(id)) return [];
        ids.add(id);
        return [{ ...przepiszObrazElementu(e, obrazy), id }];
      }),
    };
  }
  return kopia;
}

/** Id obrazów, które są obrazami ramek 9-slice podanych elementów. */
export const obrazyRamek = (elementy: readonly ElementOzdobny[]): Set<string> =>
  new Set(zasobyElementow(elementy));

/**
 * Obrazy, których używa sam dokument projektu: stałe obrazy i tekstury szablonów i rewersów,
 * podkłady, wartości pól obrazu w kartach (bez obrazów ramek 9-slice).
 */
export function obrazyUzyteWDokumencie(p: Projekt): Set<string> {
  const wynik = new Set<string>();
  for (const s of [...p.szablony, ...(p.rewersy ?? [])])
    for (const id of zasobySzablonu(s)) wynik.add(id);
  for (const s of p.szablony) if (s.podklad) wynik.add(s.podklad.zasob);
  const klucze = new Map(
    p.szablony.map((s) => [
      s.id,
      wszystkieWezly(s).flatMap((w) =>
        !czyKontener(w) && w.typ === 'obraz' && w.klucz ? [w.klucz] : [],
      ),
    ]),
  );
  for (const tl of p.talie)
    for (const k of tl.karty)
      for (const klucz of klucze.get(k.szablonId) ?? []) {
        const v = k.dane[klucz];
        if (v) wynik.add(v);
      }
  return wynik;
}

/** Id elementów ozdobnych używanych w szablonach i rewersach projektu. */
export const elementyUzyteWDokumencie = (p: Projekt): Set<string> =>
  new Set([...p.szablony, ...(p.rewersy ?? [])].flatMap(odwolaniaDoElementow));
