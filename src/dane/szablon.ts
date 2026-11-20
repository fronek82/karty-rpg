import { pt, type Mm } from '../model/jednostki';
import type { Projekt } from '../model/projekt';
import {
  czyKontener,
  type StylTekstu,
  type PoleZeStylem,
  stylPola,
  znajdzGrupeStylu,
  maStylTekstu,
  kluczeTabeli,
  rozwinOdstepy,
  ulamkiKotwicy,
  type Kolor,
  type Kotwica,
  type Kontener,
  type Pole,
  type Szablon,
  type Wezel,
} from '../model/szablon';
import { unikalneId } from './czcionki';
import { prostokatPoObrocie } from '../silnik/uklad';
import type { WbudowanyZestawStylu } from '../ozdobniki/zestawyStylow';

/**
 * Edycja szablonu od zera: operacje na drzewie wierszy, kolumn i pól (czyste funkcje – projekt
 * na wejściu i wyjściu) oraz neutralne klocki startowe. Nic tu nie jest dobrane pod konkretną
 * grę – nazwy, rozmiary i style to ogólne wartości wyjściowe do zmiany w panelu właściwości.
 */

/** Rodzaje nowych elementów w menu „+ Dodaj”. `etykieta-wartosc` to pole tekstowe z etykietą nad. */
export type RodzajNowego =
  Kontener['typ'] | Pole['typ'] | 'etykieta-wartosc' | 'separator-zakonczenia' | 'separator-motyw';

const CZARNY: Kolor = '#000000';
const tresc = (rozmiar: number) => ({ czcionka: 'tresc', rozmiar: pt(rozmiar) });

function* wezly(w: Wezel): Generator<Wezel> {
  yield w;
  if (czyKontener(w)) for (const d of w.dzieci) yield* wezly(d);
}

/** Wszystkie węzły szablonu (korzeń i warianty układu). */
export function wszystkieWezly(s: Szablon): Wezel[] {
  return [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)].flatMap((k) => [...wezly(k)]);
}

/** Klucze danych używane w szablonie (pola i komórki tabel). */
export function kluczeSzablonu(s: Szablon): Set<string> {
  const k = new Set<string>();
  for (const w of wszystkieWezly(s)) {
    if (czyKontener(w)) continue;
    if (w.klucz) k.add(w.klucz);
    if (w.typ === 'tabela') for (const c of kluczeTabeli(w)) k.add(c);
  }
  for (const p of s.parametry ?? []) k.add(p.klucz);
  return k;
}

/** Klucz danych z nazwy: małe litery, bez znaków diakrytycznych, `_` zamiast spacji; unikalny. */
export function kluczZNazwy(nazwa: string, zajete: ReadonlySet<string>): string {
  const baza =
    nazwa
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ł/g, 'l')
      .replace(/Ł/g, 'L')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'pole';
  let klucz = baza;
  for (let n = 2; zajete.has(klucz); n++) klucz = `${baza}_${n}`;
  return klucz;
}

const noweIdWezla = (s: Szablon, typ: string) =>
  unikalneId(typ, new Set(wszystkieWezly(s).map((w) => w.id)));

/**
 * Nowy element z neutralnymi ustawieniami. Pola z danymi dostają nazwę i klucz (unikalne
 * w szablonie); w wierszu separator jest pionowy.
 */
export function nowyWezel(
  s: Szablon,
  rodzaj: RodzajNowego,
  nazwa: string,
  opcje: {
    wWierszu?: boolean;
    /** Klucze zajęte poza szablonem (np. dane kart po usuniętych polach) – nie do ponownego użycia. */
    zajete?: Iterable<string>;
    /** Rewers statyczny: pola tekstowe, wartości i obrazy powstają od razu bez klucza danych. */
    bezKlucza?: boolean;
  } = {},
): Wezel {
  const id = noweIdWezla(s, rodzaj.startsWith('separator') ? 'separator' : rodzaj);
  const klucze = new Set([...kluczeSzablonu(s), ...(opcje.zajete ?? [])]);
  const klucz = () => kluczZNazwy(nazwa, klucze);
  switch (rodzaj) {
    case 'wiersz':
    case 'kolumna':
    case 'warstwy':
      return { id, nazwa, typ: rodzaj, odstep: 1, dzieci: [] };
    case 'swobodny':
      return { id, nazwa, typ: 'swobodny', dzieci: [] };
    case 'tekst':
      return opcje.bezKlucza
        ? { id, nazwa, typ: 'tekst', tekst: nazwa, styl: tresc(9) }
        : { id, nazwa, typ: 'tekst', klucz: klucz(), styl: tresc(9) };
    case 'etykieta-wartosc':
      return {
        id,
        nazwa,
        typ: 'tekst',
        ...(opcje.bezKlucza ? { tekst: nazwa } : { klucz: klucz() }),
        styl: tresc(9),
        // Etykieta mniejsza od wartości – bez innych upiększeń (kolor, wersaliki ustawia użytkownik).
        etykieta: { tekst: nazwa, pozycja: 'nad', styl: { rozmiar: pt(7) } },
      };
    case 'wartosc':
      return {
        id,
        nazwa,
        typ: 'wartosc',
        ...(opcje.bezKlucza ? { tekst: nazwa } : { klucz: klucz() }),
        ksztalt: 'prostokat',
        // Rozmiar wg treści (bez rozciągania na całą szerokość / wysokość rodzica).
        wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' },
        padding: 0.8,
        obramowanie: { grubosc: 0.3, kolor: CZARNY },
        styl: { ...tresc(9), wyrownanie: 'srodek', wyrownaniePionowe: 'srodek' },
      };
    case 'obraz':
      return {
        id,
        nazwa,
        typ: 'obraz',
        ...(opcje.bezKlucza ? {} : { klucz: klucz() }),
        dopasowanie: 'dopasuj',
        wysokosc: { wypelnij: 1 },
      };
    case 'znaczniki':
      return {
        id,
        nazwa,
        typ: 'znaczniki',
        ...(opcje.bezKlucza ? {} : { klucz: klucz() }),
        kolumny: 3,
        rzedy: 1,
        ksztalt: 'kolo',
        srednica: 2.5,
        odstep: 0.8,
        grubosc: 0.25,
      };
    case 'wpis':
      return {
        id,
        nazwa,
        typ: 'wpis',
        ...(opcje.bezKlucza ? {} : { klucz: klucz() }),
        styl: tresc(9),
        minWysokosc: 5,
        obramowanie: { grubosc: 0.25, kolor: CZARNY },
      };
    case 'ikona':
      return { id, nazwa, typ: 'ikona', ikona: 'gwiazdka', rozmiar: 4 };
    case 'separator':
    case 'separator-zakonczenia':
    case 'separator-motyw': {
      // Trzy wzory startowe (ogólne klocki): linia, linia z zakończeniami i środkiem, motyw.
      const wzor =
        rodzaj === 'separator-zakonczenia'
          ? {
              zakonczenia: { element: 'wb:zak-grot', rozmiar: 2.4 },
              srodek: { element: 'wb:sr-romb', rozmiar: 2.4 },
              odstepOdOzdoby: 0.4,
            }
          : rodzaj === 'separator-motyw'
            ? {
                rysunek: { motyw: 'wb:lancuch', szerokosc: 3 },
                zakonczenia: { element: 'wb:zak-zawijas', rozmiar: 2.4 },
                odstepOdOzdoby: 0.4,
              }
            : {};
      return {
        id,
        nazwa,
        typ: 'separator',
        kierunek: opcje.wWierszu ? 'pionowy' : 'poziomy',
        grubosc: 0.3,
        ...wzor,
      };
    }
    case 'tabela': {
      const kolumny = [1, 2, 3].map((n) => {
        const k = kluczZNazwy(`${nazwa} ${n}`, klucze);
        klucze.add(k);
        return { naglowek: String(n), klucz: k };
      });
      return {
        id,
        nazwa,
        typ: 'tabela',
        kolumny,
        styl: tresc(8),
        linie: { grubosc: 0.2, kolor: CZARNY },
      };
    }
  }
}

