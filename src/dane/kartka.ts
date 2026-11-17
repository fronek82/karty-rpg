import {
  MIESZANE_DOMYSLNE,
  type Arkusz,
  type NaglowekGrupy,
  type PrzypietaKarta,
} from '../model/arkusz';
import type { Projekt } from '../model/projekt';
import type { Karta, Szablon, Talia } from '../model/szablon';
import { unikalneId } from './czcionki';

/*
 * Operacje edytora kartki – czyste funkcje na projekcie w modelu kartki (każda karta osobno,
 * przypięta w slocie; patrz `src/druk/normalizacja.ts`). Każda zwraca nowy projekt albo kod
 * błędu – nigdy nie zostawia kart nachodzących na siebie ani wychodzących poza siatkę.
 */

export interface Siatka {
  kolumny: number;
  rzedy: number;
}

export interface KontekstKartki {
  szablony: ReadonlyMap<string, Szablon>;
  /** Wymiary siatki w slotach (z silnika arkusza – zależą od tytułu i nagłówków). */
  siatka: Siatka;
}

export interface Polozenie {
  strona: number;
  kolumna: number;
  rzad: number;
}

export interface Rozmiar {
  kolumny: number;
  rzedy: number;
}

export interface KartaNaKartce extends Polozenie, Rozmiar {
  karta: Karta;
}

export type BladKartki = 'brak-miejsca' | 'koliduje' | 'poza-siatka' | 'strona-niepusta';

const teraz = () => new Date().toISOString();

function arkuszITalia(p: Projekt, arkuszId: string): { arkusz: Arkusz; talia: Talia } {
  const arkusz = p.arkusze.find((a) => a.id === arkuszId);
  const talia = arkusz && p.talie.find((t) => t.id === arkusz.taliaId);
  if (!arkusz || !talia) throw new Error(`Brak arkusza „${arkuszId}”.`);
  return { arkusz, talia };
}

function zmienKartke(
  p: Projekt,
  arkuszId: string,
  f: (a: Arkusz, t: Talia) => { arkusz: Arkusz; talia: Talia },
): Projekt {
  const { arkusz, talia } = arkuszITalia(p, arkuszId);
  const w = f(arkusz, talia);
  return {
    ...p,
    zmieniono: teraz(),
    arkusze: p.arkusze.map((a) => (a.id === arkuszId ? w.arkusz : a)),
    talie: p.talie.map((t) => (t.id === talia.id ? w.talia : t)),
  };
}

/** Rozmiar karty w slotach (nadpisany w karcie albo domyślny szablonu). */
export function rozmiarKarty(k: Karta, szablony: ReadonlyMap<string, Szablon>): Rozmiar {
  const s = szablony.get(k.szablonId);
  if (k.rozmiar) return k.rozmiar;
  return s?.rozmiar.tryb === 'sloty'
    ? { kolumny: s.rozmiar.kolumny, rzedy: s.rozmiar.rzedy }
    : { kolumny: 1, rzedy: 1 };
}

/** Czy kartka ma mieszane rozmiary kart (pasy zamiast siatki slotów). */
export const czyMieszane = (a: Arkusz): boolean => a.ustawienia.rozmiary === 'mieszane';

/**
 * Karty kartki z położeniem i rozmiarem (kolejność jak przypięcia). W trybie mieszanym nie ma
 * slotów: zwracane są karty na kartce (ilość ≥ 1) w kolejności talii z położeniem zerowym –
 * rzeczywiste położenie w mm daje `WynikArkusza.mieszane`.
 */
export function kartyKartki(
  p: Projekt,
  arkuszId: string,
  szablony: ReadonlyMap<string, Szablon>,
): KartaNaKartce[] {
  const { arkusz, talia } = arkuszITalia(p, arkuszId);
  if (czyMieszane(arkusz))
    return talia.karty
      .filter((k) => k.ilosc >= 1)
      .map((karta) => ({
        karta,
        strona: 0,
        kolumna: 0,
        rzad: 0,
        ...rozmiarKarty(karta, szablony),
      }));
  return (arkusz.przypiete ?? []).flatMap((x) => {
    const karta = talia.karty.find((k) => k.id === x.kartaId);
    return karta
      ? [
          {
            karta,
            strona: x.strona ?? 0,
            kolumna: x.kolumna,
            rzad: x.rzad,
            ...rozmiarKarty(karta, szablony),
          },
        ]
      : [];
  });
}

