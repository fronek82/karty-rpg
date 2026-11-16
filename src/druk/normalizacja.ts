import type { Arkusz, NaglowekGrupy, PrzypietaKarta } from '../model/arkusz';
import type { Projekt } from '../model/projekt';
import type { Karta, Talia } from '../model/szablon';
import type { RejestrCzcionek } from '../silnik/czcionki';
import type { InformacjaOObrazie } from '../silnik/karta';
import { zbudujArkusz } from './arkusz';

/**
 * Model „kartki” (edytor wizualny): każda karta na arkuszu to osobny egzemplarz (`ilosc: 1`)
 * przypięty w swoim slocie; grupy to ręczne nagłówki nad kolumnami. Projekty sprzed edytora
 * (ilości, rozmieszczanie automatyczne, grupy talii) są do niego sprowadzane BEZ zmiany wydruku:
 * karty dostają przypięcia tam, gdzie leżą teraz, a grupy – nagłówki z tymi samymi odstępami.
 * Potrzebne są czcionki: rozmieszczenie zależy od wysokości tytułu i nagłówków.
 */

const E = 1e-6;

const unikalne = (id: string, zajete: Set<string>) => {
  let w = id;
  for (let n = 2; zajete.has(w); n++) w = `${id}-${n}`;
  return w;
};

/** Czy projekt jest już w modelu kartki (nie trzeba normalizować). */
export function czyKartkaZnormalizowana(p: Projekt): boolean {
  const uzycia = new Map<string, number>();
  for (const a of p.arkusze) uzycia.set(a.taliaId, (uzycia.get(a.taliaId) ?? 0) + 1);
  return (
    p.arkusze.every((a) => {
      const t = p.talie.find((x) => x.id === a.taliaId);
      if (!t || uzycia.get(t.id) !== 1 || t.grupy?.length) return false;
      const przypiete = new Map<string, number>();
      for (const x of a.przypiete ?? [])
        przypiete.set(x.kartaId, (przypiete.get(x.kartaId) ?? 0) + 1);
      // Karta na kartce: 1 sztuka, przypięta raz; odłożona: 0 sztuk, bez przypięcia.
      return (
        !!a.ustawienia.slot &&
        t.karty.every((k) =>
          k.ilosc === 0 ? !przypiete.has(k.id) : k.ilosc === 1 && przypiete.get(k.id) === 1,
        )
      );
    }) && p.talie.every((t) => p.arkusze.some((a) => a.taliaId === t.id))
  );
}

/** Karty odłożone (ilość 0 – nie ma ich na kartce ani na wydruku) w kartce. */
export function kartyOdlozone(p: Projekt, arkuszId: string): Karta[] {
  const a = p.arkusze.find((x) => x.id === arkuszId);
  const t = a && p.talie.find((x) => x.id === a.taliaId);
  return t?.karty.filter((k) => k.ilosc === 0) ?? [];
}

/** Pakiet gry projektu: zapisany albo rozpoznany po szablonach (projekty sprzed pola `pakiet`). */
export function pakietProjektu(p: Projekt): string | undefined {
  if (p.pakiet) return p.pakiet;
  return p.szablony.length > 0 && p.szablony.every((s) => s.id.startsWith('mausritter-'))
    ? 'mausritter'
    : undefined;
}

export interface WynikNormalizacji {
  projekt: Projekt;
  /**
   * Karty, których nie było na wydruku (ilość 0, za duże, poza siatką slotów) – zostają w talii
   * jako odłożone (ilość 0, bez przypięcia), nic nie ginie.
   */
  pominiete: string[];
}