// --- Drzewo.

function mapuj(w: Wezel, f: (w: Wezel) => Wezel): Wezel {
  const x = f(w);
  return czyKontener(x) ? { ...x, dzieci: x.dzieci.map((d) => mapuj(d, f)) } : x;
}

/** Ustawienia pojedynczego ozdobnika zawierają wyłącznie wartości proste. */
function teSameUstawienia<T extends object>(obecne: T | undefined, nowe: T): boolean {
  if (!obecne) return false;
  const klucze = Object.keys(nowe) as (keyof T)[];
  return (
    Object.keys(obecne).length === klucze.length &&
    klucze.every((klucz) => Object.hasOwn(obecne, klucz) && obecne[klucz] === nowe[klucz])
  );
}

/** Zestaw kopiuje zwykłe style ramki i istniejących separatorów we wszystkich układach karty. */
export function zastosujZestawStylu(s: Szablon, zestaw: WbudowanyZestawStylu): Szablon {
  let zmieniono = false;
  const ramka = {
    ...(s.ramka ?? { grubosc: 0.3, kolor: zestaw.ozdoba.kolor }),
    ozdoba: { ...zestaw.ozdoba },
    narozniki: { ...zestaw.narozniki },
  };
  const ustawSeparator = (w: Wezel): Wezel => {
    if (w.typ !== 'separator') return w;
    const { rysunek, zakonczenia, srodek, ...styl } = zestaw.separator;
    const takiSamRysunek =
      rysunek === 'linia'
        ? w.rysunek === rysunek
        : typeof w.rysunek === 'object' && teSameUstawienia(w.rysunek, rysunek);
    if (
      takiSamRysunek &&
      w.kolor === styl.kolor &&
      w.grubosc === styl.grubosc &&
      w.stylLinii === styl.stylLinii &&
      teSameUstawienia(w.zakonczenia, zakonczenia) &&
      teSameUstawienia(w.srodek, srodek)
    )
      return w;
    zmieniono = true;
    return {
      ...w,
      ...styl,
      rysunek: rysunek === 'linia' ? rysunek : { ...rysunek },
      zakonczenia: { ...zakonczenia },
      srodek: { ...srodek },
    };
  };
  const korzen = mapuj(s.korzen, ustawSeparator) as Kontener;
  const warianty = s.warianty?.map((w) => ({
    ...w,
    korzen: mapuj(w.korzen, ustawSeparator) as Kontener,
  }));

  if (
    !zmieniono &&
    s.ramka?.ozdoba?.rodzaj === 'motyw' &&
    teSameUstawienia(s.ramka.ozdoba, ramka.ozdoba) &&
    teSameUstawienia(s.ramka.narozniki, ramka.narozniki)
  )
    return s;
  return { ...s, ramka, korzen, ...(warianty ? { warianty } : {}) };
}

function mapujUklady(s: Szablon, f: (w: Wezel) => Wezel): Szablon {
  const mapujKorzen = (korzen: Kontener) => mapuj(korzen, f) as Kontener;
  return {
    ...s,
    korzen: mapujKorzen(s.korzen),
    ...(s.warianty
      ? { warianty: s.warianty.map((w) => ({ ...w, korzen: mapujKorzen(w.korzen) })) }
      : {}),
  };
}

function odlaczStyl(w: PoleZeStylem, styl: StylTekstu): Wezel {
  const pole = { ...w, styl };
  delete pole.grupaStyluId;
  return pole;
}

type WymiaryWariantu = Pick<NonNullable<Szablon['warianty']>[number], 'kolumny' | 'rzedy'>;

function indeksWariantu(s: Szablon, rozmiar: WymiaryWariantu): number {
  return (
    s.warianty?.findIndex((w) => w.kolumny === rozmiar.kolumny && w.rzedy === rozmiar.rzedy) ?? -1
  );
}

export function przypiszGrupeStylu(
  s: Szablon,
  id: string,
  grupaId: string,
  wariant?: WymiaryWariantu,
): Szablon {
  if (grupaId && !znajdzGrupeStylu(s, grupaId)) return s;
  const indeks = wariant ? indeksWariantu(s, wariant) : -1;
  const korzen = wariant ? s.warianty?.[indeks]?.korzen : s.korzen;
  if (!korzen) return s;
  const w = [...wezly(korzen)].find((x) => x.id === id);
  if (!w || !maStylTekstu(w) || (w.grupaStyluId ?? '') === grupaId) return s;
  const pole = grupaId ? { ...w, grupaStyluId: grupaId } : odlaczStyl(w, stylPola(s, w));
  const nowy = mapuj(korzen, (x) => (x.id === id ? pole : x)) as Kontener;
  if (!wariant) return { ...s, korzen: nowy };
  return {
    ...s,
    warianty: s.warianty!.map((x, i) => (i === indeks ? { ...x, korzen: nowy } : x)),
  };
}