/** Liczba stron kartki: zapisana, ale nie mniej niż strony z kartami i nie mniej niż 1. */
export function liczbaStronKartki(p: Projekt, arkuszId: string): number {
  const { arkusz } = arkuszITalia(p, arkuszId);
  return Math.max(
    1,
    arkusz.liczbaStron ?? 1,
    ...(arkusz.przypiete ?? []).map((x) => (x.strona ?? 0) + 1),
  );
}

const nachodza = (a: Polozenie & Rozmiar, b: Polozenie & Rozmiar) =>
  a.strona === b.strona &&
  a.kolumna < b.kolumna + b.kolumny &&
  b.kolumna < a.kolumna + a.kolumny &&
  a.rzad < b.rzad + b.rzedy &&
  b.rzad < a.rzad + a.rzedy;

/**
 * Czy prostokąty mieszczą się w siatce, nie nachodzą na karty spoza `pomin` ani na siebie
 * i nie przechodzą przez odstęp przed grupą (karta nie może być przecięta odstępem).
 */
function sprawdz(
  arkusz: Arkusz,
  inne: KartaNaKartce[],
  pola: (Polozenie & Rozmiar)[],
  siatka: Siatka,
): BladKartki | undefined {
  for (const [i, c] of pola.entries()) {
    if (
      c.strona < 0 ||
      c.kolumna < 0 ||
      c.rzad < 0 ||
      c.kolumna + c.kolumny > siatka.kolumny ||
      c.rzad + c.rzedy > siatka.rzedy
    ) {
      return 'poza-siatka';
    }
    const odstep = (arkusz.naglowki ?? []).some(
      (h) =>
        h.strona === c.strona &&
        (h.odstepPrzed ?? 0) > 0 &&
        h.kolumna > c.kolumna &&
        h.kolumna < c.kolumna + c.kolumny,
    );
    if (odstep) return 'koliduje';
    if (inne.some((k) => nachodza(k, c)) || pola.slice(0, i).some((k) => nachodza(k, c))) {
      return 'koliduje';
    }
  }
  return undefined;
}

/** Pierwsze wolne miejsce na rozmiar `r`, zaczynając od `od` (dalej wierszami, potem strony). */
function wolneMiejsce(
  arkusz: Arkusz,
  zajete: KartaNaKartce[],
  r: Rozmiar,
  od: Polozenie,
  siatka: Siatka,
  maksStron: number,
): Polozenie | undefined {
  for (let s = od.strona; s < maksStron; s++) {
    for (let rz = s === od.strona ? od.rzad : 0; rz < siatka.rzedy; rz++) {
      for (let k = s === od.strona && rz === od.rzad ? od.kolumna : 0; k < siatka.kolumny; k++) {
        const pol = { strona: s, kolumna: k, rzad: rz };
        if (!sprawdz(arkusz, zajete, [{ ...pol, ...r }], siatka)) return pol;
      }
    }
  }
  return undefined;
}

const przypiecie = (kartaId: string, x: Polozenie): PrzypietaKarta => ({
  kartaId,
  kolumna: x.kolumna,
  rzad: x.rzad,
  ...(x.strona ? { strona: x.strona } : {}),
});

function noweId(p: Projekt): (baza: string) => string {
  const zajete = new Set(p.talie.flatMap((t) => t.karty.map((k) => k.id)));
  return (baza) => {
    const id = unikalneId(baza, zajete);
    zajete.add(id);
    return id;
  };
}

/**
 * Nowa karta w slocie: pierwszy z `rozmiary`, który się tam mieści (domyślny jest pierwszy).
 * `dane` – wartości początkowe pól.
 */
