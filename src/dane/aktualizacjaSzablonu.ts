import type { Projekt } from '../model/projekt';
import {
  czyKontener,
  type Karta,
  type Rewers,
  type Szablon,
  wszystkieWezly,
} from '../model/szablon';
import type { WpisSzablonu } from './bibliotekaSzablonow';
import { unikalneId } from './czcionki';
import { kolumnySzablonu } from './edycja';
import { rewersKarty } from './rewers';

/** Informacja o nowszej wersji szablonu lub tyłu w „Moich szablonach” względem kopii w projekcie. */
export interface NowaWersjaSzablonu {
  rodzaj: 'awers' | 'rewers';
  /** Id kopii w projekcie (`Szablon.id` albo `Rewers.id`). */
  idWProjekcie: string;
  nazwaWProjekcie: string;
  /** Aktualny rekord z tabeli `szablony` (inny `hash` niż `kopia.zrodlo.hash`). */
  wpisBiblioteki: WpisSzablonu;
  /** Liczba kart w projekcie korzystających z tej kopii szablonu albo tyłu. */
  liczbaKart: number;
}

/** Wynik dopasowania pól danych między dwoma szablonami (do aktualizacji lub przeniesienia kart). */
export interface DopasowaniePol {
  /** Mapowanie: stary klucz danych → nowy klucz danych. */
  mapaKluczy: Map<string, string>;
  /** Pola dopasowane (przeniesione). */
  przeniesione: { staryKlucz: string; nowyKlucz: string; nazwa: string }[];
  /** Pola starego szablonu bez odpowiednika w nowym (zostaną pominięte). */
  pominiete: { klucz: string; nazwa: string }[];
  /** Nowe pola, których nie było w starym szablonie (zostaną puste). */
  nowe: { klucz: string; nazwa: string }[];
}

const normalizujNazwe = (s: string) => s.trim().toLocaleLowerCase('pl');

/**
 * Wykrywa kopie szablonów i tyłów w projekcie, dla których w „Moich szablonach” istnieje rekord
 * o tym samym `zrodlo.id`, ale innym `hash`. Usunięte z „Moich szablonów” rekordy są pomijane
 * (projekt nadal działa na własnej kopii).
 */
export function wykryjNowszeWersje(
  projekt: Projekt,
  wpisyBiblioteki: readonly WpisSzablonu[],
): NowaWersjaSzablonu[] {
  const poId = new Map(wpisyBiblioteki.map((w) => [w.id, w] as const));
  const wynik: NowaWersjaSzablonu[] = [];

  for (const s of projekt.szablony) {
    if (!s.zrodlo) continue;
    const wpis = poId.get(s.zrodlo.id);
    if (!wpis || wpis.rodzaj !== 'awers' || !wpis.szablon) continue;
    if (wpis.hash === s.zrodlo.hash) continue;
    let liczbaKart = 0;
    for (const tl of projekt.talie) {
      for (const k of tl.karty) {
        if (k.szablonId === s.id) liczbaKart++;
      }
    }
    wynik.push({
      rodzaj: 'awers',
      idWProjekcie: s.id,
      nazwaWProjekcie: s.nazwa,
      wpisBiblioteki: wpis,
      liczbaKart,
    });
  }

  const szablonyPoId = new Map(projekt.szablony.map((s) => [s.id, s] as const));
  const rewersyPoId = new Map((projekt.rewersy ?? []).map((r) => [r.id, r] as const));
  for (const r of projekt.rewersy ?? []) {
    if (!r.zrodlo) continue;
    const wpis = poId.get(r.zrodlo.id);
    if (!wpis || wpis.rodzaj !== 'rewers' || !wpis.rewers) continue;
    if (wpis.hash === r.zrodlo.hash) continue;
    let liczbaKart = 0;
    for (const tl of projekt.talie) {
      for (const k of tl.karty) {
        const aktywny = rewersKarty(rewersyPoId, k, szablonyPoId.get(k.szablonId) ?? {}, tl);
        if (aktywny?.id === r.id) liczbaKart++;
      }
    }
    wynik.push({
      rodzaj: 'rewers',
      idWProjekcie: r.id,
      nazwaWProjekcie: r.nazwa,
      wpisBiblioteki: wpis,
      liczbaKart,
    });
  }

  return wynik;
}

/**
 * Dopasowuje kolumny danych starego szablonu do nowego:
 * 1) najpierw dokładne dopasowanie po kluczu (`klucz`),
 * 2) następnie po znormalizowanej nazwie pola (`nazwa`, bez wielkości liter).
 */