export function utworzGrupeStylu(
  s: Szablon,
  idPola: string,
  nazwa: string,
  wariant?: WymiaryWariantu,
): Szablon {
  const korzen = wariant ? s.warianty?.[indeksWariantu(s, wariant)]?.korzen : s.korzen;
  const w = korzen && [...wezly(korzen)].find((x) => x.id === idPola);
  if (!w || !maStylTekstu(w)) return s;
  const grupy = s.grupyStylow ?? [];
  const zajete = new Set(grupy.map((g) => g.id));
  for (const pole of wszystkieWezly(s))
    if (maStylTekstu(pole) && pole.grupaStyluId) zajete.add(pole.grupaStyluId);
  const id = unikalneId('styl', zajete);
  const nowa = {
    id,
    nazwa: unikalneId(nazwa, new Set(grupy.map((g) => g.nazwa))),
    styl: stylPola(s, w),
  };
  return przypiszGrupeStylu({ ...s, grupyStylow: [...grupy, nowa] }, idPola, id, wariant);
}

export function zmienGrupeStylu(
  s: Szablon,
  id: string,
  zmiana: { nazwa: string } | { styl: (styl: StylTekstu) => StylTekstu },
): Szablon {
  const grupa = znajdzGrupeStylu(s, id);
  if (!grupa) return s;
  const grupy = s.grupyStylow ?? [];
  const nowa =
    'nazwa' in zmiana
      ? {
          ...grupa,
          nazwa: unikalneId(
            zmiana.nazwa.trim() || grupa.nazwa,
            new Set(grupy.filter((g) => g.id !== id).map((g) => g.nazwa)),
          ),
        }
      : { ...grupa, styl: zmiana.styl(grupa.styl) };
  if (nowa.nazwa === grupa.nazwa && nowa.styl === grupa.styl) return s;
  return { ...s, grupyStylow: grupy.map((g) => (g.id === id ? nowa : g)) };
}

/** Usuwa grupę i zachowuje jej wygląd we wszystkich polach, także w wariantach. */
export function usunGrupeStylu(s: Szablon, id: string): Szablon {
  const g = znajdzGrupeStylu(s, id);
  if (!g) return s;
  const wynik = mapujUklady(s, (w) =>
    maStylTekstu(w) && w.grupaStyluId === id ? odlaczStyl(w, g.styl) : w,
  );
  const grupy = (s.grupyStylow ?? []).filter((grupa) => grupa.id !== id);
  if (grupy.length) wynik.grupyStylow = grupy;
  else delete wynik.grupyStylow;
  return wynik;
}

/** Węzeł o identyfikatorze (w korzeniu szablonu). */
export function znajdzWezel(s: Szablon, id: string): Wezel | undefined {
  return [...wezly(s.korzen)].find((w) => w.id === id);
}

/** Rodzic węzła i jego indeks wśród dzieci (korzeń nie ma rodzica). */
export function rodzicWezla(
  s: Szablon,
  id: string,
): { rodzic: Kontener; indeks: number } | undefined {
  for (const w of wezly(s.korzen)) {
    if (!czyKontener(w)) continue;
    const indeks = w.dzieci.findIndex((d) => d.id === id);
    if (indeks >= 0) return { rodzic: w, indeks };
  }
  return undefined;
}

/** Zmiana jednego węzła (np. właściwości z panelu). */
export function zmienWezel(s: Szablon, id: string, f: (w: Wezel) => Wezel): Szablon {
  return { ...s, korzen: mapuj(s.korzen, (w) => (w.id === id ? f(w) : w)) as Kontener };
}

/** Wstawia węzeł: do zaznaczonego kontenera (na koniec) albo za zaznaczonym polem. */
export function wstawWezel(s: Szablon, celId: string, nowy: Wezel): Szablon {
  const cel = znajdzWezel(s, celId) ?? s.korzen;
  if (czyKontener(cel))
    return zmienWezel(
      s,
      cel.id,
      (k) => ({ ...k, dzieci: [...(k as Kontener).dzieci, nowy] }) as Kontener,
    );
  const r = rodzicWezla(s, cel.id)!;
  return wstawDo(s, r.rodzic.id, r.indeks + 1, nowy);
}

function wstawDo(s: Szablon, rodzicId: string, indeks: number, nowy: Wezel): Szablon {
  return zmienWezel(s, rodzicId, (k) => {
    const dzieci = [...(k as Kontener).dzieci];
    dzieci.splice(indeks, 0, nowy);
    return { ...(k as Kontener), dzieci };
  });
}

/** Usuwa węzły (bez korzenia). Dane kart zostają – przywrócenie pola przywraca treść. */
export function usunWezly(s: Szablon, ids: readonly string[]): Szablon {
  const usuwane = new Set(ids.filter((id) => id !== s.korzen.id));
  return {
    ...s,
    korzen: mapuj(s.korzen, (w) =>
      czyKontener(w) ? { ...w, dzieci: w.dzieci.filter((d) => !usuwane.has(d.id)) } : w,
    ) as Kontener,
  };
}

/** Przesuwa węzeł o jedną pozycję w obrębie rodzica (−1 wyżej / +1 niżej). */
export function przesunWezel(s: Szablon, id: string, o: -1 | 1): Szablon {
  const r = rodzicWezla(s, id);
  if (!r) return s;
  const j = r.indeks + o;
  if (j < 0 || j >= r.rodzic.dzieci.length) return s;
  return zmienWezel(s, r.rodzic.id, (k) => {
    const dzieci = [...(k as Kontener).dzieci];
    [dzieci[r.indeks], dzieci[j]] = [dzieci[j]!, dzieci[r.indeks]!];
    return { ...(k as Kontener), dzieci };
  });
}

/** Czy `id` leży w poddrzewie `przodek` (albo jest nim). */
function wPoddrzewie(s: Szablon, przodek: string, id: string): boolean {
  const p = znajdzWezel(s, przodek);
  return !!p && [...wezly(p)].some((w) => w.id === id);
}

/**
 * Przenosi węzeł do kontenera na pozycję `indeks` (np. przeciąganie w drzewie). Nie można
 * przenieść korzenia ani kontenera do jego własnego wnętrza.
 */
