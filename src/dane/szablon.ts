import { pt, type Mm } from '../model/jednostki';
import type { Projekt } from '../model/projekt';
import {
  czyKontener,
  kluczeTabeli,
  type Kolor,
  type Kontener,
  type Pole,
  type Szablon,
  type Wezel,
} from '../model/szablon';
import { unikalneId } from './czcionki';

/**
 * Edycja szablonu od zera: operacje na drzewie wierszy, kolumn i pól (czyste funkcje – projekt
 * na wejściu i wyjściu) oraz neutralne klocki startowe. Nic tu nie jest dobrane pod konkretną
 * grę – nazwy, rozmiary i style to ogólne wartości wyjściowe do zmiany w panelu właściwości.
 */

/** Rodzaje nowych elementów w menu „+ Dodaj”. `etykieta-wartosc` to pole tekstowe z etykietą nad. */
export type RodzajNowego = Kontener['typ'] | Pole['typ'] | 'etykieta-wartosc';

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
  } = {},
): Wezel {
  const id = noweIdWezla(s, rodzaj);
  const klucze = new Set([...kluczeSzablonu(s), ...(opcje.zajete ?? [])]);
  const klucz = () => kluczZNazwy(nazwa, klucze);
  switch (rodzaj) {
    case 'wiersz':
    case 'kolumna':
    case 'warstwy':
      return { id, nazwa, typ: rodzaj, odstep: 1, dzieci: [] };
    case 'tekst':
      return { id, nazwa, typ: 'tekst', klucz: klucz(), styl: tresc(9) };
    case 'etykieta-wartosc':
      return {
        id,
        nazwa,
        typ: 'tekst',
        klucz: klucz(),
        styl: tresc(9),
        // Etykieta mniejsza od wartości – bez innych upiększeń (kolor, wersaliki ustawia użytkownik).
        etykieta: { tekst: nazwa, pozycja: 'nad', styl: { rozmiar: pt(7) } },
      };
    case 'wartosc':
      return {
        id,
        nazwa,
        typ: 'wartosc',
        klucz: klucz(),
        ksztalt: 'prostokat',
        // Rozmiar wg treści (bez rozciągania na całą szerokość / wysokość rodzica).
        wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' },
        padding: 0.8,
        obramowanie: { grubosc: 0.3, kolor: CZARNY },
        styl: tresc(9),
      };
    case 'obraz':
      return {
        id,
        nazwa,
        typ: 'obraz',
        klucz: klucz(),
        dopasowanie: 'dopasuj',
        wysokosc: { wypelnij: 1 },
      };
    case 'znaczniki':
      return {
        id,
        nazwa,
        typ: 'znaczniki',
        klucz: klucz(),
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
        klucz: klucz(),
        styl: tresc(9),
        minWysokosc: 5,
        obramowanie: { grubosc: 0.25, kolor: CZARNY },
      };
    case 'ikona':
      return { id, nazwa, typ: 'ikona', ikona: 'gwiazdka', rozmiar: 4 };
    case 'separator':
      return {
        id,
        nazwa,
        typ: 'separator',
        kierunek: opcje.wWierszu ? 'pionowy' : 'poziomy',
        grubosc: 0.3,
      };
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
  return wstawDo(bez, rodzicId, Math.max(0, Math.min(j, dlugosc)), w);
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
  const dzieci = r.rodzic.dzieci.filter((d) => zbior.has(d.id));
  const pierwszy = r.rodzic.dzieci.findIndex((d) => zbior.has(d.id));
  const nowy: Kontener = { id: noweIdWezla(s, typ), nazwa, typ, odstep: 1, dzieci };
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
  return { szablon: wstawDo(s, r.rodzic.id, r.indeks + 1, poprawiona), id: poprawiona.id };
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
export const UKLADY_STARTOWE = ['pusty', 'tytul-opis', 'tytul-siatka-opis-stopka'] as const;
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
): Szablon {
  const w = znajdzWezel(s, id);
  if (!w || czyKontener(w) || w.typ === typ) return s;
  const r = rodzicWezla(s, id);
  const nowy = nowyWezel(s, typ, w.nazwa || nazwaTypu, {
    wWierszu: r?.rodzic.typ === 'wiersz',
    zajete,
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
      'narozniki',
      'promien',
      'minSzerokosc',
      'minWysokosc',
      'gdyPuste',
    ] as const
  ).reduce<Record<string, unknown>>((a, k) => (w[k] !== undefined ? { ...a, [k]: w[k] } : a), {});
  const x = { ...nowy, ...wspolne, id } as Pole;
  if ('klucz' in nowy && nowy.klucz !== undefined) {
    if (w.klucz) x.klucz = w.klucz;
    else if (x.typ === 'tekst' || x.typ === 'wartosc') {
      // Pole stałe zostaje stałe.
      delete x.klucz;
      if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.tekst !== undefined) x.tekst = w.tekst;
    }
  }
  if ('styl' in w && 'styl' in x && typeof w.styl === 'object' && typeof x.styl === 'object')
    (x as { styl: unknown }).styl = w.styl;
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

/** Zmiana typu kontenera; separatory w nim obracają się (w wierszu – pionowe, w kolumnie – poziome). */
export function zmienTypKontenera(s: Szablon, id: string, typ: Kontener['typ']): Szablon {
  const w = znajdzWezel(s, id);
  if (!w || !czyKontener(w) || w.typ === typ) return s;
  const kierunek = typ === 'wiersz' ? 'pionowy' : typ === 'kolumna' ? 'poziomy' : undefined;
  return zmienWezel(s, id, () => ({
    ...w,
    typ,
    dzieci: w.dzieci.map((d) =>
      kierunek && !czyKontener(d) && d.typ === 'separator' ? { ...d, kierunek } : d,
    ),
  }));
}

/** Styl elementu do schowka „Kopiuj styl”: wygląd, odstępy, styl tekstu i etykiety, kształt, linie. */
export type SkopiowanyStyl = Record<string, unknown> & { stylEtykiety?: unknown };

/** Właściwości wyglądu wspólne dla elementów (bez treści, kluczy i struktury). */
const WYGLAD = ['tlo', 'obramowanie', 'narozniki', 'promien', 'padding', 'margines'] as const;
/** Właściwości wyglądu zależne od typu – kopiowane tylko do elementu, który je ma. */
const WYGLAD_TYPU = [
  'styl',
  'ksztalt',
  'linie',
  'stylNaglowka',
  'tloNaglowka',
  'paddingKomorki',
  'kolor',
  'grubosc',
  'stylLinii',
  'przerwa',
  'srednica',
  'odstep',
] as const;

export function skopiujStyl(w: Wezel): SkopiowanyStyl {
  const x: SkopiowanyStyl = { typ: w.typ };
  const z = w as unknown as Record<string, unknown>;
  for (const k of [...WYGLAD, ...WYGLAD_TYPU]) if (z[k] !== undefined) x[k] = structuredClone(z[k]);
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
  if ((w.typ === 'tekst' || w.typ === 'wartosc') && w.etykieta) {
    const e = { ...w.etykieta };
    if (st.stylEtykiety !== undefined) e.styl = structuredClone(st.stylEtykiety) as typeof e.styl;
    else delete e.styl;
    x.etykieta = e;
  }
  return x as unknown as Wezel;
}