export function normalizujKartki(
  p: Projekt,
  ctx: { czcionki: RejestrCzcionek; obraz?: (z: string) => InformacjaOObrazie | undefined },
): WynikNormalizacji {
  const szablony = new Map(p.szablony.map((s) => [s.id, s]));
  const zajeteId = new Set(p.talie.flatMap((t) => t.karty.map((k) => k.id)));
  const talieWynik: Talia[] = [...p.talie];
  const uzyteTalie = new Set<string>();
  const pominiete: string[] = [];

  // Talia bez arkusza (np. z importu) dostaje własną kartkę z ustawieniami pierwszej.
  const wzor = p.arkusze[0];
  const bezKartki = wzor ? p.talie.filter((t) => !p.arkusze.some((a) => a.taliaId === t.id)) : [];
  const wejscie: Arkusz[] = [
    ...p.arkusze,
    ...bezKartki.map((t) => ({
      id: unikalne(t.id, new Set(p.arkusze.map((a) => a.id))),
      nazwa: t.nazwa,
      taliaId: t.id,
      ustawienia: structuredClone(wzor!.ustawienia),
    })),
  ];

  const arkusze = wejscie.map((a): Arkusz => {
    let talia = p.talie.find((x) => x.id === a.taliaId)!;
    // Talia wspólna dla kilku arkuszy – każdy arkusz dostaje własną kopię.
    if (uzyteTalie.has(talia.id)) {
      let id = `${talia.id}-${a.id}`;
      for (let n = 2; talieWynik.some((x) => x.id === id); n++) id = `${talia.id}-${a.id}-${n}`;
      talia = { ...talia, id };
      talieWynik.push(talia);
      a = { ...a, taliaId: id };
    }
    uzyteTalie.add(talia.id);
    const w = zbudujArkusz(a, talia, {
      czcionki: ctx.czcionki,
      szablony,
      ...(ctx.obraz ? { obraz: ctx.obraz } : {}),
    });

    // Regiony (grupy i karty spoza grup) → kolumny globalne; odstępy między nimi → nagłówki
    // z `odstepPrzed` (region bez grupy – nagłówek z pustym tekstem, sam odstęp).
    const naglowki: NaglowekGrupy[] = [...(a.naglowki ?? [])];
    const startRegionu = new Map<string, number>();
    const kluczX = (strona: number, x: number) => `${strona}|${Math.round(x * 1000)}`;
    for (let s = 0; s < w.strony.length; s++) {
      const regiony = new Map<number, { x: number; kolumny: number; grupaId?: string }>();
      for (const r of w.rozmieszczenie.regiony.filter((x) => x.strona === s)) {
        regiony.set(Math.round(r.x * 1000), { x: r.x, kolumny: r.kolumny, grupaId: r.grupaId });
      }
      for (const u of w.rozmieszczenie.karty.filter((x) => x.strona === s)) {
        const k = Math.round(u.xRegionu * 1000);
        const r = regiony.get(k) ?? { x: u.xRegionu, kolumny: 0 };
        if (!r.grupaId) r.kolumny = Math.max(r.kolumny, u.kolumna + u.kolumny);
        regiony.set(k, r);
      }
      let kolumna = 0;
      let odstepy = 0;
      for (const r of [...regiony.values()].sort((x, y) => x.x - y.x)) {
        const odstep = r.x - (kolumna * w.slot.szerokosc + odstepy);
        odstepy += odstep;
        startRegionu.set(kluczX(s, r.x), kolumna);
        const g = r.grupaId ? talia.grupy?.find((x) => x.id === r.grupaId) : undefined;
        if (g || odstep > E) {
          naglowki.push({
            id: unikalne(
              g ? (s === 0 ? g.id : `${g.id}-s${s + 1}`) : `odstep-s${s + 1}-k${kolumna + 1}`,
              new Set(naglowki.map((h) => h.id)),
            ),
            strona: s,
            kolumna,
            kolumny: Math.max(1, r.kolumny),
            naglowek: g?.naglowek ?? '',
            ...(g?.opis ? { opis: g.opis } : {}),
            ...(odstep > E ? { odstepPrzed: Math.round(odstep * 1e6) / 1e6 } : {}),
          });
        }
        kolumna += r.kolumny;
      }
    }

    const karty: Karta[] = [];
    const przypiete: PrzypietaKarta[] = [];
    // Kolejność z rozmieszczenia = kolejność rysowania – wydruk identyczny co do bajtu.
    const umieszczone = w.rozmieszczenie.karty;
    for (const u of umieszczone) {
      let id = u.karta.id;
      if (u.numer > 0) {
        id = `${u.karta.id}-${u.numer + 1}`;
        for (let n = 2; zajeteId.has(id); n++) id = `${u.karta.id}-${u.numer + 1}-${n}`;
        zajeteId.add(id);
      }
      karty.push({ ...u.karta, id, ilosc: 1 });
      const kolumna = (startRegionu.get(kluczX(u.strona, u.xRegionu)) ?? 0) + u.kolumna;
      przypiete.push({
        kartaId: id,
        kolumna,
        rzad: u.rzad,
        ...(u.strona ? { strona: u.strona } : {}),
      });
    }
    // Karty, których nie było na wydruku – odłożone (ilość 0), nie usuwane.
    const naKartce = new Set(umieszczone.map((u) => u.karta.id));
    for (const k of talia.karty) {
      if (naKartce.has(k.id)) continue;
      pominiete.push(k.id);
      karty.push({ ...k, ilosc: 0 });
    }

    const { grupy: _g, ...bezGrup } = talia;
    void _g;
    const i = talieWynik.findIndex((x) => x.id === talia.id);
    talieWynik[i] = { ...bezGrup, karty };
    return {
      ...a,
      // Jawny slot – siatka znana także bez kart (pusta kartka, kontrola zmian w edytorze).
      ustawienia: { ...a.ustawienia, slot: { ...w.slot } },
      przypiete,
      liczbaStron: Math.max(1, w.strony.length),
      ...(naglowki.length ? { naglowki } : {}),
    };
  });

  const pakiet = pakietProjektu(p);
  return {
    projekt: {
      ...p,
      talie: talieWynik,
      arkusze,
      ...(pakiet ? { pakiet } : {}),
      zmieniono: new Date().toISOString(),
    },
    pominiete,
  };
}
