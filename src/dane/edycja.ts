import type { Arkusz, UstawieniaArkusza } from '../model/arkusz';
import type { DaneZasobow, OpisZasobu, Projekt } from '../model/projekt';
import {
  czyKontener,
  type Karta,
  type Pole,
  type Szablon,
  type Talia,
  type UstawieniaObrazu,
  type WariantCzcionki,
  type Wezel,
} from '../model/szablon';
import { unikalneId } from './czcionki';

/*
 * Edycja projektu jako czyste funkcje: każda zwraca nowy projekt (z nową datą zmiany),
 * nie modyfikując wejścia – stan UI i zapis do bazy dostają niezmienne dane.
 */

const teraz = () => new Date().toISOString();

function zmienTalie(p: Projekt, taliaId: string, f: (t: Talia) => Talia): Projekt {
  return { ...p, zmieniono: teraz(), talie: p.talie.map((t) => (t.id === taliaId ? f(t) : t)) };
}

function zmienKarte(p: Projekt, taliaId: string, kartaId: string, f: (k: Karta) => Karta): Projekt {
  return zmienTalie(p, taliaId, (t) => ({
    ...t,
    karty: t.karty.map((k) => (k.id === kartaId ? f(k) : k)),
  }));
}

/** Kolumna tabeli danych talii. */
export interface KolumnaDanych {
  klucz: string;
  /** Nazwa dla użytkownika – z parametru szablonu albo z klucza. */
  nazwa: string;
  rodzaj: 'pole' | 'parametr';
  /** Typ pola (np. `obraz`, `znaczniki`) – dla pól. */
  typPola?: Pole['typ'];
  /** Wartość domyślna parametru (podpowiedź w pustej komórce). */
  domyslnie?: string;
}

function* polaWezla(w: Wezel): Generator<Pole> {
  if (czyKontener(w)) for (const d of w.dzieci) yield* polaWezla(d);
  else yield w;
}

function nazwaKlucza(klucz: string): string {
  return klucz.charAt(0).toUpperCase() + klucz.slice(1);
}

/** Kolumny danych jednego szablonu: pola z kluczem (wszystkie warianty), potem parametry. */
export function kolumnySzablonu(s: Szablon): KolumnaDanych[] {
  const wynik = new Map<string, KolumnaDanych>();
  for (const korzen of [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)]) {
    for (const pole of polaWezla(korzen)) {
      if (pole.klucz && !wynik.has(pole.klucz)) {
        wynik.set(pole.klucz, {
          klucz: pole.klucz,
          nazwa: nazwaKlucza(pole.klucz),
          rodzaj: 'pole',
          typPola: pole.typ,
        });
      }
    }
  }
  for (const par of s.parametry ?? []) {
    if (!wynik.has(par.klucz)) {
      wynik.set(par.klucz, {
        klucz: par.klucz,
        nazwa: par.nazwa,
        rodzaj: 'parametr',
        domyslnie: par.domyslnie,
      });
    }
  }
  return [...wynik.values()];
}

/** Kolumny tabeli talii – suma kolumn szablonów użytych w talii, w kolejności wystąpienia. */
export function kolumnyTalii(
  talia: Talia,
  szablony: ReadonlyMap<string, Szablon>,
): KolumnaDanych[] {
  const wynik = new Map<string, KolumnaDanych>();
  for (const id of new Set(talia.karty.map((k) => k.szablonId))) {
    const s = szablony.get(id);
    if (!s) continue;
    for (const k of kolumnySzablonu(s)) if (!wynik.has(k.klucz)) wynik.set(k.klucz, k);
  }
  return [...wynik.values()];
}

/** Rozmiary w slotach do wyboru: domyślny, warianty szablonu i typowe 1×1, 2×1, 1×2, 2×2. */
export function rozmiaryKarty(s: Szablon): { kolumny: number; rzedy: number }[] {
  if (s.rozmiar.tryb !== 'sloty') return [];
  const lista = [
    { kolumny: s.rozmiar.kolumny, rzedy: s.rozmiar.rzedy },
    ...(s.warianty ?? []).map(({ kolumny, rzedy }) => ({ kolumny, rzedy })),
    { kolumny: 1, rzedy: 1 },
    { kolumny: 2, rzedy: 1 },
    { kolumny: 1, rzedy: 2 },
    { kolumny: 2, rzedy: 2 },
  ];
  const widziane = new Set<string>();
  return lista.filter((r) => {
    const k = `${r.kolumny}x${r.rzedy}`;
    if (widziane.has(k)) return false;
    widziane.add(k);
    return true;
  });
}

