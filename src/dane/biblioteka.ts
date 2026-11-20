import type { Projekt } from '../model/projekt';
import { czyKontener, type Kontener, type Szablon, type Wezel } from '../model/szablon';
import { czyWbudowany } from '../ozdobniki/katalog';
import type { ElementOzdobny } from '../ozdobniki/typy';
import { t, tn } from '../i18n';
import { identyfikatorZNazwy } from './czcionki';
import { BladDanych, zasobySzablonu } from './schemat';
import { przytnijWciecia } from '../ozdobniki/ramka9';
import type { OpisObrazu } from '../model/projekt';

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
      if (!czyKontener(w) && w.typ === 'ikona' && w.element) yield* ref(w, 'element');
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

/** Zasoby obrazów (PNG) wskazane przez elementy `ramka9` ze źródłem „obraz”. */
export function zasobyElementow(elementy: readonly ElementOzdobny[]): string[] {
  return elementy.flatMap((e) => (e.ramka9?.zrodlo.typ === 'obraz' ? [e.ramka9.zrodlo.zasob] : []));
}

/** Wszystkie zasoby obrazów szablonu: stałe obrazy pól i obrazy ramek 9-slice użytych elementów. */
export function zasobyObrazowSzablonu(s: Szablon, wlasne: readonly ElementOzdobny[]): string[] {
  const uzyte = new Set(odwolaniaDoElementow(s));
  return [...zasobySzablonu(s), ...zasobyElementow(wlasne.filter((e) => uzyte.has(e.id)))];
}

/** Szablony i rewersy projektu używające elementu (do ostrzeżenia przy usuwaniu). */
export function szablonyUzywajace(p: Projekt, id: string): Szablon[] {
  return [...p.szablony, ...(p.rewersy ?? [])].filter((s) => odwolaniaDoElementow(s).includes(id));
}

/** Najdłuższa nazwa elementu (jak w schemacie). */
const MAKS_NAZWA = 200;
const MAKS_DLUGOSC_ID = 103; // `wl:` + 100 znaków (jak w schemacie)

/** `id`, a przy kolizji `id-2`, `id-3`… – z obcięciem tak, by całość mieściła się w limicie. */
function unikalneIdElementu(id: string, zajete: ReadonlySet<string>): string {
  let wynik = id.slice(0, MAKS_DLUGOSC_ID);
  for (let n = 2; zajete.has(wynik); n++) {
    const przyrostek = `-${n}`;
    wynik = id.slice(0, MAKS_DLUGOSC_ID - przyrostek.length) + przyrostek;
  }
  return wynik;
}

/** Identyfikator nowego własnego elementu: `wl:<nazwa>`, unikalny w bibliotece. */
export function noweIdElementu(nazwa: string, p: Pick<Projekt, 'biblioteka'>): string {
  const baza = identyfikatorZNazwy(nazwa.replace(/\.[^.]+$/, ''), 'wl').replace(/^wl-/, 'wl:');
  return unikalneIdElementu(baza, new Set(elementyProjektu(p).map((e) => e.id)));
}