export function przeniesWezel(s: Szablon, id: string, rodzicId: string, indeks: number): Szablon {
  if (id === s.korzen.id || wPoddrzewie(s, id, rodzicId)) return s;
  const w = znajdzWezel(s, id);
  const cel = znajdzWezel(s, rodzicId);
  if (!w || !cel || !czyKontener(cel)) return s;
  const r = rodzicWezla(s, id)!;
  // Przenosząc w obrębie tego samego rodzica w dół – indeks przesuwa się po wyjęciu.
  const j = r.rodzic.id === rodzicId && indeks > r.indeks ? indeks - 1 : indeks;
  const bez = usunWezly(s, [id]);
  const dlugosc = (znajdzWezel(bez, rodzicId) as Kontener).dzieci.length;
  // Położenie ma sens tylko w kontenerze swobodnym – poza nim jest usuwane.
  // Do swobodnego trafia z położeniem i rozmiarem w mm (jak nowy element), jeśli ich nie miał.
  const przeniesiony =
    cel.typ === 'swobodny' ? (w.pozycja ? w : dostosujDoSwobodnego(w)) : bezPozycji(w);
  return wstawDo(bez, rodzicId, Math.max(0, Math.min(j, dlugosc)), przeniesiony);
}

function bezPozycji<T extends Wezel>(w: T): T {
  if (w.pozycja === undefined) return w;
  const { pozycja: _p, ...reszta } = w;
  void _p;
  return reszta as unknown as T;
}

/** „Wcięcie”: węzeł trafia na koniec poprzedzającego go kontenera. */
export function doPoprzedniegoKontenera(s: Szablon, id: string): Szablon {
  const r = rodzicWezla(s, id);
  const poprzedni = r ? r.rodzic.dzieci[r.indeks - 1] : undefined;
  if (!r || !poprzedni || !czyKontener(poprzedni)) return s;
  return przeniesWezel(s, id, poprzedni.id, poprzedni.dzieci.length);
}

/** „Wysunięcie”: węzeł trafia za swojego rodzica, poziom wyżej. */
export function wyzej(s: Szablon, id: string): Szablon {
  const r = rodzicWezla(s, id);
  const dziadek = r ? rodzicWezla(s, r.rodzic.id) : undefined;
  if (!r || !dziadek) return s;
  return przeniesWezel(s, id, dziadek.rodzic.id, dziadek.indeks + 1);
}

/** Opakowuje węzły (jednego rodzica, w kolejności) w nowy kontener. */
export function opakuj(
  s: Szablon,
  ids: readonly string[],
  typ: Kontener['typ'],
  nazwa: string,
): { szablon: Szablon; id: string } {
  const r = ids.length ? rodzicWezla(s, ids[0]!) : undefined;
  if (!r || ids.some((id) => rodzicWezla(s, id)?.rodzic.id !== r.rodzic.id))
    return { szablon: s, id: '' };
  const zbior = new Set(ids);
  const wSwobodnym = r.rodzic.typ === 'swobodny';
  const wybrane = r.rodzic.dzieci.filter((d) => zbior.has(d.id));
  const dzieci = wSwobodnym ? wybrane.map(bezPozycji) : wybrane;
  const pierwszy = r.rodzic.dzieci.findIndex((d) => zbior.has(d.id));
  // W kontenerze swobodnym nowy kontener dziedziczy całą `pozycja` pierwszego z opakowanych elementów
  // (x, y, kotwicę i obrót); opakowane elementy ją tracą i obracają się razem z kontenerem.
  const pozycja = wSwobodnym ? wybrane[0]?.pozycja : undefined;
  const nowy: Kontener = {
    id: noweIdWezla(s, typ),
    nazwa,
    typ,
    odstep: 1,
    ...(pozycja ? { pozycja: { ...pozycja } } : {}),
    dzieci,
  };
  const zmieniony = zmienWezel(s, r.rodzic.id, (k) => {
    const reszta = (k as Kontener).dzieci.filter((d) => !zbior.has(d.id));
    reszta.splice(pierwszy, 0, nowy);
    return { ...(k as Kontener), dzieci: reszta };
  });
  return { szablon: zmieniony, id: nowy.id };
}

/**
 * Kopia węzła (z dziećmi) za oryginałem: nowe identyfikatory i nowe klucze danych (kopia jest
 * osobnym polem karty), nazwa z dopiskiem.
 */
export function duplikujWezel(
  s: Szablon,
  id: string,
  dopisek: string,
  zajete: Iterable<string> = [],
): { szablon: Szablon; id: string } {
  const w = znajdzWezel(s, id);
  const r = rodzicWezla(s, id);
  if (!w || !r) return { szablon: s, id: '' };
  const ids = new Set(wszystkieWezly(s).map((x) => x.id));
  const klucze = new Set([...kluczeSzablonu(s), ...zajete]);
  const noweIds = new Map<string, string>();
  const kopia = mapuj(structuredClone(w), (x) => {
    const nid = unikalneId(x.id, ids);
    ids.add(nid);
    noweIds.set(x.id, nid);
    const y = { ...x, id: nid, ...(x.nazwa ? { nazwa: `${x.nazwa} ${dopisek}` } : {}) } as Wezel;
    if (czyKontener(y)) return y;
    // Etykieta równa nazwie idzie za nią (jak przy zmianie nazwy w panelu).
    if ((y.typ === 'tekst' || y.typ === 'wartosc') && y.etykieta && y.etykieta.tekst === x.nazwa)
      y.etykieta = { ...y.etykieta, tekst: y.nazwa! };
    if (y.klucz) {
      y.klucz = kluczZNazwy(y.nazwa ?? y.klucz, klucze);
      klucze.add(y.klucz);
    }
    if (y.typ === 'tabela')
      y.kolumny = y.kolumny.map((c) => {
        const k = kluczZNazwy(c.klucz, klucze);
        klucze.add(k);
        return { ...c, klucz: k };
      });
    return y;
  });
  // Obraz w kopii omija kopie pól, nie oryginały.
  const poprawiona = mapuj(kopia, (x) =>
    !czyKontener(x) && x.typ === 'obraz' && x.omijaj
      ? { ...x, omijaj: x.omijaj.map((id) => noweIds.get(id) ?? id) }
      : x,
  );
  // Kopia w kontenerze swobodnym leży 3 mm w prawo i w dół od oryginału (inaczej zakrywa go dokładnie).
  const poz = poprawiona.pozycja ?? { x: 0, y: 0 };
  const kopiaWPozycji: Wezel =
    r.rodzic.typ === 'swobodny'
      ? { ...poprawiona, pozycja: { ...poz, x: poz.x + 3, y: poz.y + 3 } }
      : poprawiona;
  return { szablon: wstawDo(s, r.rodzic.id, r.indeks + 1, kopiaWPozycji), id: poprawiona.id };
}

// --- Duplikowanie szablonu.

const escRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Nazwa kopii szablonu: „Nazwa (kopia)”, przy kolejnych „Nazwa (kopia 2)”, „(kopia 3)”… – pierwsza
 * wolna wśród `istniejace`. Kopia kopii wychodzi od nazwy bez dopisku („Nazwa (kopia)” → „Nazwa (kopia 2)”).
 * `sufiks(n)` to dopisek z i18n: `sufiks(1)` = „(kopia)”, `sufiks(n)` = „(kopia n)”.
 */
export function nazwaKopiiSzablonu(
  nazwa: string,
  istniejace: Iterable<string>,
  sufiks: (n: number) => string,
): string {
  const zajete = new Set(istniejace);
  // Wzorzec dopisku zbudowany z `sufiks(2)` (liczba → \d+) – działa w każdym języku.
  const dwa = escRegExp(sufiks(2)).replace('2', '\\d+');
  const dopisek = new RegExp(`\\s+(?:${escRegExp(sufiks(1))}|${dwa})$`);
  const baza = nazwa.replace(dopisek, '') || nazwa;
  for (let n = 1; ; n++) {
    const kandydat = `${baza} ${sufiks(n)}`;
    if (!zajete.has(kandydat)) return kandydat;
  }
}

/**
 * Głęboka kopia szablonu pod nowym `id` i nazwą: wszystkie węzły (korzeń i warianty układu) dostają
 * NOWE identyfikatory (rozłączne z oryginałem), a odwołania wewnątrz szablonu (`omijaj` obrazów)
 * są przepisane. Rozmiar, ramka, ozdobniki, położenia swobodne, klucze danych i dane przykładowe
 * zostają. `podklad` wskazuje ten sam zasób biblioteki, elementy biblioteki (ozdobniki, motywy)
 * – te same identyfikatory. Nic nie jest współdzielone z oryginałem (żaden obiekt).
 */
export function duplikujSzablon(s: Szablon, id: string, nazwa: string): Szablon {
  const kopia = structuredClone(s);
  const zajete = new Set(wszystkieWezly(s).map((w) => w.id));
  const kopiujDrzewo = (korzen: Kontener): Kontener => {
    const nowe = new Map<string, string>();
    for (const w of wezly(korzen)) {
      const baza = w.id.replace(/-\d+$/, '') || w.id;
      const nid = unikalneId(baza, zajete);
      zajete.add(nid);
      nowe.set(w.id, nid);
    }
    return mapuj(korzen, (w) => {
      const x = { ...w, id: nowe.get(w.id)! };
      return x.typ === 'obraz' && x.omijaj
        ? { ...x, omijaj: x.omijaj.map((o) => nowe.get(o) ?? o) }
        : x;
    }) as Kontener;
  };
  return {
    ...kopia,
    id,
    nazwa,
    korzen: kopiujDrzewo(kopia.korzen),
    ...(kopia.warianty
      ? {
          warianty: kopia.warianty.map((v) => ({ ...v, korzen: kopiujDrzewo(v.korzen) })),
        }
      : {}),
  };
}

/**
 * Duplikuje szablon w projekcie: kopia trafia tuż za oryginałem. Zwraca nowy projekt i `id` kopii
 * (pusty, gdy szablonu nie ma). Karty projektu nadal używają oryginału.
 */
export function duplikujSzablonWProjekcie(
  p: Projekt,
  szablonId: string,
  sufiks: (n: number) => string,
): { projekt: Projekt; id: string } {
  const i = p.szablony.findIndex((x) => x.id === szablonId);
  const s = p.szablony[i];
  if (!s) return { projekt: p, id: '' };
  const id = unikalneId(
    `${s.id.replace(/-kopia(-\d+)?$/, '')}-kopia`,
    new Set(p.szablony.map((x) => x.id)),
  );
  const nazwa = nazwaKopiiSzablonu(
    s.nazwa,
    p.szablony.map((x) => x.nazwa),
    sufiks,
  );
  const kopia = duplikujSzablon(s, id, nazwa);
  const szablony = [...p.szablony];
  szablony.splice(i + 1, 0, kopia);
  return { projekt: { ...p, zmieniono: new Date().toISOString(), szablony }, id };
}

// --- Projekt.

/** Zmiana szablonu w projekcie (bez zmiany kart). */
export function zmienSzablon(p: Projekt, szablonId: string, f: (s: Szablon) => Szablon): Projekt {
  const s = p.szablony.find((x) => x.id === szablonId);
  const nowy = s && f(s);
  // Operacja bez skutku (np. przesunięcie na brzegu) – ten sam projekt: bez kroku „Cofnij”.
  if (!s || nowy === s) return p;
  return {
    ...p,
    zmieniono: new Date().toISOString(),
    szablony: p.szablony.map((x) => (x.id === szablonId ? nowy! : x)),
  };
}

/** Klucze danych w kartach danego szablonu (także po usuniętych polach). */
export function kluczeDanychKart(p: Projekt, szablonId: string): Set<string> {
  const k = new Set<string>();
  for (const t of p.talie)
    for (const karta of t.karty)
      if (karta.szablonId === szablonId) for (const x of Object.keys(karta.dane)) k.add(x);
  return k;
}

// --- Nowy szablon.

/** Gotowe formaty kart (SPEC 3) – wymiary w pionie, mm. */
export const FORMATY_KART = [
  { id: 'poker', szer: 63, wys: 88 },
  { id: 'bridge', szer: 57, wys: 89 },
  { id: 'mini-euro', szer: 44, wys: 68 },
  { id: 'mini-american', szer: 41, wys: 63 },
  { id: 'tarot', szer: 70, wys: 120 },
  { id: 'kwadrat', szer: 70, wys: 70 },
] as const;

/** Neutralne układy startowe kreatora (P9) – ogólne punkty wyjścia, nie szablony gier. */
export const UKLADY_STARTOWE = [
  'swobodny',
  'tytul-opis',
  'tytul-siatka-opis-stopka',
  'pusty',
] as const;
export type UkladStartowy = (typeof UKLADY_STARTOWE)[number];

/** Nazwy elementów układów startowych (z i18n wołającego). */
export interface NazwyStartowe {
  karta: string;
  tytul: string;
  opis: string;
  siatka: string;
  wiersz: string;
  pole: (n: number) => string;
  stopka: string;
  stopkaLewa: string;
  stopkaPrawa: string;
}

/**
 * Nowy szablon karty w mm z układem startowym. Kolorowe tło karty – panele z treścią są białe,
 * żeby tekst był czytelny; na białej karcie panele nie mają tła.
 */