export function dodajKarteWSlocie(
  p: Projekt,
  arkuszId: string,
  cel: Polozenie,
  typ: { szablonId: string; rozmiary: Rozmiar[]; dane?: Record<string, string> },
  ctx: KontekstKartki,
): { projekt: Projekt; kartaId: string } | { blad: BladKartki } {
  const { arkusz } = arkuszITalia(p, arkuszId);
  const zajete = kartyKartki(p, arkuszId, ctx.szablony);
  const szablon = ctx.szablony.get(typ.szablonId);
  const domyslny = szablon
    ? rozmiarKarty({ id: '', szablonId: typ.szablonId, dane: {}, ilosc: 1 }, ctx.szablony)
    : undefined;
  const r = typ.rozmiary.find((x) => !sprawdz(arkusz, zajete, [{ ...cel, ...x }], ctx.siatka));
  if (!r) return { blad: 'brak-miejsca' };
  const kartaId = noweId(p)('karta');
  const karta: Karta = {
    id: kartaId,
    szablonId: typ.szablonId,
    dane: { ...typ.dane },
    ilosc: 1,
    ...(domyslny && (domyslny.kolumny !== r.kolumny || domyslny.rzedy !== r.rzedy)
      ? { rozmiar: { ...r } }
      : {}),
  };
  const projekt = zmienKartke(p, arkuszId, (a, t) => ({
    arkusz: { ...a, przypiete: [...(a.przypiete ?? []), przypiecie(kartaId, cel)] },
    talia: { ...t, karty: [...t.karty, karta] },
  }));
  return { projekt, kartaId };
}

/**
 * Przesuwa karty o `o` (strony, kolumny, rzędy) jako blok – wszystkie albo żadna.
 * Strona docelowa może być nowa (kartka się wydłuża).
 */
export function przesunKarty(
  p: Projekt,
  arkuszId: string,
  ids: string[],
  o: Polozenie,
  ctx: KontekstKartki,
): { projekt: Projekt } | { blad: BladKartki } {
  const { arkusz } = arkuszITalia(p, arkuszId);
  const wszystkie = kartyKartki(p, arkuszId, ctx.szablony);
  const ruszane = wszystkie.filter((k) => ids.includes(k.karta.id));
  const inne = wszystkie.filter((k) => !ids.includes(k.karta.id));
  const nowe = ruszane.map((k) => ({
    ...k,
    strona: k.strona + o.strona,
    kolumna: k.kolumna + o.kolumna,
    rzad: k.rzad + o.rzad,
  }));
  const blad = sprawdz(arkusz, inne, nowe, ctx.siatka);
  if (blad) return { blad };
  const mapa = new Map(nowe.map((k) => [k.karta.id, k]));
  return {
    projekt: zmienKartke(p, arkuszId, (a, t) => ({
      arkusz: {
        ...a,
        przypiete: (a.przypiete ?? []).map((x) => {
          const n = mapa.get(x.kartaId);
          return n ? przypiecie(x.kartaId, n) : x;
        }),
        liczbaStron: Math.max(liczbaStronKartki(p, arkuszId), ...nowe.map((k) => k.strona + 1)),
      },
      talia: t,
    })),
  };
}

/** Które z rozmiarów zmieszczą się w miejscu karty (lewy górny róg bez zmian). */
export function mozliweRozmiary(
  p: Projekt,
  arkuszId: string,
  kartaId: string,
  rozmiary: Rozmiar[],
  ctx: KontekstKartki,
): boolean[] {
  const { arkusz } = arkuszITalia(p, arkuszId);
  const wszystkie = kartyKartki(p, arkuszId, ctx.szablony);
  const k = wszystkie.find((x) => x.karta.id === kartaId);
  if (!k) return rozmiary.map(() => false);
  const inne = wszystkie.filter((x) => x !== k);
  return rozmiary.map((r) => !sprawdz(arkusz, inne, [{ ...k, ...r }], ctx.siatka));
}

export function zmienRozmiarKarty(
  p: Projekt,
  arkuszId: string,
  kartaId: string,
  r: Rozmiar,
  ctx: KontekstKartki,
): { projekt: Projekt } | { blad: BladKartki } {
  const [mozna] = mozliweRozmiary(p, arkuszId, kartaId, [r], ctx);
  if (!mozna) return { blad: 'koliduje' };
  return {
    projekt: zmienKartke(p, arkuszId, (a, t) => ({
      arkusz: a,
      talia: {
        ...t,
        karty: t.karty.map((k) => {
          if (k.id !== kartaId) return k;
          const { rozmiar: _r, ...reszta } = k;
          void _r;
          const d = rozmiarKarty(reszta, ctx.szablony);
          return d.kolumny === r.kolumny && d.rzedy === r.rzedy
            ? reszta
            : { ...reszta, rozmiar: { ...r } };
        }),
      },
    })),
  };
}

