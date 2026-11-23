import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  dodajRewersZPaczki,
  eksportujRewers,
  importujRewers,
  kluczTresciRewersuWPaczce,
} from '../dane/archiwum';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { kluczTresciSzablonu } from '../model/szablon';
import { baza } from './bazaUI';
import type { ProjektWEdycji } from './useProjekt';

const PRZEDROSTEK_KLUCZA = 'rewers:';
const KLUCZ_UKRYTYCH = 'karty-rpg:ukryte-rewersy';

/** Stabilny klucz wpisu w bibliotece globalnej dla rewersu z konkretnego projektu. */
export const kluczRewersuGlobalnego = (projektId: string, rewersId: string): string =>
  `${PRZEDROSTEK_KLUCZA}${projektId}:${rewersId}`;

function wczytajUkryte(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const surowy = localStorage.getItem(KLUCZ_UKRYTYCH);
    if (!surowy) return new Set();
    const lista = JSON.parse(surowy) as unknown;
    return Array.isArray(lista)
      ? new Set(lista.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function zapiszUkryte(ukryte: ReadonlySet<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (ukryte.size === 0) localStorage.removeItem(KLUCZ_UKRYTYCH);
    else localStorage.setItem(KLUCZ_UKRYTYCH, JSON.stringify([...ukryte]));
  } catch {
    // Brak lub zablokowane localStorage (np. tryb prywatny) – pomijamy.
  }
}

export interface ZapisanyRewersGlobalny {
  klucz: string;
  nazwa: string;
  zrodlo: 'biblioteka' | 'projekt';
  wpisId?: string;
  projektId?: string;
  rewersId?: string;
}

/** Zapisuje (lub aktualizuje) zaprojektowany rewers w lokalnej bibliotece rewersów przeglądarki. */
export async function zapiszRewersGlobalnie(
  projekt: Projekt,
  dane: DaneZasobow,
  rewersId: string,
): Promise<void> {
  const rewers = projekt.rewersy?.find((r) => r.id === rewersId);
  if (!rewers) return;
  const klucz = kluczRewersuGlobalnego(projekt.id, rewersId);
  const bajty = eksportujRewers(projekt, dane, rewersId);
  await baza().zapiszWBibliotece('rewers', rewers.nazwa, bajty, klucz);
  const ukryte = wczytajUkryte();
  if (ukryte.delete(klucz)) zapiszUkryte(ukryte);
}

/**
 * Zwraca listę rewersów dostępnych globalnie w przeglądarce (z biblioteki globalnej oraz z innych
 * projektów – dzięki czemu także wcześniej zaprojektowane rewersy są od razu dostępne).
 * Pomija rewersy należące już do bieżącego projektu oraz identyczne kopie (ten sam klucz treści,
 * np. z projektów, które jedynie zaimportowały ten sam rewers). Rewersy o tej samej nazwie,
 * ale innej treści, zostają na liście.
 */
export async function listaRewersowGlobalnych(
  biezacyProjektId?: string,
  tresciWProjekcie?: ReadonlySet<string>,
): Promise<ZapisanyRewersGlobalny[]> {
  let zBiblioteki: Awaited<ReturnType<ReturnType<typeof baza>['bibliotekaGlobalna']>>;
  let zProjektow: Awaited<ReturnType<ReturnType<typeof baza>['rewersyZProjektow']>>;
  try {
    [zBiblioteki, zProjektow] = await Promise.all([
      baza().bibliotekaGlobalna('rewers'),
      baza().rewersyZProjektow(biezacyProjektId),
    ]);
  } catch {
    return [];
  }
  const wynik: ZapisanyRewersGlobalny[] = [];
  const widzianeKlucze = new Set<string>();
  const widzianeTresci = new Set<string>();
  const trescWProjekcie = new Map(
    zProjektow.map((p) => [kluczRewersuGlobalnego(p.projektId, p.rewersId), p.kluczTresci]),
  );
  // Treść wpisu biblioteki: z projektu, który go zapisał, a gdy go nie ma – z samej paczki.
  const trescWpisu = async (id: string): Promise<string | undefined> => {
    const zProjektu = trescWProjekcie.get(id);
    if (zProjektu !== undefined) return zProjektu;
    try {
      return kluczTresciRewersuWPaczce(await baza().odczytajZBiblioteki(id));
    } catch {
      return undefined;
    }
  };
  const ukryte = wczytajUkryte();
  const przedrostekBiezacego = biezacyProjektId
    ? `${PRZEDROSTEK_KLUCZA}${biezacyProjektId}:`
    : undefined;

  for (const w of zBiblioteki) {
    if (przedrostekBiezacego && w.id.startsWith(przedrostekBiezacego)) continue;
    const tresc = await trescWpisu(w.id);
    if (tresc !== undefined) {
      if (tresciWProjekcie?.has(tresc) || widzianeTresci.has(tresc)) continue;
      widzianeTresci.add(tresc);
    }
    widzianeKlucze.add(w.id);
    wynik.push({ klucz: w.id, nazwa: w.nazwa, zrodlo: 'biblioteka', wpisId: w.id });
  }

  for (const p of zProjektow) {
    const klucz = kluczRewersuGlobalnego(p.projektId, p.rewersId);
    if (widzianeKlucze.has(klucz) || ukryte.has(klucz)) continue;
    if (tresciWProjekcie?.has(p.kluczTresci) || widzianeTresci.has(p.kluczTresci)) continue;
    widzianeKlucze.add(klucz);
    widzianeTresci.add(p.kluczTresci);
    wynik.push({
      klucz,
      nazwa: p.nazwa,
      zrodlo: 'projekt',
      projektId: p.projektId,
      rewersId: p.rewersId,
    });
  }

  return wynik.sort((a, b) => a.nazwa.localeCompare(b.nazwa));
}

async function wczytajPaczkeRewersu(wpis: ZapisanyRewersGlobalny): Promise<Uint8Array> {
  if (wpis.zrodlo === 'biblioteka' && wpis.wpisId) {
    return baza().odczytajZBiblioteki(wpis.wpisId);
  }
  if (wpis.projektId && wpis.rewersId) {
    const { projekt, zasoby } = await baza().wczytaj(wpis.projektId);
    return eksportujRewers(projekt, zasoby, wpis.rewersId);
  }
  throw new Error(`Nieprawidłowy wpis rewersu: ${wpis.klucz}`);
}

/**
 * Dołącza wybrany globalny rewers (z jego obrazami, czcionkami i ozdobnikami) do bieżącego projektu
 * i opcjonalnie od razu przypisuje go do karty, szablonu lub talii w jednym kroku historii.
 */
export async function dolaczRewersGlobalnyDoProjektu(
  wpis: ZapisanyRewersGlobalny,
  edycja: ProjektWEdycji,
  przypisz?: (projekt: Projekt, rewersId: string) => Projekt,
): Promise<string> {
  const bajty = await wczytajPaczkeRewersu(wpis);
  const paczka = importujRewers(bajty);
  let wynikoweId = '';
  await edycja.zmienZZasobami((p, d) => {
    const dodany = dodajRewersZPaczki(p, d, paczka);
    wynikoweId = dodany.rewersId;
    return {
      projekt: przypisz ? przypisz(dodany.projekt, dodany.rewersId) : dodany.projekt,
      dane: dodany.dane,
    };
  });
  return wynikoweId;
}

/** Hook wczytujący listę zapisanych rewersów spoza bieżącego projektu. */
export function useRewersyGlobalne(projekt: Projekt) {
  const [lista, ustawListe] = useState<ZapisanyRewersGlobalny[]>([]);
  const podpisRewersow = useMemo(
    () => JSON.stringify((projekt.rewersy ?? []).map(kluczTresciSzablonu)),
    [projekt.rewersy],
  );

  const odswiez = useCallback(async () => {
    const tresci = new Set(JSON.parse(podpisRewersow) as string[]);
    const wynik = await listaRewersowGlobalnych(projekt.id, tresci);
    ustawListe(wynik);
  }, [projekt.id, podpisRewersow]);

  useEffect(() => {
    let aktywny = true;
    const tresci = new Set(JSON.parse(podpisRewersow) as string[]);
    void listaRewersowGlobalnych(projekt.id, tresci).then((wynik) => {
      if (aktywny) ustawListe(wynik);
    });
    return () => {
      aktywny = false;
    };
  }, [projekt.id, podpisRewersow]);

  const usunGlobalny = useCallback(
    async (wpis: ZapisanyRewersGlobalny) => {
      if (wpis.zrodlo === 'biblioteka' && wpis.wpisId) {
        await baza().usunZBiblioteki(wpis.wpisId);
        const ukryte = wczytajUkryte();
        ukryte.add(wpis.klucz);
        zapiszUkryte(ukryte);
        await odswiez();
      }
    },
    [odswiez],
  );

  return { rewersyGlobalne: lista, odswiez, usunGlobalny };
}