function wszystkieIdKart(p: Projekt): Set<string> {
  return new Set(p.talie.flatMap((t) => t.karty.map((k) => k.id)));
}

/** Dodaje pustą kartę (po `poKarcie` albo na końcu); zwraca projekt i id karty. */
export function dodajKarte(
  p: Projekt,
  taliaId: string,
  szablonId: string,
  poKarcie?: string,
): { projekt: Projekt; kartaId: string } {
  const kartaId = unikalneId('karta', wszystkieIdKart(p));
  const nowa: Karta = { id: kartaId, szablonId, dane: {}, ilosc: 1 };
  const projekt = zmienTalie(p, taliaId, (t) => {
    const i = poKarcie ? t.karty.findIndex((k) => k.id === poKarcie) : -1;
    const karty = [...t.karty];
    karty.splice(i >= 0 ? i + 1 : karty.length, 0, nowa);
    return { ...t, karty };
  });
  return { projekt, kartaId };
}

/** Kopia karty tuż za oryginałem (także w tej samej grupie). */
export function kopiujKarte(
  p: Projekt,
  taliaId: string,
  kartaId: string,
): { projekt: Projekt; kartaId: string } {
  const nowyId = unikalneId(`${kartaId}-kopia`, wszystkieIdKart(p));
  const projekt = zmienTalie(p, taliaId, (t) => {
    const i = t.karty.findIndex((k) => k.id === kartaId);
    const zrodlo = t.karty[i];
    if (!zrodlo) return t;
    const karty = [...t.karty];
    karty.splice(i + 1, 0, { ...structuredClone(zrodlo), id: nowyId });
    const grupy = t.grupy?.map((g) => {
      const j = g.karty.indexOf(kartaId);
      if (j < 0) return g;
      const ids = [...g.karty];
      ids.splice(j + 1, 0, nowyId);
      return { ...g, karty: ids };
    });
    return { ...t, karty, ...(grupy ? { grupy } : {}) };
  });
  return { projekt, kartaId: nowyId };
}

/** Usuwa kartę razem z odwołaniami (grupy talii, przypięcia na arkuszach). */
export function usunKarte(p: Projekt, taliaId: string, kartaId: string): Projekt {
  const projekt = zmienTalie(p, taliaId, (t) => {
    const grupy = t.grupy?.map((g) => ({ ...g, karty: g.karty.filter((id) => id !== kartaId) }));
    return { ...t, karty: t.karty.filter((k) => k.id !== kartaId), ...(grupy ? { grupy } : {}) };
  });
  return {
    ...projekt,
    arkusze: projekt.arkusze.map((a) =>
      a.taliaId === taliaId && a.przypiete?.some((x) => x.kartaId === kartaId)
        ? { ...a, przypiete: a.przypiete.filter((x) => x.kartaId !== kartaId) }
        : a,
    ),
  };
}

/** Przesuwa kartę o `o` pozycji w talii (kolejność druku). */
export function przesunKarte(p: Projekt, taliaId: string, kartaId: string, o: number): Projekt {
  return zmienTalie(p, taliaId, (t) => {
    const i = t.karty.findIndex((k) => k.id === kartaId);
    const j = Math.max(0, Math.min(t.karty.length - 1, i + o));
    if (i < 0 || i === j) return t;
    const karty = [...t.karty];
    const [k] = karty.splice(i, 1);
    karty.splice(j, 0, k!);
    return { ...t, karty };
  });
}

/** Ustawia wartość pola; pusty tekst usuwa klucz (pole „puste” – zachowanie wg szablonu). */
export function ustawDane(
  p: Projekt,
  taliaId: string,
  kartaId: string,
  klucz: string,
  wartosc: string,
): Projekt {
  return zmienKarte(p, taliaId, kartaId, (k) => {
    const dane = { ...k.dane };
    if (wartosc === '') delete dane[klucz];
    else dane[klucz] = wartosc;
    return { ...k, dane };
  });
}