export function nowySzablon(
  id: string,
  o: { nazwa: string; szer: Mm; wys: Mm; promien: Mm; tlo: Kolor; uklad: UkladStartowy },
  n: NazwyStartowe,
): Szablon {
  const bialy = o.tlo.toLowerCase() === '#ffffff';
  const panel = bialy ? {} : { tlo: '#ffffff', promien: 1 };
  const s: Szablon = {
    id,
    nazwa: o.nazwa,
    rozmiar: { tryb: 'mm', szerokosc: o.szer, wysokosc: o.wys },
    ...(o.promien > 0 ? { promienRogow: o.promien } : {}),
    tlo: o.tlo,
    korzen: { id: 'karta', nazwa: n.karta, typ: 'kolumna', padding: 3, odstep: 1.5, dzieci: [] },
  };
  if (o.uklad === 'pusty') return s;
  // Pusta karta ze swobodnym korzeniem: dzieci mają własne położenia (X·Y w mm), bez paddingu.
  if (o.uklad === 'swobodny')
    return { ...s, korzen: { id: 'karta', nazwa: n.karta, typ: 'swobodny', dzieci: [] } };
  const dodaj = (sz: Szablon, cel: string, w: Wezel) => wstawWezel(sz, cel, w);
  let x = s;
  const tytul = { ...nowyWezel(x, 'tekst', n.tytul), wieleWierszy: false } as Pole;
  if (tytul.typ === 'tekst')
    tytul.styl = { ...tytul.styl, rozmiar: pt(12), wariant: 'pogrubiony', wyrownanie: 'srodek' };
  x = dodaj(x, 'karta', tytul);
  if (o.uklad === 'tytul-siatka-opis-stopka') {
    const siatka: Kontener = { ...(nowyWezel(x, 'kolumna', n.siatka) as Kontener), odstep: 0.5 };
    x = dodaj(x, 'karta', siatka);
    for (const w of [0, 1]) {
      const wiersz = {
        ...(nowyWezel(x, 'wiersz', `${n.wiersz} ${w + 1}`) as Kontener),
        odstep: 0.5,
      };
      x = dodaj(x, siatka.id, wiersz);
      for (const k of [1, 2]) {
        const pole = nowyWezel(x, 'etykieta-wartosc', n.pole(w * 2 + k));
        x = dodaj(x, wiersz.id, { ...pole, szerokosc: { wypelnij: 1 }, padding: 0.8, ...panel });
      }
    }
  }
  const opis = nowyWezel(x, 'tekst', n.opis);
  x = dodaj(x, 'karta', { ...opis, wysokosc: { wypelnij: 1 }, padding: 1.5, ...panel });
  if (o.uklad === 'tytul-siatka-opis-stopka') {
    const stopka: Kontener = {
      ...(nowyWezel(x, 'wiersz', n.stopka) as Kontener),
      rozklad: 'miedzy',
    };
    x = dodaj(x, 'karta', stopka);
    for (const nazwa of [n.stopkaLewa, n.stopkaPrawa]) {
      const p = nowyWezel(x, 'tekst', nazwa);
      x = dodaj(x, stopka.id, { ...p, wieleWierszy: false } as Pole);
    }
  }
  return x;
}

/**
 * Dane do podglądu szablonu: wartość przykładowa, a gdy jej nie ma – nazwa pola (tekst,
 * wartość, komórki tabeli), żeby pusty szablon miał widoczny układ.
 */
export function danePodgladu(s: Szablon): Record<string, string> {
  const dane: Record<string, string> = {};
  for (const w of wszystkieWezly(s)) {
    if (czyKontener(w)) continue;
    if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.klucz) dane[w.klucz] = w.nazwa || w.klucz;
    if (w.typ === 'tabela') for (const k of kluczeTabeli(w)) dane[k] = '–';
  }
  return {
    ...dane,
    ...Object.fromEntries(Object.entries(s.przyklad ?? {}).filter(([, v]) => v !== '')),
  };
}

/**
 * Nazwa karty dla użytkownika (etykiety, komunikaty): pole `nazwa`, a gdy go nie ma –
 * pierwsze niepuste pole tekstowe szablonu (w kolejności układu).
 */
export function nazwaKarty(dane: Record<string, string>, s: Szablon | undefined): string {
  if (dane.nazwa?.trim()) return dane.nazwa;
  for (const w of s ? wszystkieWezly(s) : []) {
    if (!czyKontener(w) && w.typ === 'tekst' && w.klucz && dane[w.klucz]?.trim())
      return dane[w.klucz]!;
  }
  return '';
}

/** Rodzaje pól, na które można zmienić typ elementu w panelu. */
export const TYPY_POL = [
  'tekst',
  'wartosc',
  'obraz',
  'znaczniki',
  'wpis',
  'ikona',
  'separator',
  'tabela',
] as const satisfies readonly Pole['typ'][];

/**
 * Zmiana typu pola: zostają id, nazwa, rozmiar, odstępy, tło, ramka i „gdy puste”; pole z danych
 * zostaje z danych (ten sam klucz), pole stałe – stałe (z tym samym tekstem). Styl tekstu
 * przechodzi między typami, które go mają; etykieta – między tekstem a wartością w kształcie.
 */
export function zmienTypPola(
  s: Szablon,
  id: string,
  typ: Pole['typ'],
  nazwaTypu: string = typ,
  zajete: Iterable<string> = [],
  bezKlucza = false,
): Szablon {
  const w = znajdzWezel(s, id);
  if (!w || czyKontener(w) || w.typ === typ) return s;
  const r = rodzicWezla(s, id);
  const nowy = nowyWezel(s, typ, w.nazwa || nazwaTypu, {
    wWierszu: r?.rodzic.typ === 'wiersz',
    zajete,
    bezKlucza,
  }) as Pole;
  const wspolne = (
    [
      'nazwa',
      'szerokosc',
      'wysokosc',
      'margines',
      'padding',
      'wyrownanie',
      'tlo',
      'obramowanie',
      'ozdoba',
      'narozniki',
      'promien',
      'krycie',
      'minSzerokosc',
      'minWysokosc',
      'pozycja',
      'gdyPuste',
    ] as const
  ).reduce<Record<string, unknown>>((a, k) => (w[k] !== undefined ? { ...a, [k]: w[k] } : a), {});
  const x = { ...nowy, ...wspolne, id } as Pole;
  if ('klucz' in nowy && nowy.klucz !== undefined) {
    if (!bezKlucza && w.klucz) x.klucz = w.klucz;
    else if (bezKlucza || x.typ === 'tekst' || x.typ === 'wartosc' || x.typ === 'obraz') {
      // Pole stałe zostaje stałe (również po zmianie typu na obraz w edytorze rewersu).
      delete x.klucz;
      if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.tekst !== undefined) {
        if (x.typ === 'tekst' || x.typ === 'wartosc') x.tekst = w.tekst;
      }
    }
  } else if (
    bezKlucza &&
    (x.typ === 'tekst' || x.typ === 'wartosc') &&
    (w.typ === 'tekst' || w.typ === 'wartosc') &&
    w.tekst !== undefined
  ) {
    x.tekst = w.tekst;
  }
  if (maStylTekstu(w) && maStylTekstu(x)) {
    x.styl = w.styl;
    if (w.grupaStyluId) x.grupaStyluId = w.grupaStyluId;
  }
  if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.etykieta) {
    if (x.typ === 'tekst') x.etykieta = w.etykieta;
    if (x.typ === 'wartosc')
      x.etykieta = {
        ...w.etykieta,
        pozycja: w.etykieta.pozycja === 'pod' ? 'pod' : 'nad',
      };
  }
  return zmienWezel(s, id, () => x);
}

