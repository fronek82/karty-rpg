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

/** Czy projekt jest już w modelu kartki (nie trzeba normalizować). */
export function czyKartkaZnormalizowana(p: Projekt): boolean {
  const uzycia = new Map<string, number>();
  for (const a of p.arkusze) uzycia.set(a.taliaId, (uzycia.get(a.taliaId) ?? 0) + 1);
  return p.arkusze.every((a) => {
    const t = p.talie.find((x) => x.id === a.taliaId);
    if (!t || uzycia.get(t.id) !== 1 || t.grupy?.length) return false;
    const przypiete = new Map<string, number>();
    for (const x of a.przypiete ?? [])
      przypiete.set(x.kartaId, (przypiete.get(x.kartaId) ?? 0) + 1);
    return t.karty.every((k) => k.ilosc === 1 && przypiete.get(k.id) === 1);
  });
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
  /** Karty, których nie było na wydruku (ilość 0, za duże) – nie trafiają na kartkę. */
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

  const arkusze = p.arkusze.map((a): Arkusz => {
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

    // Grupy → nagłówki: kolumna początkowa i odstęp przed grupą z położenia regionów.
    const naglowki: NaglowekGrupy[] = [...(a.naglowki ?? [])];
    const startGrupy = new Map<string, number>();
    if (w.siatka.grupy) {
      for (let s = 0; s < w.strony.length; s++) {
        let kolumna = 0;
        let odstepy = 0;
        for (const r of w.rozmieszczenie.regiony
          .filter((x) => x.strona === s)
          .sort((x, y) => x.x - y.x)) {
          const odstep = r.x - (kolumna * w.slot.szerokosc + odstepy);
          odstepy += odstep;
          startGrupy.set(`${s}|${r.grupaId}`, kolumna);
          const g = talia.grupy?.find((x) => x.id === r.grupaId);
          naglowki.push({
            id: s === 0 ? r.grupaId : `${r.grupaId}-s${s + 1}`,
            strona: s,
            kolumna,
            kolumny: r.kolumny,
            naglowek: g?.naglowek ?? '',
            ...(g?.opis ? { opis: g.opis } : {}),
            ...(odstep > E ? { odstepPrzed: Math.round(odstep * 1e6) / 1e6 } : {}),
          });
          kolumna += r.kolumny;
        }
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
      const kolumna =
        (u.grupaId ? (startGrupy.get(`${u.strona}|${u.grupaId}`) ?? 0) : 0) + u.kolumna;
      przypiete.push({
        kartaId: id,
        kolumna,
        rzad: u.rzad,
        ...(u.strona ? { strona: u.strona } : {}),
      });
    }
    const naKartce = new Set(umieszczone.map((u) => u.karta.id));
    for (const k of talia.karty) if (!naKartce.has(k.id)) pominiete.push(k.id);

    const { grupy: _g, ...bezGrup } = talia;
    void _g;
    const i = talieWynik.findIndex((x) => x.id === talia.id);
    talieWynik[i] = { ...bezGrup, karty };
    return {
      ...a,
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