/** Ilość sztuk; przypięcia ponad nową ilość (na arkuszach tej talii) są usuwane – od końca. */
export function ustawIlosc(p: Projekt, taliaId: string, kartaId: string, ilosc: number): Projekt {
  const n = Number.isFinite(ilosc) ? Math.max(0, Math.min(999, Math.round(ilosc))) : 0;
  const x = zmienKarte(p, taliaId, kartaId, (k) => ({ ...k, ilosc: n }));
  return {
    ...x,
    arkusze: x.arkusze.map((a) => {
      if (a.taliaId !== taliaId || !a.przypiete) return a;
      let zostaje = n;
      const przypiete = a.przypiete.filter((pp) => pp.kartaId !== kartaId || zostaje-- > 0);
      return przypiete.length === a.przypiete.length ? a : { ...a, przypiete };
    }),
  };
}

/** Zmienia szablon karty; dane zostają (klucze wspólne działają, reszta jest ignorowana). */
export function ustawSzablon(
  p: Projekt,
  taliaId: string,
  kartaId: string,
  szablonId: string,
): Projekt {
  return zmienKarte(p, taliaId, kartaId, (k) => {
    const { rozmiar: _r, ...reszta } = k;
    void _r;
    return { ...reszta, szablonId };
  });
}

/** Rozmiar w slotach; rozmiar równy domyślnemu szablonu zapisywany jako brak nadpisania. */
export function ustawRozmiar(
  p: Projekt,
  taliaId: string,
  kartaId: string,
  rozmiar: { kolumny: number; rzedy: number },
  szablon: Szablon,
): Projekt {
  return zmienKarte(p, taliaId, kartaId, (k) => {
    const { rozmiar: _r, ...reszta } = k;
    void _r;
    const r = szablon.rozmiar;
    const domyslny =
      r.tryb === 'sloty' && r.kolumny === rozmiar.kolumny && r.rzedy === rozmiar.rzedy;
    return domyslny ? reszta : { ...reszta, rozmiar: { ...rozmiar } };
  });
}

/** Ustawienia obrazu pola karty; `undefined` lub puste – reset (usunięcie wpisu). */
export function ustawObrazKarty(
  p: Projekt,
  taliaId: string,
  kartaId: string,
  poleId: string,
  u: UstawieniaObrazu | undefined,
): Projekt {
  return zmienKarte(p, taliaId, kartaId, (k) => {
    const obrazy = { ...k.obrazy };
    if (!u || Object.keys(u).length === 0) delete obrazy[poleId];
    else obrazy[poleId] = u;
    const { obrazy: _o, ...reszta } = k;
    void _o;
    return Object.keys(obrazy).length ? { ...reszta, obrazy } : reszta;
  });
}

/** Zmiana nazwy talii. */
export function ustawNazweTalii(p: Projekt, taliaId: string, nazwa: string): Projekt {
  return zmienTalie(p, taliaId, (t) => ({ ...t, nazwa }));
}

// ---------------------------------------------------------------------------------------------
// Biblioteka zasobów i role czcionek

/** Role czcionek: przypisane w projekcie oraz użyte w stylach szablonów (nazwy, które nie są rodziną). */
export function roleProjektu(p: Projekt): string[] {
  const rodziny = new Set(p.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])));
  const role = new Set(Object.keys(p.role));
  const style = (w: Wezel) => {
    for (const x of polaWezla(w)) {
      const nazwy = [
        'styl' in x ? x.styl.czcionka : undefined,
        x.typ === 'tekst' ? x.etykieta?.styl?.czcionka : undefined,
      ];
      for (const n of nazwy) if (n && !rodziny.has(n)) role.add(n);
    }
  };
  for (const s of p.szablony) [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)].forEach(style);
  for (const a of p.arkusze) {
    const u = a.ustawienia;
    for (const n of [u.tytul?.styl.czcionka, u.grupy?.styl.czcionka, u.grupy?.stylOpisu.czcionka]) {
      if (n && !rodziny.has(n)) role.add(n);
    }
  }
  return [...role];
}