/**
 * N kopii każdej karty w kolejne wolne sloty za oryginałem (dalej na następnych stronach;
 * gdy brak miejsca – nowe strony). Zwraca id kopii w kolejności.
 */
export function duplikujKarty(
  p: Projekt,
  arkuszId: string,
  ids: string[],
  n: number,
  ctx: KontekstKartki,
): { projekt: Projekt; kopie: string[] } {
  const { arkusz, talia } = arkuszITalia(p, arkuszId);
  const zajete = kartyKartki(p, arkuszId, ctx.szablony);
  const nowyId = noweId(p);
  const kopie: { karta: Karta; pol: Polozenie }[] = [];
  let strony = liczbaStronKartki(p, arkuszId);
  const ile = Math.max(0, Math.min(500, Math.floor(n)));
  for (const id of ids) {
    const zrodlo = zajete.find((k) => k.karta.id === id);
    if (!zrodlo) continue;
    for (let i = 0; i < ile; i++) {
      const r = { kolumny: zrodlo.kolumny, rzedy: zrodlo.rzedy };
      let pol = wolneMiejsce(arkusz, zajete, r, zrodlo, ctx.siatka, strony);
      if (!pol) {
        // Brak miejsca – nowa strona (od jej początku).
        pol = wolneMiejsce(
          arkusz,
          zajete,
          r,
          { strona: strony, kolumna: 0, rzad: 0 },
          ctx.siatka,
          strony + 1,
        );
        if (!pol) break; // karta większa niż siatka
        strony++;
      }
      const karta: Karta = { ...structuredClone(zrodlo.karta), id: nowyId(`${id}-kopia`) };
      zajete.push({ karta, ...pol, ...r });
      kopie.push({ karta, pol });
    }
  }
  const projekt = zmienKartke(p, arkuszId, (a) => ({
    arkusz: {
      ...a,
      przypiete: [...(a.przypiete ?? []), ...kopie.map((k) => przypiecie(k.karta.id, k.pol))],
      liczbaStron: strony,
    },
    talia: { ...talia, karty: [...talia.karty, ...kopie.map((k) => k.karta)] },
  }));
  return { projekt, kopie: kopie.map((k) => k.karta.id) };
}

export function usunKarty(p: Projekt, arkuszId: string, ids: string[]): Projekt {
  const usuwane = new Set(ids);
  return zmienKartke(p, arkuszId, (a, t) => ({
    arkusz: {
      ...a,
      przypiete: (a.przypiete ?? []).filter((x) => !usuwane.has(x.kartaId)),
      ...(a.kolejnosc ? { kolejnosc: a.kolejnosc.filter((id) => !usuwane.has(id)) } : {}),
    },
    talia: { ...t, karty: t.karty.filter((k) => !usuwane.has(k.id)) },
  }));
}

/** Ustawia pole (lub parametr) wielu kart naraz; pusty tekst – pole puste. */
export function ustawDaneKart(
  p: Projekt,
  arkuszId: string,
  ids: string[],
  klucz: string,
  wartosc: string,
): Projekt {
  const zmieniane = new Set(ids);
  return zmienKartke(p, arkuszId, (a, t) => ({
    arkusz: a,
    talia: {
      ...t,
      karty: t.karty.map((k) => {
        if (!zmieniane.has(k.id)) return k;
        const dane = { ...k.dane };
        if (wartosc === '') delete dane[klucz];
        else dane[klucz] = wartosc;
        return { ...k, dane };
      }),
    },
  }));
}

export function dodajStrone(p: Projekt, arkuszId: string): Projekt {
  const n = liczbaStronKartki(p, arkuszId);
  return zmienKartke(p, arkuszId, (a, t) => ({ arkusz: { ...a, liczbaStron: n + 1 }, talia: t }));
}

