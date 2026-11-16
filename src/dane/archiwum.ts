import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { t } from '../i18n';
import {
  rozszerzenieZasobu,
  type DaneZasobow,
  type OpisZasobu,
  type Projekt,
} from '../model/projekt';
import type { Szablon, Wezel } from '../model/szablon';
import {
  BladDanych,
  migruj,
  przygotujProjekt,
  schematOpisuZasobu,
  schematSzablonu,
  sprawdz,
  zasobySzablonu,
} from './schemat';
import { z } from 'zod';

/** Rozszerzenie pliku projektu i szablonu (ZIP z JSON-em i zasobami). */
export const ROZSZERZENIE_PROJEKTU = '.kartyrpg';
export const ROZSZERZENIE_SZABLONU = '.kartyrpg-szablon';

const PLIK_PROJEKTU = 'projekt.json';
const PLIK_SZABLONU = 'szablon.json';
const KATALOG_ZASOBOW = 'zasoby/';
const MAKS_PLIKU = 100 * 1024 * 1024;

function nazwaPlikuZasobu(opis: OpisZasobu): string {
  return `${KATALOG_ZASOBOW}${encodeURIComponent(opis.id)}.${rozszerzenieZasobu(opis)}`;
}

function spakuj(json: unknown, plikJson: string, zasoby: [OpisZasobu, Uint8Array][]): Uint8Array {
  const pliki: Record<string, Uint8Array> = { [plikJson]: strToU8(JSON.stringify(json, null, 2)) };
  // Obrazy i czcionki są już skompresowane – bez ponownej kompresji (poziom 0).
  for (const [opis, dane] of zasoby) pliki[nazwaPlikuZasobu(opis)] = dane;
  return zipSync(pliki, { level: 0 });
}

function rozpakuj(bajty: Uint8Array): Record<string, Uint8Array> {
  try {
    return unzipSync(bajty, {
      filter: (plik) => {
        if (plik.originalSize > MAKS_PLIKU) {
          throw new BladDanych(
            t('dane.zaDuzy', {
              plik: plik.name,
              mb: (plik.originalSize / 1024 / 1024).toFixed(0),
            }),
          );
        }
        return true;
      },
    });
  } catch (e) {
    if (e instanceof BladDanych) throw e;
    throw new BladDanych(t('dane.nieArchiwum'));
  }
}

function odczytajJson(pliki: Record<string, Uint8Array>, plik: string): unknown {
  const bajty = pliki[plik];
  if (!bajty) throw new BladDanych(t('dane.brakProjektu', { plik }));
  try {
    return JSON.parse(strFromU8(bajty));
  } catch {
    throw new BladDanych(t('dane.zlyJson', { plik }));
  }
}

/** Zbiera bajty opisanych zasobów; nadmiarowe wpisy w archiwum to błąd (nic nie ginie po cichu). */
function zbierzZasoby(pliki: Record<string, Uint8Array>, opisy: OpisZasobu[]): DaneZasobow {
  const wynik: DaneZasobow = new Map();
  const uzyte = new Set<string>([PLIK_PROJEKTU, PLIK_SZABLONU]);
  for (const opis of opisy) {
    const nazwa = nazwaPlikuZasobu(opis);
    const bajty = pliki[nazwa];
    if (!bajty) throw new BladDanych(t('dane.brakZasobu', { id: opis.id }));
    wynik.set(opis.id, bajty);
    uzyte.add(nazwa);
  }
  for (const nazwa of Object.keys(pliki)) {
    if (!uzyte.has(nazwa) && !nazwa.endsWith('/')) {
      throw new BladDanych(t('dane.nadmiarowyPlik', { plik: nazwa }));
    }
  }
  return wynik;
}

function bajtyZasobu(zasoby: DaneZasobow, id: string): Uint8Array {
  const dane = zasoby.get(id);
  if (!dane) throw new BladDanych(t('dane.brakZasobu', { id }));
  return dane;
}

/** Eksport całego projektu do jednego pliku `.kartyrpg`. */
export function eksportujProjekt(projekt: Projekt, zasoby: DaneZasobow): Uint8Array {
  return spakuj(
    projekt,
    PLIK_PROJEKTU,
    projekt.zasoby.map((o) => [o, bajtyZasobu(zasoby, o.id)]),
  );
}

/** Import projektu z pliku: rozpakowanie, migracja, walidacja kształtu i spójności. */
export function importujProjekt(bajty: Uint8Array): { projekt: Projekt; zasoby: DaneZasobow } {
  const pliki = rozpakuj(bajty);
  const projekt = przygotujProjekt(odczytajJson(pliki, PLIK_PROJEKTU));
  return { projekt, zasoby: zbierzZasoby(pliki, projekt.zasoby) };
}

// ---------------------------------------------------------------------------------------------
// Pojedynczy szablon