/** Przypisuje rolę do rodziny (pusta rodzina usuwa przypisanie). */
export function ustawRole(p: Projekt, rola: string, rodzina: string): Projekt {
  const role = { ...p.role };
  if (rodzina) role[rola] = rodzina;
  else delete role[rola];
  return { ...p, role, zmieniono: teraz() };
}

/** Zmienia nazwę rodziny we wszystkich jej czcionkach i w rolach, które na nią wskazują. */
export function zmienNazweRodziny(p: Projekt, stara: string, nowa: string): Projekt {
  if (!nowa || stara === nowa) return p;
  return {
    ...p,
    zmieniono: teraz(),
    zasoby: p.zasoby.map((z) =>
      z.rodzaj === 'czcionka' && z.rodzina === stara ? { ...z, rodzina: nowa } : z,
    ),
    role: Object.fromEntries(Object.entries(p.role).map(([r, f]) => [r, f === stara ? nowa : f])),
  };
}

export function ustawWariantCzcionki(p: Projekt, id: string, wariant: WariantCzcionki): Projekt {
  return {
    ...p,
    zmieniono: teraz(),
    zasoby: p.zasoby.map((z) => (z.rodzaj === 'czcionka' && z.id === id ? { ...z, wariant } : z)),
  };
}

/** Dodaje zasoby do biblioteki (opisy i bajty). */
export function dodajZasoby(
  p: Projekt,
  dane: DaneZasobow,
  nowe: { opis: OpisZasobu; dane: Uint8Array }[],
): { projekt: Projekt; dane: DaneZasobow } {
  const noweDane = new Map(dane);
  for (const n of nowe) noweDane.set(n.opis.id, n.dane);
  return {
    projekt: { ...p, zasoby: [...p.zasoby, ...nowe.map((n) => n.opis)], zmieniono: teraz() },
    dane: noweDane,
  };
}

/** Usuwa zasób z biblioteki (odwołania zostają – projekt pokaże ostrzeżenie, nie błąd). */
export function usunZasob(
  p: Projekt,
  dane: DaneZasobow,
  id: string,
): { projekt: Projekt; dane: DaneZasobow } {
  const noweDane = new Map(dane);
  noweDane.delete(id);
  return {
    projekt: { ...p, zasoby: p.zasoby.filter((z) => z.id !== id), zmieniono: teraz() },
    dane: noweDane,
  };
}

// ---------------------------------------------------------------------------------------------
// Arkusze: ustawienia i ręczna korekta (przypięcia)

function zmienArkusz(p: Projekt, arkuszId: string, f: (a: Arkusz) => Arkusz): Projekt {
  return {
    ...p,
    zmieniono: teraz(),
    arkusze: p.arkusze.map((a) => (a.id === arkuszId ? f(a) : a)),
  };
}

export function ustawUstawieniaArkusza(
  p: Projekt,
  arkuszId: string,
  zmiana: Partial<UstawieniaArkusza>,
): Projekt {
  return zmienArkusz(p, arkuszId, (a) => ({ ...a, ustawienia: { ...a.ustawienia, ...zmiana } }));
}

export function ustawTytulArkusza(p: Projekt, arkuszId: string, tekst: string): Projekt {
  return zmienArkusz(p, arkuszId, (a) =>
    a.ustawienia.tytul
      ? { ...a, ustawienia: { ...a.ustawienia, tytul: { ...a.ustawienia.tytul, tekst } } }
      : a,
  );
}

export interface Polozenie {
  kartaId: string;
  strona: number;
  kolumna: number;
  rzad: number;
}

export type BladPrzypiecia = 'poza-siatka' | 'koliduje';

const nachodza = (
  a: { kolumna: number; rzad: number; kolumny: number; rzedy: number },
  b: { kolumna: number; rzad: number; kolumny: number; rzedy: number },
) =>
  a.kolumna < b.kolumna + b.kolumny &&
  b.kolumna < a.kolumna + a.kolumny &&
  a.rzad < b.rzad + b.rzedy &&
  b.rzad < a.rzad + a.rzedy;

/**
 * Przypina egzemplarz karty do slotu (ręczna korekta). `z` – obecne położenie egzemplarza,
 * gdy był przypięty (przypięcie jest przenoszone), inaczej dodawane jest nowe. Cel musi mieścić
 * się w siatce i nie nachodzić na inne przypięte karty (wyjątek: przypięta karta tego samego
 * rozmiaru w slocie docelowym – wtedy karty zamieniają się miejscami); karty rozmieszczone
 * automatycznie ustąpią miejsca przy przeliczeniu.
 */