/** Prostokąt dziecka w układzie jego rodzica (mm) – wynik układu z `renderujKarte(...).wezly`. */
export interface RamkaUkladu {
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
  /** Obrót własny węzła (ramka jest przed obrotem). */
  obrot?: number;
}

/** Układ do konwersji: identyfikator węzła → ramka w układzie rodzica (przed obrotem węzła). */
export type UkladWezlow = ReadonlyMap<string, RamkaUkladu>;

/** Zaokrąglenie do 0,001 mm – ułamki z układu nie zostawiają śmieci w szablonie. */
const zaokr = (v: number) => Math.round(v * 1000) / 1000;
const zaokr01 = (v: number) => Math.round(v * 100) / 100;

/**
 * Zmiana typu kontenera; separatory w nim obracają się (w wierszu – pionowe, w kolumnie – poziome).
 *
 * Konwersja na `swobodny` bierze położenia i rozmiary dzieci z `uklad` (wynik bieżącego układu), więc
 * nic na karcie się nie przesuwa: dziecko dostaje `pozycja` (lewy górny róg względem wnętrza kontenera)
 * i rozmiary w mm (stałe mm zostają, reszta jest zamieniana na wynik układu). Dzieci ukryte
 * (puste pola „ukryj”) nie mają wyniku – dostają X = Y = 0 i swoje dotychczasowe rozmiary.
 * Zamiana z `swobodny` na wiersz / kolumnę ustawia kolejność dzieci wg położenia
 * (kolumna: góra→dół, potem lewo→prawo; wiersz: lewo→prawo, potem góra→dół), a `pozycja` jest usuwana
 * (obrót i kotwica przepadają). Margines i wyrównanie dzieci nie działają w swobodnym, ale zostają w modelu.
 */
export function zmienTypKontenera(
  s: Szablon,
  id: string,
  typ: Kontener['typ'],
  uklad?: UkladWezlow,
): Szablon {
  const w = znajdzWezel(s, id);
  if (!w || !czyKontener(w) || w.typ === typ) return s;
  const kierunek: 'pionowy' | 'poziomy' | undefined =
    typ === 'wiersz' ? 'pionowy' : typ === 'kolumna' ? 'poziomy' : undefined;
  let dzieci: Wezel[] = w.dzieci.map((d) =>
    kierunek && !czyKontener(d) && d.typ === 'separator' ? { ...d, kierunek } : d,
  );
  if (typ === 'swobodny') {
    const rodzic = uklad?.get(id);
    const p = rozwinOdstepy(w.padding);
    dzieci = dzieci.map((d) => {
      const r = uklad?.get(d.id);
      if (!rodzic || !r) return { ...d, pozycja: { x: 0, y: 0 } } as Wezel;
      const mm = (stare: Wezel['szerokosc'], v: number) =>
        stare !== undefined && stare !== 'auto' && 'mm' in stare ? stare : { mm: zaokr(v) };
      return {
        ...d,
        pozycja: { x: zaokr(r.x - rodzic.x - p.lewo), y: zaokr(r.y - rodzic.y - p.gora) },
        szerokosc: mm(d.szerokosc, r.szer),
        wysokosc: mm(d.wysokosc, r.wys),
      } as Wezel;
    });
  } else if (w.typ === 'swobodny') {
    if (typ === 'kolumna' || typ === 'wiersz') {
      // Klucz sortowania: lewy górny róg prostokąta zajętego na karcie (po obrocie), z układu;
      // bez układu – `pozycja` z poprawką na kotwicę (kotwica prawa / dolna = dalej), 0,01 mm.
      const klucz = (d: Wezel) => {
        const r = uklad?.get(d.id);
        if (r) {
          const q = prostokatPoObrocie(r);
          return { x: zaokr01(q.x), y: zaokr01(q.y) };
        }
        const { fx, fy } = ulamkiKotwicy(d.pozycja?.kotwica);
        return {
          x: zaokr01(fx * 10000 + (d.pozycja?.x ?? 0)),
          y: zaokr01(fy * 10000 + (d.pozycja?.y ?? 0)),
        };
      };
      const z = [...dzieci.entries()];
      z.sort(([i, a], [j, b]) => {
        const ka = klucz(a);
        const kb = klucz(b);
        const [a1, b1, a2, b2] =
          typ === 'wiersz' ? [ka.x, kb.x, ka.y, kb.y] : [ka.y, kb.y, ka.x, kb.x];
        // Stabilnie: równe położenia zostają w kolejności rysowania.
        return a1 - b1 || a2 - b2 || i - j;
      });
      dzieci = z.map(([, d]) => d);
    }
    // Wszystkie typy poza swobodnym: `pozycja` (z obrotem i kotwicą) jest usuwana.
    dzieci = dzieci.map(bezPozycji);
  }
  return zmienWezel(s, id, () => ({ ...w, typ, dzieci }));
}

/** Kolejność rysowania dziecka kontenera swobodnego: ostatnie w drzewie jest na wierzchu. */
export type ZmianaKolejnosci = 'na-wierzch' | 'wyzej' | 'nizej' | 'na-spod';