/** Dodaje element do biblioteki projektu (zwraca nowy projekt i nadane id). */
export function dodajElementDoBiblioteki(
  p: Projekt,
  nazwa: string,
  element: Omit<ElementOzdobny, 'id' | 'nazwa'>,
): { projekt: Projekt; id: string } {
  const id = noweIdElementu(nazwa, p);
  const nowy: ElementOzdobny = { ...element, id, nazwa: nazwa.slice(0, MAKS_NAZWA) };
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
  Pick<ElementOzdobny, 'nazwa' | 'rodzaj' | 'kolorowanie' | 'tresc' | 'ramka9'>
>;

/**
 * Domyślne ustawienia ramki 9-slice dla źródła o wymiarach `szer` × `wys`: wcięcia po jednej
 * trzeciej każdego wymiaru, boki powtarzane, środek wypełniony.
 */
export function ramka9Domyslna(
  zrodlo: NonNullable<ElementOzdobny['ramka9']>['zrodlo'],
  szer: number,
  wys: number,
): NonNullable<ElementOzdobny['ramka9']> {
  const w = zrodlo.typ === 'obraz' ? Math.round : (v: number) => Math.round(v * 100) / 100;
  return {
    zrodlo,
    wciecia: { gora: w(wys / 3), prawo: w(szer / 3), dol: w(wys / 3), lewo: w(szer / 3) },
    boki: 'powtarzaj',
    srodek: 'wypelnij',
  };
}

/**
 * Dodaje do biblioteki ramkę 9-slice z obrazu PNG projektu (element bez konturów; `szer` × `wys`
 * to piksele obrazu). Zwraca nowy projekt i nadane id.
 */
export function dodajRamke9ZObrazu(
  p: Projekt,
  nazwa: string,
  obraz: Pick<OpisObrazu, 'id' | 'szerokosc' | 'wysokosc'>,
): { projekt: Projekt; id: string } {
  if (elementyProjektu(p).length >= MAKS_ELEMENTOW_BIBLIOTEKI)
    throw new BladDanych(tn('dane.zaDuzoElementow', MAKS_ELEMENTOW_BIBLIOTEKI));
  return dodajElementDoBiblioteki(p, nazwa, {
    rodzaj: 'ramka9',
    szer: obraz.szerokosc,
    wys: obraz.wysokosc,
    kontury: [],
    ramka9: ramka9Domyslna({ typ: 'obraz', zasob: obraz.id }, obraz.szerokosc, obraz.wysokosc),
  });
}

/** Prostokąt treści w obrębie rysunku: wymiary co najmniej 1 %, całość w zakresie 0–1. */
export function przytnijTresc(
  t: NonNullable<ElementOzdobny['tresc']>,
): NonNullable<ElementOzdobny['tresc']> {
  const ogranicz = (v: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  const szer = ogranicz(t.szer, 0.01, 1);
  const wys = ogranicz(t.wys, 0.01, 1);
  return { x: ogranicz(t.x, 0, 1 - szer), y: ogranicz(t.y, 0, 1 - wys), szer, wys };
}

/** Zmienia nazwę, rodzaj, kolorowanie albo prostokąt treści własnego elementu. */
export function zmienElementBiblioteki(p: Projekt, id: string, zmiana: ZmianaElementu): Projekt {
  const lista = elementyProjektu(p);
  if (!lista.some((e) => e.id === id)) return p;
  if (zmiana.nazwa !== undefined) zmiana = { ...zmiana, nazwa: zmiana.nazwa.slice(0, MAKS_NAZWA) };
  if (zmiana.tresc) zmiana = { ...zmiana, tresc: przytnijTresc(zmiana.tresc) };
  return {
    ...p,
    biblioteka: {
      ozdobniki: lista.map((e) => {
        if (e.id !== id) return e;
        const n: ElementOzdobny = { ...e, ...zmiana };
        // Ramka z obrazu nie ma konturów – nie da się jej użyć w innym rodzaju.
        if (n.ramka9?.zrodlo.typ === 'obraz') n.rodzaj = 'ramka9';
        // Rodzaj „ramka 9-slice” wymaga ustawień (dla SVG – domyślne wcięcia); inne rodzaje ich nie mają.
        if (n.rodzaj === 'ramka9') {
          if (!n.ramka9) n.ramka9 = ramka9Domyslna({ typ: 'svg' }, n.szer, n.wys);
          n.ramka9 = { ...n.ramka9, wciecia: przytnijWciecia(n.ramka9.wciecia, n.szer, n.wys) };
        } else if (n.ramka9?.zrodlo.typ === 'svg') delete n.ramka9;
        return n;
      }),
    },
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
  /** Tylko te elementy z paczki są dołączane (np. używane przez szablon); domyślnie wszystkie. */
  uzyte?: ReadonlySet<string>,
): { lista: ElementOzdobny[]; mapa: Map<string, string> } {
  const lista = [...elementyProjektu(p)];
  const mapa = new Map<string, string>();
  const zajete = new Set(lista.map((e) => e.id));
  const wPaczce = new Set<string>();
  for (const e of nowe) {
    if (wPaczce.has(e.id))
      throw new BladDanych(t('dane.powtorzonyId', { id: e.id, gdzie: t('dane.gdzie.biblioteka') }));
    wPaczce.add(e.id);
  }
  for (const e of nowe) {
    if (uzyte && !uzyte.has(e.id)) continue;
    const istniejacy = lista.find((x) => x.id === e.id);
    if (istniejacy && stabilnyJson(istniejacy) === stabilnyJson(e)) continue;
    const id = unikalneIdElementu(e.id, zajete);
    zajete.add(id);
    if (id !== e.id) mapa.set(e.id, id);
    lista.push({ ...e, id });
  }
  if (lista.length > MAKS_ELEMENTOW_BIBLIOTEKI)
    throw new BladDanych(tn('dane.zaDuzoElementow', MAKS_ELEMENTOW_BIBLIOTEKI));
  return { lista, mapa };
}