export function przypnijKarte(
  p: Projekt,
  arkuszId: string,
  z: Polozenie | undefined,
  cel: Polozenie,
  rozmiar: (kartaId: string) => { kolumny: number; rzedy: number },
  siatka: { kolumny: number; rzedy: number },
): { projekt: Projekt } | { blad: BladPrzypiecia } {
  const arkusz = p.arkusze.find((a) => a.id === arkuszId);
  if (!arkusz) return { blad: 'poza-siatka' };
  const r = rozmiar(cel.kartaId);
  if (
    cel.kolumna < 0 ||
    cel.rzad < 0 ||
    cel.strona < 0 ||
    cel.kolumna + r.kolumny > siatka.kolumny ||
    cel.rzad + r.rzedy > siatka.rzedy
  ) {
    return { blad: 'poza-siatka' };
  }
  const takiSam = (
    x: { kartaId: string; kolumna: number; rzad: number; strona?: number },
    y?: Polozenie,
  ) =>
    !!y &&
    x.kartaId === y.kartaId &&
    x.kolumna === y.kolumna &&
    x.rzad === y.rzad &&
    (x.strona ?? 0) === y.strona;
  const inne = (arkusz.przypiete ?? []).filter((x) => !takiSam(x, z));
  const kolidujace = inne.filter(
    (x) =>
      (x.strona ?? 0) === cel.strona && nachodza({ ...x, ...rozmiar(x.kartaId) }, { ...cel, ...r }),
  );
  const nowe = przypiecie(cel);
  if (kolidujace.length === 0) {
    return { projekt: zmienArkusz(p, arkuszId, (a) => ({ ...a, przypiete: [...inne, nowe] })) };
  }
  // Zamiana miejscami: przypięta karta przeniesiona na inną przypiętą kartę tego samego rozmiaru,
  // zaczynającą się w slocie docelowym.
  const [druga] = kolidujace;
  const r2 = druga && rozmiar(druga.kartaId);
  if (
    z &&
    kolidujace.length === 1 &&
    druga &&
    r2 &&
    druga.kolumna === cel.kolumna &&
    druga.rzad === cel.rzad &&
    r2.kolumny === r.kolumny &&
    r2.rzedy === r.rzedy
  ) {
    const zamieniona = przypiecie({ ...z, kartaId: druga.kartaId });
    return {
      projekt: zmienArkusz(p, arkuszId, (a) => ({
        ...a,
        przypiete: [...inne.map((x) => (x === druga ? zamieniona : x)), nowe],
      })),
    };
  }
  return { blad: 'koliduje' };
}

const przypiecie = (x: Polozenie) => ({
  kartaId: x.kartaId,
  kolumna: x.kolumna,
  rzad: x.rzad,
  ...(x.strona ? { strona: x.strona } : {}),
});

/** Odpina egzemplarz (wraca do rozmieszczania automatycznego). */
export function odepnijKarte(p: Projekt, arkuszId: string, z: Polozenie): Projekt {
  return zmienArkusz(p, arkuszId, (a) => {
    const przypiete = (a.przypiete ?? []).filter(
      (x) =>
        !(
          x.kartaId === z.kartaId &&
          x.kolumna === z.kolumna &&
          x.rzad === z.rzad &&
          (x.strona ?? 0) === z.strona
        ),
    );
    const { przypiete: _p, ...reszta } = a;
    void _p;
    return przypiete.length ? { ...reszta, przypiete } : reszta;
  });
}

export function odepnijWszystkie(p: Projekt, arkuszId: string): Projekt {
  return zmienArkusz(p, arkuszId, (a) => {
    const { przypiete: _p, ...reszta } = a;
    void _p;
    return reszta;
  });
}

/** Przypina wszystkie karty tam, gdzie są teraz – układ nie zmieni się przy edycji talii. */
export function zamrozUklad(p: Projekt, arkuszId: string, polozenia: Polozenie[]): Projekt {
  return zmienArkusz(p, arkuszId, (a) => ({
    ...a,
    przypiete: polozenia.map(przypiecie),
  }));
}