export function zmienKolejnoscRysowania(s: Szablon, id: string, jak: ZmianaKolejnosci): Szablon {
  const r = rodzicWezla(s, id);
  if (!r) return s;
  if (jak === 'wyzej') return przesunWezel(s, id, 1);
  if (jak === 'nizej') return przesunWezel(s, id, -1);
  const cel = jak === 'na-wierzch' ? r.rodzic.dzieci.length - 1 : 0;
  if (r.indeks === cel) return s;
  return zmienWezel(s, r.rodzic.id, (k) => {
    const dzieci = [...(k as Kontener).dzieci];
    const [x] = dzieci.splice(r.indeks, 1);
    dzieci.splice(cel, 0, x!);
    return { ...(k as Kontener), dzieci };
  });
}

/**
 * Wartości startowe nowego elementu wstawionego do kontenera swobodnego: położenie (3, 3) i rozmiar
 * w mm (wypełnianie i brak rozmiaru nie mają tu sensu – rozmiar „wg treści” zostaje dla pól bez rozmiaru).
 */
export function dostosujDoSwobodnego(w: Wezel): Wezel {
  const wypelnij = (r: Wezel['szerokosc']) => r !== undefined && r !== 'auto' && 'wypelnij' in r;
  const x: Wezel = { ...w, pozycja: { x: 3, y: 3 } };
  // Separator ma jeden wymiar „długość” (30 mm), drugi – grubość – zostaje wg treści.
  if (!czyKontener(x) && x.typ === 'separator') {
    if (x.kierunek === 'pionowy') {
      delete x.szerokosc;
      if (x.wysokosc === undefined || wypelnij(x.wysokosc)) x.wysokosc = { mm: 30 };
    } else {
      delete x.wysokosc;
      if (x.szerokosc === undefined || wypelnij(x.szerokosc)) x.szerokosc = { mm: 30 };
    }
    return x;
  }
  if (wypelnij(x.szerokosc) || x.szerokosc === undefined) x.szerokosc = { mm: 30 };
  if (wypelnij(x.wysokosc)) x.wysokosc = { mm: czyKontener(x) || x.typ === 'obraz' ? 30 : 10 };
  else if (x.wysokosc === undefined && (czyKontener(x) || x.typ === 'obraz'))
    x.wysokosc = { mm: 30 };
  return x;
}

/** Ustawia kotwicę elementu, zachowując jego położenie na karcie (przelicza X i Y). */
export function zmienKotwice(
  p: NonNullable<Wezel['pozycja']>,
  nowa: Kotwica,
  rozmiary: { ramka: { szer: Mm; wys: Mm }; element: { szer: Mm; wys: Mm } } | undefined,
): NonNullable<Wezel['pozycja']> {
  if (!rozmiary) return { ...p, kotwica: nowa };
  const a = ulamkiKotwicy(p.kotwica);
  const b = ulamkiKotwicy(nowa);
  return {
    ...p,
    kotwica: nowa,
    x: zaokr(p.x + (a.fx - b.fx) * (rozmiary.ramka.szer - rozmiary.element.szer)),
    y: zaokr(p.y + (a.fy - b.fy) * (rozmiary.ramka.wys - rozmiary.element.wys)),
  };
}

/** Styl elementu do schowka „Kopiuj styl”: wygląd, odstępy, styl tekstu i etykiety, kształt, linie. */
export type SkopiowanyStyl = Record<string, unknown> & { stylEtykiety?: unknown };

/** Właściwości wyglądu wspólne dla elementów (bez treści, kluczy i struktury). */
const WYGLAD = [
  'tlo',
  'obramowanie',
  'ozdoba',
  'narozniki',
  'promien',
  'krycie',
  'padding',
  'margines',
] as const;
/** Właściwości wyglądu zależne od typu – kopiowane tylko do elementu, który je ma. */
const WYGLAD_TYPU = [
  'styl',
  'luk',
  'ksztalt',
  'ksztaltElement',
  'linie',
  'stylNaglowka',
  'tloNaglowka',
  'paddingKomorki',
  'kolor',
  'grubosc',
  'stylLinii',
  'przerwa',
  'rysunek',
  'zakonczenia',
  'srodek',
  'dlugosc',
  'odstepOdOzdoby',
  'srednica',
  'odstep',
] as const;

export function skopiujStyl(w: Wezel, szablon?: Szablon): SkopiowanyStyl {
  const x: SkopiowanyStyl = { typ: w.typ };
  const z = w as unknown as Record<string, unknown>;
  for (const k of [...WYGLAD, ...WYGLAD_TYPU]) if (z[k] !== undefined) x[k] = structuredClone(z[k]);
  if (szablon && maStylTekstu(w)) x.styl = structuredClone(stylPola(szablon, w));
  if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.etykieta?.styl)
    x.stylEtykiety = structuredClone(w.etykieta.styl);
  return x;
}

/**
 * Wkleja styl: wygląd (tło, ramka, rogi, odstępy) – do każdego elementu; reszta – tylko tam, gdzie
 * dany typ ją ma (np. styl tekstu do pól z tekstem, kształt do wartości, linie do tabeli).
 */
export function wklejStyl(w: Wezel, st: SkopiowanyStyl): Wezel {
  const x = { ...w } as unknown as Record<string, unknown>;
  for (const k of WYGLAD) {
    if (st[k] !== undefined) x[k] = structuredClone(st[k]);
    else delete x[k];
  }
  // Właściwości typu: z tego samego typu – wszystkie; z innego – tylko styl tekstu.
  const ten = st.typ === w.typ;
  for (const k of WYGLAD_TYPU) {
    const ma = k in x || (ten && st[k] !== undefined);
    if (!ma || (!ten && k !== 'styl')) continue;
    if (k === 'styl' && (typeof x.styl !== 'object' || typeof st.styl !== 'object')) continue;
    if (st[k] !== undefined) x[k] = structuredClone(st[k]);
    else if (ten) delete x[k];
  }
  if (maStylTekstu(w) && st.styl !== undefined) delete x.grupaStyluId;
  if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.etykieta) {
    const e = { ...w.etykieta };
    if (st.stylEtykiety !== undefined) e.styl = structuredClone(st.stylEtykiety) as typeof e.styl;
    else delete e.styl;
    x.etykieta = e;
  }
  return x as unknown as Wezel;
}

/** Układ do konwersji kontenerów z wyniku renderowania (`WyrenderowanaKarta.wezly`). */
export function ukladZWezlow(
  wezly: readonly { id: string; lokalne: RamkaUkladu; obrot?: number }[],
): UkladWezlow {
  return new Map(
    wezly.map((w) => [w.id, w.obrot ? { ...w.lokalne, obrot: w.obrot } : w.lokalne] as const),
  );
}