export function dopasujPolaSzablonow(stary: Szablon, nowy: Szablon): DopasowaniePol {
  const kolStare = kolumnySzablonu(stary);
  const kolNowe = kolumnySzablonu(nowy);
  const nowePoKluczu = new Map(kolNowe.map((k) => [k.klucz, k] as const));
  const mapaKluczy = new Map<string, string>();
  const zajeteNowe = new Set<string>();
  const przeniesione: DopasowaniePol['przeniesione'] = [];
  const niedopasowaneStare: typeof kolStare = [];

  // Przebieg 1: dokładny klucz.
  for (const st of kolStare) {
    const cel = nowePoKluczu.get(st.klucz);
    if (cel) {
      mapaKluczy.set(st.klucz, cel.klucz);
      zajeteNowe.add(cel.klucz);
      przeniesione.push({ staryKlucz: st.klucz, nowyKlucz: cel.klucz, nazwa: cel.nazwa });
    } else {
      niedopasowaneStare.push(st);
    }
  }

  // Przebieg 2: dopasowanie po nazwie pola.
  const pominiete: DopasowaniePol['pominiete'] = [];
  for (const st of niedopasowaneStare) {
    const celNazwa = normalizujNazwe(st.nazwa);
    const cel = kolNowe.find(
      (n) => !zajeteNowe.has(n.klucz) && normalizujNazwe(n.nazwa) === celNazwa,
    );
    if (cel) {
      mapaKluczy.set(st.klucz, cel.klucz);
      zajeteNowe.add(cel.klucz);
      przeniesione.push({ staryKlucz: st.klucz, nowyKlucz: cel.klucz, nazwa: cel.nazwa });
    } else {
      pominiete.push({ klucz: st.klucz, nazwa: st.nazwa });
    }
  }

  const nowe = kolNowe
    .filter((n) => !zajeteNowe.has(n.klucz))
    .map((n) => ({ klucz: n.klucz, nazwa: n.nazwa }));

  return { mapaKluczy, przeniesione, pominiete, nowe };
}

/** Przepisuje słownik `karta.dane` według dopasowania pól (pomija pola bez odpowiednika). */
function przepiszDaneKarty(
  dane: Record<string, string>,
  dopasowanie: DopasowaniePol,
): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const [klucz, wartosc] of Object.entries(dane)) {
    const cel = dopasowanie.mapaKluczy.get(klucz);
    if (cel !== undefined) wynik[cel] = wartosc;
  }
  return wynik;
}

/** Mapa staryPoleId → nowyPoleId dla pól obrazu (po dopasowanym kluczu lub tym samym id). */
function mapaPolObrazow(
  stary: Szablon,
  nowy: Szablon,
  dopasowanie: DopasowaniePol,
): Map<string, string> {
  const nowePoKluczu = new Map<string, string>();
  const noweIds = new Set<string>();
  for (const w of wszystkieWezly(nowy)) {
    if (!czyKontener(w) && w.typ === 'obraz') {
      noweIds.add(w.id);
      if (w.klucz) nowePoKluczu.set(w.klucz, w.id);
    }
  }
  const mapa = new Map<string, string>();
  for (const w of wszystkieWezly(stary)) {
    if (czyKontener(w) || w.typ !== 'obraz') continue;
    const nowyKlucz = w.klucz ? dopasowanie.mapaKluczy.get(w.klucz) : undefined;
    const celPoKluczu = nowyKlucz ? nowePoKluczu.get(nowyKlucz) : undefined;
    if (celPoKluczu) mapa.set(w.id, celPoKluczu);
    else if (noweIds.has(w.id)) mapa.set(w.id, w.id);
  }
  return mapa;
}

function przepiszObrazyKarty(
  karta: Karta,
  starySzablon: Szablon,
  nowySzablon: Szablon,
  dopasowanie: DopasowaniePol,
): Karta['obrazy'] {
  if (!karta.obrazy) return undefined;
  const mapa = mapaPolObrazow(starySzablon, nowySzablon, dopasowanie);
  const wynik: NonNullable<Karta['obrazy']> = {};
  for (const [id, u] of Object.entries(karta.obrazy)) {
    const cel = mapa.get(id);
    if (cel) wynik[cel] = u;
  }
  return Object.keys(wynik).length > 0 ? wynik : undefined;
}

/** Scala brakujące role czcionek z wpisu biblioteki do ról projektu (istniejące role projektu zostają). */
function scalRole(
  roleProjektu: Record<string, string>,
  roleWpisu: Record<string, string>,
): Record<string, string> {
  const wynik = { ...roleProjektu };
  for (const [rola, rodzina] of Object.entries(roleWpisu)) {
    if (wynik[rola] === undefined) wynik[rola] = rodzina;
  }
  return wynik;
}

