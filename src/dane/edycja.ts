import type { Arkusz, UstawieniaArkusza } from '../model/arkusz';
import type { DaneZasobow, OpisZasobu, Projekt } from '../model/projekt';
import {
  czyKontener,
  kluczKomorki,
  stylePola,
  type Karta,
  type Pole,
  type Szablon,
  type Talia,
  type UstawieniaObrazu,
  type WariantCzcionki,
  type Wezel,
} from '../model/szablon';

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
      if (pole.typ === 'tabela') {
        // Każda komórka wartości tabeli to osobna kolumna danych (nazwa = nagłówek, przy kilku
        // wierszach – z numerem wiersza).
        const wiersze = Math.max(1, Math.floor(pole.wiersze ?? 1));
        for (let r = 0; r < wiersze; r++)
          pole.kolumny.forEach((k, i) => {
            const klucz = kluczKomorki(k, r);
            if (!k.klucz || wynik.has(klucz)) return;
            const naglowek = k.naglowek || `${pole.nazwa || nazwaKlucza(k.klucz)} ${i + 1}`;
            wynik.set(klucz, {
              klucz,
              nazwa: wiersze > 1 ? `${naglowek} (${r + 1})` : naglowek,
              rodzaj: 'pole',
              typPola: 'tabela',
            });
          });
        continue;
      }
      if (pole.klucz && !wynik.has(pole.klucz)) {
        wynik.set(pole.klucz, {
          klucz: pole.klucz,
          nazwa: pole.nazwa || nazwaKlucza(pole.klucz),
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

// ---------------------------------------------------------------------------------------------
// Biblioteka zasobów i role czcionek

/** Role czcionek: przypisane w projekcie oraz użyte w stylach szablonów (nazwy, które nie są rodziną). */
export function roleProjektu(p: Projekt): string[] {
  const rodziny = new Set(p.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])));
  const role = new Set(Object.keys(p.role));
  const style = (w: Wezel) => {
    for (const x of polaWezla(w)) {
      const nazwy = stylePola(x).map((st) => st.czcionka);
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