/** Usuwa pustą stronę; karty i nagłówki z dalszych stron przesuwają się o stronę w górę. */
export function usunStrone(
  p: Projekt,
  arkuszId: string,
  strona: number,
): { projekt: Projekt } | { blad: BladKartki } {
  const { arkusz } = arkuszITalia(p, arkuszId);
  const n = liczbaStronKartki(p, arkuszId);
  if (n <= 1 || (arkusz.przypiete ?? []).some((x) => (x.strona ?? 0) === strona)) {
    return { blad: 'strona-niepusta' };
  }
  const przesun = <T extends { strona?: number }>(x: T): T =>
    (x.strona ?? 0) > strona ? { ...x, strona: (x.strona ?? 0) - 1 } : x;
  return {
    projekt: zmienKartke(p, arkuszId, (a, t) => ({
      arkusz: {
        ...a,
        liczbaStron: n - 1,
        przypiete: (a.przypiete ?? []).map((x) => {
          const y = przesun(x);
          if (y.strona === 0) {
            const { strona: _s, ...bez } = y;
            void _s;
            return bez;
          }
          return y;
        }),
        ...(a.naglowki
          ? {
              naglowki: a.naglowki
                .filter((h) => h.strona !== strona)
                .map((h) => przesun(h) as NaglowekGrupy),
            }
          : {}),
      },
      talia: t,
    })),
  };
}

/** Nagłówek grupy nad kolumnami – nie może nachodzić na inny nagłówek na tej stronie. */
export function dodajNaglowek(
  p: Projekt,
  arkuszId: string,
  n: Omit<NaglowekGrupy, 'id'>,
  ctx: KontekstKartki,
): { projekt: Projekt; id: string } | { blad: BladKartki } {
  const { arkusz } = arkuszITalia(p, arkuszId);
  if (n.kolumna < 0 || n.kolumny < 1 || n.kolumna + n.kolumny > ctx.siatka.kolumny) {
    return { blad: 'poza-siatka' };
  }
  const inne = (arkusz.naglowki ?? []).filter((h) => h.strona === n.strona);
  if (inne.some((h) => h.kolumna < n.kolumna + n.kolumny && n.kolumna < h.kolumna + h.kolumny)) {
    return { blad: 'koliduje' };
  }
  const id = unikalneId('grupa', new Set((arkusz.naglowki ?? []).map((h) => h.id)));
  const projekt = zmienKartke(p, arkuszId, (a, t) => ({
    arkusz: { ...a, naglowki: [...(a.naglowki ?? []), { ...n, id }] },
    talia: t,
  }));
  return { projekt, id };
}

/** Zmiana nagłówka (tekst, opis, szerokość, odstęp) – z kontrolą nakładania. */
export function zmienNaglowek(
  p: Projekt,
  arkuszId: string,
  id: string,
  zmiana: Partial<Omit<NaglowekGrupy, 'id' | 'strona'>>,
  ctx: KontekstKartki,
): { projekt: Projekt } | { blad: BladKartki } {
  const { arkusz } = arkuszITalia(p, arkuszId);
  const h = arkusz.naglowki?.find((x) => x.id === id);
  if (!h) return { blad: 'poza-siatka' };
  const nowy: NaglowekGrupy = { ...h, ...zmiana };
  if (nowy.odstepPrzed === 0 || nowy.odstepPrzed === undefined) delete nowy.odstepPrzed;
  if (!nowy.opis) delete nowy.opis;
  if (nowy.kolumna < 0 || nowy.kolumny < 1 || nowy.kolumna + nowy.kolumny > ctx.siatka.kolumny) {
    return { blad: 'poza-siatka' };
  }
  const inne = (arkusz.naglowki ?? []).filter((x) => x.id !== id && x.strona === h.strona);
  if (
    inne.some(
      (x) => x.kolumna < nowy.kolumna + nowy.kolumny && nowy.kolumna < x.kolumna + x.kolumny,
    )
  ) {
    return { blad: 'koliduje' };
  }
  // Nowy odstęp nie może przeciąć karty szerszej niż kolumna.
  const kartki = { ...arkusz, naglowki: [...inne, nowy] };
  const karty = kartyKartki(p, arkuszId, ctx.szablony);
  if (sprawdz(kartki, [], karty, ctx.siatka)) return { blad: 'koliduje' };
  return {
    projekt: zmienKartke(p, arkuszId, (a, t) => ({
      arkusz: { ...a, naglowki: (a.naglowki ?? []).map((x) => (x.id === id ? nowy : x)) },
      talia: t,
    })),
  };
}

export function usunNaglowek(p: Projekt, arkuszId: string, id: string): Projekt {
  return zmienKartke(p, arkuszId, (a, t) => {
    const naglowki = (a.naglowki ?? []).filter((h) => h.id !== id);
    const { naglowki: _n, ...bez } = a;
    void _n;
    return { arkusz: naglowki.length ? { ...bez, naglowki } : bez, talia: t };
  });
}