/**
 * Dodaje kopię szablonu przodu z „Moich szablonów” do projektu, ustawia `zrodlo: { id, hash }`
 * oraz (opcjonalnie) dołącza kopię jego domyślnego tyłu.
 */
export function dodajKopieSzablonuDoProjektu(
  projekt: Projekt,
  wpis: WpisSzablonu,
  opcje: { domyslnyRewers?: WpisSzablonu } = {},
): { projekt: Projekt; szablonId: string; rewersId?: string } {
  if (wpis.rodzaj !== 'awers' || !wpis.szablon) {
    throw new Error(`Wpis „${wpis.id}” nie jest szablonem przodu.`);
  }
  let aktualny = projekt;
  let rewersId: string | undefined;
  if (opcje.domyslnyRewers?.rodzaj === 'rewers' && opcje.domyslnyRewers.rewers) {
    const istniejacyTyl = (aktualny.rewersy ?? []).find(
      (r) => r.zrodlo?.id === opcje.domyslnyRewers!.id,
    );
    if (istniejacyTyl) {
      rewersId = istniejacyTyl.id;
    } else {
      const dodanyTyl = dodajKopieRewersuDoProjektu(aktualny, opcje.domyslnyRewers);
      aktualny = dodanyTyl.projekt;
      rewersId = dodanyTyl.rewersId;
    }
  }
  const zajete = new Set(aktualny.szablony.map((s) => s.id));
  const noweId = unikalneId(wpis.szablon.id, zajete);
  const kopia: Szablon = {
    ...structuredClone(wpis.szablon),
    id: noweId,
    nazwa: wpis.nazwa,
    zrodlo: { id: wpis.id, hash: wpis.hash },
    ...(rewersId ? { rewersId } : {}),
  };
  return {
    projekt: {
      ...aktualny,
      zmieniono: new Date().toISOString(),
      role: scalRole(aktualny.role, wpis.role),
      szablony: [...aktualny.szablony, kopia],
    },
    szablonId: noweId,
    ...(rewersId ? { rewersId } : {}),
  };
}

/**
 * Dodaje kopię tyłu (rewersu) z „Moich szablonów” do projektu i ustawia `zrodlo: { id, hash }`.
 */
export function dodajKopieRewersuDoProjektu(
  projekt: Projekt,
  wpis: WpisSzablonu,
): { projekt: Projekt; rewersId: string } {
  if (wpis.rodzaj !== 'rewers' || !wpis.rewers) {
    throw new Error(`Wpis „${wpis.id}” nie jest szablonem tyłu.`);
  }
  const obecne = projekt.rewersy ?? [];
  const zajete = new Set(obecne.map((r) => r.id));
  const noweId = unikalneId(wpis.rewers.id, zajete);
  const kopia: Rewers = {
    ...structuredClone(wpis.rewers),
    id: noweId,
    nazwa: wpis.nazwa,
    zrodlo: { id: wpis.id, hash: wpis.hash },
  };
  return {
    projekt: {
      ...projekt,
      zmieniono: new Date().toISOString(),
      role: scalRole(projekt.role, wpis.role),
      rewersy: [...obecne, kopia],
    },
    rewersId: noweId,
  };
}

/**
 * Podmienia kopię szablonu przodu w projekcie na nowszą wersję z „Moich szablonów”.
 * Zachowuje lokalne `id`, `rewersId`, `podklad` oraz dane kart (pola dopasowywane po kluczu
 * i nazwie). Zwraca nowy projekt, raport dopasowania pól i liczbę zaktualizowanych kart.
 */
export function aktualizujSzablonWProjekcie(
  projekt: Projekt,
  szablonIdWProjekcie: string,
  wpisBiblioteki: WpisSzablonu,
): { projekt: Projekt; dopasowanie: DopasowaniePol; zaktualizowaneKarty: number } {
  if (wpisBiblioteki.rodzaj !== 'awers' || !wpisBiblioteki.szablon) {
    throw new Error(`Wpis „${wpisBiblioteki.id}” nie jest szablonem przodu.`);
  }
  const stary = projekt.szablony.find((s) => s.id === szablonIdWProjekcie);
  if (!stary) {
    throw new Error(`Brak szablonu „${szablonIdWProjekcie}” w projekcie.`);
  }
  const nowaKopia: Szablon = {
    ...structuredClone(wpisBiblioteki.szablon),
    id: stary.id,
    nazwa: wpisBiblioteki.nazwa,
    zrodlo: { id: wpisBiblioteki.id, hash: wpisBiblioteki.hash },
    ...(stary.rewersId !== undefined ? { rewersId: stary.rewersId } : {}),
    ...(stary.podklad ? { podklad: stary.podklad } : {}),
  };
  const dopasowanie = dopasujPolaSzablonow(stary, nowaKopia);
  let zaktualizowaneKarty = 0;
  const talie = projekt.talie.map((tl) => ({
    ...tl,
    karty: tl.karty.map((k) => {
      if (k.szablonId !== stary.id) return k;
      zaktualizowaneKarty++;
      const obrazy = przepiszObrazyKarty(k, stary, nowaKopia, dopasowanie);
      const { obrazy: _o, ...bezObrazow } = k;
      void _o;
      return {
        ...bezObrazow,
        dane: przepiszDaneKarty(k.dane, dopasowanie),
        ...(obrazy ? { obrazy } : {}),
      };
    }),
  }));

  return {
    projekt: {
      ...projekt,
      zmieniono: new Date().toISOString(),
      role: scalRole(projekt.role, wpisBiblioteki.role),
      szablony: projekt.szablony.map((s) => (s.id === stary.id ? nowaKopia : s)),
      talie,
    },
    dopasowanie,
    zaktualizowaneKarty,
  };
}