function rodzinyWSzablonie(s: Szablon): string[] {
  const nazwy = new Set<string>();
  const wezel = (w: Wezel): void => {
    if ('dzieci' in w) return w.dzieci.forEach(wezel);
    if ('styl' in w) nazwy.add(w.styl.czcionka);
    if (w.typ === 'tekst' && w.etykieta?.styl?.czcionka) nazwy.add(w.etykieta.styl.czcionka);
  };
  wezel(s.korzen);
  s.warianty?.forEach((w) => wezel(w.korzen));
  return [...nazwy];
}

const schematPlikuSzablonu = z.looseObject({
  wersja: z.number().int(),
  szablon: schematSzablonu,
  role: z.record(z.string(), z.string()),
  zasoby: z.array(schematOpisuZasobu),
});

export interface PaczkaSzablonu {
  szablon: Szablon;
  role: Record<string, string>;
  zasoby: OpisZasobu[];
  dane: DaneZasobow;
}

export interface WynikEksportuSzablonu {
  bajty: Uint8Array;
  /** Ostrzeżenia dla użytkownika (np. licencje czcionek spoza Google Fonts). */
  ostrzezenia: string[];
}

/** Eksport szablonu z użytymi czcionkami i obrazami; ostrzega o czcionkach z własnych plików. */
export function eksportujSzablon(
  projekt: Projekt,
  zasoby: DaneZasobow,
  szablonId: string,
): WynikEksportuSzablonu {
  const szablon = projekt.szablony.find((s) => s.id === szablonId);
  if (!szablon) throw new BladDanych(t('dane.brakSzablonu', { id: szablonId }));
  const role: Record<string, string> = {};
  const rodziny = new Set<string>();
  for (const nazwa of rodzinyWSzablonie(szablon)) {
    const rodzina = projekt.role[nazwa] ?? nazwa;
    if (projekt.role[nazwa] !== undefined) role[nazwa] = rodzina;
    rodziny.add(rodzina);
  }
  const uzyte = projekt.zasoby.filter(
    (o) =>
      (o.rodzaj === 'czcionka' && rodziny.has(o.rodzina)) ||
      (o.rodzaj === 'obraz' && zasobySzablonu(szablon).includes(o.id)),
  );
  const ostrzezenia = [
    ...new Set(
      uzyte.flatMap((o) =>
        o.rodzaj === 'czcionka' && o.zrodlo === 'wlasna'
          ? [t('dane.licencjaCzcionki', { rodzina: o.rodzina })]
          : [],
      ),
    ),
  ];
  const plik = { wersja: projekt.wersja, szablon, role, zasoby: uzyte };
  return {
    bajty: spakuj(
      plik,
      PLIK_SZABLONU,
      uzyte.map((o) => [o, bajtyZasobu(zasoby, o.id)]),
    ),
    ostrzezenia,
  };
}

export function importujSzablon(bajty: Uint8Array): PaczkaSzablonu {
  const pliki = rozpakuj(bajty);
  const surowe = odczytajJson(pliki, PLIK_SZABLONU);
  migruj(surowe);
  const plik = sprawdz(schematPlikuSzablonu, surowe) as unknown as Omit<PaczkaSzablonu, 'dane'>;
  return { ...plik, dane: zbierzZasoby(pliki, plik.zasoby) };
}

/**
 * Dodaje zaimportowany szablon do projektu (zwraca nowy projekt). Zasób o tym samym id i tej
 * samej zawartości jest współdzielony; o innej zawartości – błąd. Szablon o zajętym id dostaje
 * nowy identyfikator.
 */
export function dodajSzablon(
  projekt: Projekt,
  zasoby: DaneZasobow,
  paczka: PaczkaSzablonu,
): { projekt: Projekt; zasoby: DaneZasobow; szablonId: string } {
  const noweZasoby: DaneZasobow = new Map(zasoby);
  const opisy = [...projekt.zasoby];
  for (const opis of paczka.zasoby) {
    const nowe = bajtyZasobu(paczka.dane, opis.id);
    const stare = noweZasoby.get(opis.id);
    if (!stare) {
      opisy.push(opis);
      noweZasoby.set(opis.id, nowe);
    } else if (stare.length !== nowe.length || stare.some((b, i) => b !== nowe[i])) {
      throw new BladDanych(t('dane.kolizjaZasobu', { id: opis.id }));
    }
  }
  const zajete = new Set(projekt.szablony.map((s) => s.id));
  let id = paczka.szablon.id;
  for (let n = 2; zajete.has(id); n++) id = `${paczka.szablon.id}-${n}`;
  const role = { ...paczka.role, ...projekt.role };
  const wynik: Projekt = {
    ...projekt,
    role,
    zasoby: opisy,
    szablony: [...projekt.szablony, { ...paczka.szablon, id }],
    zmieniono: new Date().toISOString(),
  };
  return { projekt: przygotujProjekt(wynik), zasoby: noweZasoby, szablonId: id };
}