/** Karty w prostokącie zaznaczenia (sloty od–do, włącznie) na stronie. */
export function kartyWObszarze(
  karty: KartaNaKartce[],
  strona: number,
  a: { kolumna: number; rzad: number },
  b: { kolumna: number; rzad: number },
): string[] {
  const obszar = {
    strona,
    kolumna: Math.min(a.kolumna, b.kolumna),
    rzad: Math.min(a.rzad, b.rzad),
    kolumny: Math.abs(a.kolumna - b.kolumna) + 1,
    rzedy: Math.abs(a.rzad - b.rzad) + 1,
  };
  return karty.filter((k) => nachodza(k, obszar)).map((k) => k.karta.id);
}

/** Nowa, pusta kartka w projekcie (własna talia i tytuł) – np. „Kartka 2”. */
export function dodajKartke(
  p: Projekt,
  wzor: { nazwa: string; ustawienia: Arkusz['ustawienia'] },
  nazwa: string,
  /** Tytuł kartki = jej nazwa (gry z pakietu); bez – kartka bez tytułu (własne karty). */
  zTytulem = true,
): { projekt: Projekt; arkuszId: string } {
  const zajete = new Set([...p.arkusze.map((a) => a.id), ...p.talie.map((t) => t.id)]);
  const id = unikalneId('kartka', zajete);
  const ustawienia = structuredClone(wzor.ustawienia);
  if (ustawienia.tytul) ustawienia.tytul.tekst = zTytulem ? nazwa : '';
  return {
    projekt: {
      ...p,
      zmieniono: teraz(),
      talie: [...p.talie, { id, nazwa, karty: [] }],
      arkusze: [...p.arkusze, { id, nazwa, taliaId: id, liczbaStron: 1, ustawienia }],
    },
    arkuszId: id,
  };
}

/*
 * Mieszane rozmiary: karty nie mają slotów, więc dodawanie, duplikowanie i przesuwanie to
 * operacje na kolejności (`Arkusz.kolejnosc`); położenie liczy za każdym razem algorytm pasów.
 */

/** Lista `ids` bez przenoszonych i z nimi wstawionymi przed `przedId` (brak – na końcu). */
export function przeniesWKolejnosci(lista: string[], ids: string[], przedId?: string): string[] {
  const ruszane = lista.filter((id) => ids.includes(id));
  const reszta = lista.filter((id) => !ids.includes(id));
  const i = przedId === undefined ? -1 : reszta.indexOf(przedId);
  return i < 0 ? [...reszta, ...ruszane] : [...reszta.slice(0, i), ...ruszane, ...reszta.slice(i)];
}

/** Kolejność własna kartki: zapisana lista, potem pozostałe karty talii (ilość ≥ 1). */
function kolejnoscKartki(a: Arkusz, t: Talia): string[] {
  const jest = new Set(t.karty.filter((k) => k.ilosc >= 1).map((k) => k.id));
  const wynik = (a.kolejnosc ?? []).filter((id) => jest.has(id));
  const wpisane = new Set(wynik);
  for (const id of jest) if (!wpisane.has(id)) wynik.push(id);
  return wynik;
}

const wlasna = (a: Arkusz): Arkusz['ustawienia']['mieszane'] =>
  a.ustawienia.mieszane ? { ...a.ustawienia.mieszane } : undefined;

/**
 * Zapisuje kolejność własną i przełącza kartkę na „jak w talii” (kolejność własna). `lista` –
 * identyfikatory kart w żądanej kolejności (np. wg bieżącego układu pasów).
 */
export function ustawKolejnosc(p: Projekt, arkuszId: string, lista: string[]): Projekt {
  return zmienKartke(p, arkuszId, (a, t) => {
    const m = wlasna(a) ?? { kolejnosc: 'wlasna', obracaj: false, grupujRozmiary: true, odstep: 0 };
    return {
      arkusz: {
        ...a,
        kolejnosc: lista,
        ustawienia: { ...a.ustawienia, mieszane: { ...m, kolejnosc: 'wlasna' } },
      },
      talia: t,
    };
  });
}

/**
 * Nowa karta na kartce o mieszanych rozmiarach. Przy kolejności własnej trafia za kartą `po`
 * (brak – na koniec); przy „od największych” miejsce wyznacza algorytm.
 */