/**
 * Podmienia kopię tyłu (rewersu) w projekcie na nowszą wersję z „Moich szablonów”.
 * Zachowuje lokalne `id` (wszystkie przypisania `rewersId` w projekcie pozostają ważne).
 */
export function aktualizujRewersWProjekcie(
  projekt: Projekt,
  rewersIdWProjekcie: string,
  wpisBiblioteki: WpisSzablonu,
): Projekt {
  if (wpisBiblioteki.rodzaj !== 'rewers' || !wpisBiblioteki.rewers) {
    throw new Error(`Wpis „${wpisBiblioteki.id}” nie jest szablonem tyłu.`);
  }
  const stary = (projekt.rewersy ?? []).find((r) => r.id === rewersIdWProjekcie);
  if (!stary) {
    throw new Error(`Brak tyłu „${rewersIdWProjekcie}” w projekcie.`);
  }
  const nowaKopia: Rewers = {
    ...structuredClone(wpisBiblioteki.rewers),
    id: stary.id,
    nazwa: wpisBiblioteki.nazwa,
    zrodlo: { id: wpisBiblioteki.id, hash: wpisBiblioteki.hash },
  };
  return {
    ...projekt,
    zmieniono: new Date().toISOString(),
    role: scalRole(projekt.role, wpisBiblioteki.role),
    rewersy: (projekt.rewersy ?? []).map((r) => (r.id === stary.id ? nowaKopia : r)),
  };
}

/**
 * Przenosi zaznaczone karty na inny szablon obecny w projekcie (Plan S, D-S7).
 * Dane kart przechodzą po kluczach/nazwach pól; pola bez odpowiednika zostają puste.
 * Szablony w projekcie nie ulegają zmianie.
 */
export function przeniesKartyNaSzablon(
  projekt: Projekt,
  kartaIds: ReadonlySet<string>,
  docelowySzablonId: string,
): { projekt: Projekt; przeniesioneKarty: number } {
  const docelowy = projekt.szablony.find((s) => s.id === docelowySzablonId);
  if (!docelowy) {
    throw new Error(`Brak szablonu docelowego „${docelowySzablonId}” w projekcie.`);
  }
  const szablonyPoId = new Map(projekt.szablony.map((s) => [s.id, s] as const));
  const dopasowania = new Map<string, DopasowaniePol>();
  const dopasowanieDla = (zrodlowyId: string): DopasowaniePol | undefined => {
    if (dopasowania.has(zrodlowyId)) return dopasowania.get(zrodlowyId);
    const zr = szablonyPoId.get(zrodlowyId);
    if (!zr) return undefined;
    const d = dopasujPolaSzablonow(zr, docelowy);
    dopasowania.set(zrodlowyId, d);
    return d;
  };

  let przeniesioneKarty = 0;
  const talie = projekt.talie.map((tl) => ({
    ...tl,
    karty: tl.karty.map((k) => {
      if (!kartaIds.has(k.id) || k.szablonId === docelowySzablonId) return k;
      const zrodlowy = szablonyPoId.get(k.szablonId);
      const dop = dopasowanieDla(k.szablonId);
      if (!zrodlowy || !dop) return k;
      przeniesioneKarty++;
      const obrazy = przepiszObrazyKarty(k, zrodlowy, docelowy, dop);
      const { obrazy: _o, ...bezObrazow } = k;
      void _o;
      return {
        ...bezObrazow,
        szablonId: docelowySzablonId,
        dane: przepiszDaneKarty(k.dane, dop),
        ...(obrazy ? { obrazy } : {}),
      };
    }),
  }));

  return {
    projekt: {
      ...projekt,
      zmieniono: new Date().toISOString(),
      talie,
    },
    przeniesioneKarty,
  };
}
