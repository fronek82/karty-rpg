import type { Projekt } from '../model/projekt';
import { czyKontener, type Kontener, type Szablon, type Wezel } from '../model/szablon';
import { czyWbudowany } from '../ozdobniki/katalog';
import type { ElementOzdobny } from '../ozdobniki/typy';
import { identyfikatorZNazwy, unikalneId } from './czcionki';

/** Najwięcej własnych elementów w bibliotece projektu (ochrona przed rozdęciem projektu). */
export const MAKS_ELEMENTOW_BIBLIOTEKI = 200;

interface Odwolanie {
  id: string;
  ustaw(nowe: string): void;
}

function* wezly(w: Wezel): Generator<Wezel> {
  yield w;
  if (czyKontener(w)) for (const d of w.dzieci) yield* wezly(d);
}

/** Odwołanie do elementu w polu `klucz` obiektu `o` (jeśli jest tekstem). */
function* ref(o: unknown, klucz: string): Generator<Odwolanie> {
  const rec = o as Record<string, unknown> | undefined;
  const v = rec?.[klucz];
  if (typeof v === 'string' && v !== '') {
    yield { id: v, ustaw: (nowe) => void (rec![klucz] = nowe) };
  }
}

/**
 * Wszystkie odwołania szablonu do elementów biblioteki (ozdoba, narożniki, motyw/zakończenia/
 * środek separatora, własny kształt wartości, ramka karty) z możliwością przepisania identyfikatora.
 */
function* odwolania(s: Szablon): Generator<Odwolanie> {
  if (s.ramka) {
    yield* ref(s.ramka.ozdoba, 'element');
    yield* ref(s.ramka.narozniki, 'element');
  }
  const korzenie: Kontener[] = [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)];
  for (const k of korzenie) {
    for (const w of wezly(k)) {
      yield* ref(w.ozdoba, 'element');
      yield* ref(w.narozniki, 'element');
      if (!czyKontener(w) && w.typ === 'separator') {
        if (w.rysunek && w.rysunek !== 'linia') yield* ref(w.rysunek, 'motyw');
        yield* ref(w.zakonczenia, 'element');
        yield* ref(w.srodek, 'element');
      }
      if (!czyKontener(w) && w.typ === 'wartosc' && w.ksztalt === 'wlasny')
        yield* ref(w, 'ksztaltElement');
    }
  }
}

/** Identyfikatory elementów biblioteki użyte w szablonie (z powtórzeniami). */
export function odwolaniaDoElementow(s: Szablon): string[] {
  return [...odwolania(s)].map((o) => o.id);
}

/** Przepisuje identyfikatory elementów w szablonie (zmienia obiekt – wołać na kopii). */
export function przepiszOdwolania(s: Szablon, mapa: ReadonlyMap<string, string>): void {
  for (const o of odwolania(s)) {
    const nowe = mapa.get(o.id);
    if (nowe !== undefined) o.ustaw(nowe);
  }
}

/** JSON z posortowanymi kluczami – porównanie treści niezależne od kolejności pól. */
function stabilnyJson(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : x,
  );
}

/** Własne elementy projektu (bez wbudowanych). */
export const elementyProjektu = (p: Pick<Projekt, 'biblioteka'>): ElementOzdobny[] =>
  p.biblioteka?.ozdobniki ?? [];

/** Własne elementy biblioteki, których używa szablon (do pliku szablonu). */
export function elementyUzyteWSzablonie(p: Projekt, s: Szablon): ElementOzdobny[] {
  const uzyte = new Set(odwolaniaDoElementow(s).filter((id) => !czyWbudowany(id)));
  return elementyProjektu(p).filter((e) => uzyte.has(e.id));
}

/** Szablony projektu używające elementu (do ostrzeżenia przy usuwaniu). */
export function szablonyUzywajace(p: Projekt, id: string): Szablon[] {
  return p.szablony.filter((s) => odwolaniaDoElementow(s).includes(id));
}

/** Identyfikator nowego własnego elementu: `wl:<nazwa>`, unikalny w bibliotece. */
export function noweIdElementu(nazwa: string, p: Pick<Projekt, 'biblioteka'>): string {
  const baza = identyfikatorZNazwy(nazwa.replace(/\.[^.]+$/, ''), 'wl').replace(/^wl-/, 'wl:');
  return unikalneId(baza, new Set(elementyProjektu(p).map((e) => e.id)));
}

/** Dodaje element do biblioteki projektu (zwraca nowy projekt i nadane id). */
export function dodajElementDoBiblioteki(
  p: Projekt,
  nazwa: string,
  element: Omit<ElementOzdobny, 'id' | 'nazwa'>,
): { projekt: Projekt; id: string } {
  const id = noweIdElementu(nazwa, p);
  const nowy: ElementOzdobny = { ...element, id, nazwa };
  return {
    projekt: {
      ...p,
      biblioteka: { ozdobniki: [...elementyProjektu(p), nowy] },
      zmieniono: new Date().toISOString(),
    },
    id,
  };
}

/** Usuwa element z biblioteki; odwołania w szablonach zostają (silnik pominie ozdobę z ostrzeżeniem). */
export function usunElementZBiblioteki(p: Projekt, id: string): Projekt {
  const lista = elementyProjektu(p).filter((e) => e.id !== id);
  if (lista.length === elementyProjektu(p).length) return p;
  const { biblioteka: _b, ...reszta } = p;
  void _b;
  return {
    ...reszta,
    ...(lista.length > 0 ? { biblioteka: { ozdobniki: lista } } : {}),
    zmieniono: new Date().toISOString(),
  };
}

export type ZmianaElementu = Partial<
  Pick<ElementOzdobny, 'nazwa' | 'rodzaj' | 'kolorowanie' | 'tresc'>
>;

/** Zmienia nazwę, rodzaj, kolorowanie albo prostokąt treści własnego elementu. */
export function zmienElementBiblioteki(p: Projekt, id: string, zmiana: ZmianaElementu): Projekt {
  const lista = elementyProjektu(p);
  if (!lista.some((e) => e.id === id)) return p;
  return {
    ...p,
    biblioteka: { ozdobniki: lista.map((e) => (e.id === id ? { ...e, ...zmiana } : e)) },
    zmieniono: new Date().toISOString(),
  };
}

/**
 * Dołącza do projektu elementy z pliku szablonu. Identyczny element (ta sama treść) o tym samym
 * id jest współdzielony; o zajętym id i innej treści dostaje nowe id – zwracana mapa przepisań
 * służy do poprawienia odwołań w szablonie.
 */
export function dolaczElementy(
  p: Projekt,
  nowe: readonly ElementOzdobny[],
): { lista: ElementOzdobny[]; mapa: Map<string, string> } {
  const lista = [...elementyProjektu(p)];
  const mapa = new Map<string, string>();
  const zajete = new Set(lista.map((e) => e.id));
  for (const e of nowe) {
    const istniejacy = lista.find((x) => x.id === e.id);
    if (istniejacy && stabilnyJson(istniejacy) === stabilnyJson(e)) continue;
    const id = unikalneId(e.id, zajete);
    zajete.add(id);
    if (id !== e.id) mapa.set(e.id, id);
    lista.push({ ...e, id });
  }
  return { lista, mapa };
}