export function dodajKarteMieszane(
  p: Projekt,
  arkuszId: string,
  typ: { szablonId: string; dane?: Record<string, string> },
  po?: string,
): { projekt: Projekt; kartaId: string } {
  const kartaId = noweId(p)('karta');
  const karta: Karta = { id: kartaId, szablonId: typ.szablonId, dane: { ...typ.dane }, ilosc: 1 };
  const projekt = zmienKartke(p, arkuszId, (a, t) => {
    const lista = kolejnoscKartki(a, t);
    const i = po === undefined ? -1 : lista.indexOf(po);
    const nowa =
      i < 0 ? [...lista, kartaId] : [...lista.slice(0, i + 1), kartaId, ...lista.slice(i + 1)];
    return { arkusz: { ...a, kolejnosc: nowa }, talia: { ...t, karty: [...t.karty, karta] } };
  });
  return { projekt, kartaId };
}

/** Kopie kart (za oryginałem w kolejności własnej); zwraca identyfikatory kopii. */
export function duplikujKartyMieszane(
  p: Projekt,
  arkuszId: string,
  ids: string[],
  n: number,
): { projekt: Projekt; kopie: string[] } {
  const nowyId = noweId(p);
  const ile = Math.max(0, Math.min(500, Math.floor(n)));
  const kopie: { karta: Karta; po: string }[] = [];
  const { talia } = arkuszITalia(p, arkuszId);
  for (const id of ids) {
    const zrodlo = talia.karty.find((k) => k.id === id);
    if (!zrodlo) continue;
    let po = id;
    for (let i = 0; i < ile; i++) {
      const karta: Karta = { ...structuredClone(zrodlo), id: nowyId(`${id}-kopia`), ilosc: 1 };
      kopie.push({ karta, po });
      po = karta.id;
    }
  }
  const projekt = zmienKartke(p, arkuszId, (a, t) => {
    let lista = kolejnoscKartki(a, t);
    for (const k of kopie) {
      const i = lista.indexOf(k.po);
      lista =
        i < 0
          ? [...lista, k.karta.id]
          : [...lista.slice(0, i + 1), k.karta.id, ...lista.slice(i + 1)];
    }
    return {
      arkusz: { ...a, kolejnosc: lista },
      talia: { ...t, karty: [...t.karty, ...kopie.map((k) => k.karta)] },
    };
  });
  return { projekt, kopie: kopie.map((k) => k.karta.id) };
}

/**
 * Przełączenie kartki na mieszane rozmiary. Kolejność własna startuje od układu z siatki (strony,
 * rzędy, kolumny); przypięcia zostają w pliku, ale są ignorowane. Opcje sprzed przełączenia
 * (np. po powrocie do trybu mieszanego) są zachowane.
 */
export function naMieszane(p: Projekt, arkuszId: string): Projekt {
  return zmienKartke(p, arkuszId, (a, t) => {
    const wgSiatki = [...(a.przypiete ?? [])]
      .sort((x, y) => (x.strona ?? 0) - (y.strona ?? 0) || x.rzad - y.rzad || x.kolumna - y.kolumna)
      .map((x) => x.kartaId);
    const kolejnosc = a.kolejnosc ?? wgSiatki;
    return {
      arkusz: {
        ...a,
        kolejnosc,
        ustawienia: {
          ...a.ustawienia,
          rozmiary: 'mieszane',
          mieszane: a.ustawienia.mieszane ?? { ...MIESZANE_DOMYSLNE },
        },
      },
      talia: t,
    };
  });
}

/** Blok kart `ids` przesunięty w liście o jedno miejsce (`kierunek` −1 wcześniej, +1 później). */
export function przesunWKolejnosci(lista: string[], ids: string[], kierunek: -1 | 1): string[] {
  const miejsca = lista.flatMap((id, i) => (ids.includes(id) ? [i] : []));
  if (miejsca.length === 0) return lista;
  if (kierunek < 0) {
    const i = Math.min(...miejsca);
    return i === 0 ? lista : przeniesWKolejnosci(lista, ids, lista[i - 1]);
  }
  const j = Math.max(...miejsca);
  return j >= lista.length - 1 ? lista : przeniesWKolejnosci(lista, ids, lista[j + 2]);
}
