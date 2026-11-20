import { rewersKarty } from '../dane/rewers';
import {
  polozenieKarty,
  wymiaryStrony,
  type Arkusz,
  type KrawedzOdwracania,
} from '../model/arkusz';
import type { Mm } from '../model/jednostki';
import { wymiaryKarty, type Rewers, type StylTekstu, type Talia } from '../model/szablon';
import type { RejestrCzcionek } from '../silnik/czcionki';
import { renderujRewers, type Ostrzezenie } from '../silnik/karta';
import {
  polaczGlify,
  symboleSceny,
  type DefinicjaGlifu,
  type DefinicjaSymbolu,
  type ElementSceny,
  type Scena,
} from '../silnik/scena';
import { tekstNaScene, ulozTekst } from '../silnik/tekst';
import {
  symboleWSzarosci,
  wSkaliSzarosci,
  zbudujArkusz,
  type KontekstArkusza,
  type OstrzezenieArkusza,
  type WynikArkusza,
} from './arkusz';

/** Oś odbicia stron rewersów w aktualnej orientacji papieru. */
export type OsOdwracania = 'pionowa' | 'pozioma';

/**
 * Krawędź odwracania wskazuje oś odbicia na papierze w aktualnej orientacji:
 * - pionowa strona (`szer <= wys`): długa krawędź → oś pionowa (jak książka), krótka → pozioma (jak kalendarz);
 * - pozioma strona (`szer > wys`): długa krawędź → oś pozioma, krótka → pionowa.
 */
export function osOdwracania(
  strona: { szer: Mm; wys: Mm },
  krawedz: KrawedzOdwracania,
): OsOdwracania {
  const pionowaStrona = strona.szer <= strona.wys;
  return (krawedz === 'dluga') === pionowaStrona ? 'pionowa' : 'pozioma';
}

/** Odbicie prostokąta karty względem wybranej osi papieru (mm). */
export function odbijProstokat(
  r: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  strona: { szer: Mm; wys: Mm },
  os: OsOdwracania,
): { x: Mm; y: Mm; szer: Mm; wys: Mm } {
  return os === 'pionowa'
    ? { x: strona.szer - r.x - r.szer, y: r.y, szer: r.szer, wys: r.wys }
    : { x: r.x, y: strona.wys - r.y - r.wys, szer: r.szer, wys: r.wys };
}

/**
 * Kąt obrotu grafiki rewersu (w stopniach, zgodnie z ruchem wskazówek zegara, znormalizowany do [0, 360)),
 * wyznaczony z kąta przodu θ tak, aby górne krawędzie obu stron karty pokryły się po fizycznym odwróceniu:
 * - oś pionowa: −θ
 * - oś pozioma: 180° − θ
 */
export function katRewersu(katPrzodu: number, os: OsOdwracania): number {
  const kat = os === 'pionowa' ? -katPrzodu : 180 - katPrzodu;
  const norm = ((kat % 360) + 360) % 360;
  return Math.abs(norm) < 1e-9 || Math.abs(norm - 360) < 1e-9 ? 0 : norm;
}

export interface KontekstRewersow extends KontekstArkusza {
  rewersy: ReadonlyMap<string, Rewers>;
}

export interface WynikRewersow {
  /** Jedna scena tyłu na każdą stronę przodu (puste tyły są pustą sceną o wymiarze strony). */
  strony: Scena[];
  /** Czy dana strona tyłu nie ma żadnych przypisanych rewersów (pusta strona wyrównująca parę). */
  puste: boolean[];
  ostrzezenia: OstrzezenieArkusza[];
}

function ostrzezenieRewersu(kartaId: string, o: Ostrzezenie): OstrzezenieArkusza {
  return {
    kartaId,
    komunikat: `${o.komunikat}:${o.pole}${o.szczegoly ? `:${o.szczegoly}` : ''}`,
  };
}

/**
 * Buduje strony rewersów na podstawie gotowych położeń przodów (`wynikPrzodu.pozycjeKart`).
 * Każda strona przodu ma dokładnie jedną odpowiadającą stronę tyłu (również pustą),
 * co gwarantuje zgodność par stron przy druku dwustronnym.
 */
export function zbudujStronyRewersow(
  arkusz: Arkusz,
  talia: Talia,
  wynikPrzodu: WynikArkusza,
  ctx: KontekstRewersow,
): WynikRewersow {
  const u = arkusz.ustawienia;
  const strona = wymiaryStrony(u);
  const krawedz = u.dwustronny?.krawedz ?? 'dluga';
  const os = osOdwracania(strona, krawedz);
  const dop = u.rozmiary === 'mieszane' ? undefined : u.dopasowanie;
  const pliki = {
    czcionki: ctx.czcionki,
    ...(ctx.obraz ? { obraz: ctx.obraz } : {}),
    ...(ctx.elementy ? { elementy: ctx.elementy } : {}),
  };

  // Pamięć wyrenderowanych rewersów (ta sama definicja + wymiary docelowe → jeden render).
  const pamiec = new Map<string, { scena: Scena; ostrzezenia: Ostrzezenie[] }>();
  const zgloszoneOstrzezenia = new Set<string>();
  const ostrzezenia: OstrzezenieArkusza[] = [];

  const renderujDocelowy = (
    rewers: Rewers,
    kartaSzer: Mm,
    kartaWys: Mm,
    promienRogow: Mm | undefined,
    kartaId: string,
  ) => {
    const klucz = `${rewers.id}|${kartaSzer}|${kartaWys}|${promienRogow ?? ''}`;
    let w = pamiec.get(klucz);
    if (!w) {
      w = renderujRewers(rewers, pliki, {
        szer: kartaSzer,
        wys: kartaWys,
        ...(promienRogow ? { promienRogow } : {}),
      });
      pamiec.set(klucz, w);
    }
    for (const o of w.ostrzezenia) {
      const k = `${kartaId}|${JSON.stringify(o)}`;
      if (!zgloszoneOstrzezenia.has(k)) {
        zgloszoneOstrzezenia.add(k);
        ostrzezenia.push(ostrzezenieRewersu(kartaId, o));
      }
    }
    return w.scena;
  };

  const strony: Scena[] = [];
  const puste: boolean[] = [];

  for (let n = 0; n < wynikPrzodu.strony.length; n++) {
    const pozycje = wynikPrzodu.pozycjeKart.filter((p) => p.strona === n);
    const elementy: ElementSceny[] = [];
    const glify: Record<string, DefinicjaGlifu>[] = [];
    const symbole: (Record<string, DefinicjaSymbolu> | undefined)[] = [];

    const doNarysowania = pozycje
      .map((p) => {
        const szablon = ctx.szablony.get(p.karta.szablonId);
        if (!szablon) return undefined;
        const rewers = rewersKarty(ctx.rewersy, p.karta, szablon, talia);
        if (!rewers) return undefined;
        return { p, szablon, rewers };
      })
      .filter((x): x is NonNullable<typeof x> => x !== undefined);

    // Tło do krawędzi slotu (perforacje): przed kartami, jak na stronie przodu.
    if (dop?.tloDoSlotu) {
      for (const { p, szablon, rewers } of doNarysowania) {
        if (!p.obszar || !rewers.tlo) continue;
        const ob = odbijProstokat(p.obszar, strona, os);
        elementy.push({
          typ: 'prostokat',
          x: ob.x,
          y: ob.y,
          szer: ob.szer,
          wys: ob.wys,
          ...(szablon.promienRogow ? { promien: szablon.promienRogow } : {}),
          wypelnienie: rewers.tlo,
        });
      }
    }

    for (const { p, szablon, rewers } of doNarysowania) {
      const { szer: kartaSzer, wys: kartaWys } = wymiaryKarty(szablon, p.karta);
      const scenaRewersu = renderujDocelowy(
        rewers,
        kartaSzer,
        kartaWys,
        szablon.promienRogow,
        p.karta.id,
      );
      glify.push(scenaRewersu.glify);
      symbole.push(scenaRewersu.symbole);
      const cel = odbijProstokat(p, strona, os);
      const phi = katRewersu(p.obrot, os);
      if (phi === 0) {
        elementy.push({ typ: 'grupa', x: cel.x, y: cel.y, elementy: scenaRewersu.elementy });
      } else {
        elementy.push({
          typ: 'grupa',
          x: cel.x + cel.szer / 2,
          y: cel.y + cel.wys / 2,
          obrot: phi,
          macierz: [1, 0, 0, 1, -kartaSzer / 2, -kartaWys / 2],
          elementy: scenaRewersu.elementy,
        });
      }
    }

    puste.push(doNarysowania.length === 0);
    strony.push({
      szer: strona.szer,
      wys: strona.wys,
      elementy: u.czarnoBialy ? wSkaliSzarosci(elementy) : elementy,
      glify: polaczGlify(...glify),
      ...symboleSceny(...(u.czarnoBialy ? symbole.map(symboleWSzarosci) : symbole)),
    });
  }

  return { strony, puste, ostrzezenia };
}

/** Pusta scena strony (mm) do wyrównania par w dwustronnym PDF. */
export function pustaStrona(strona: { szer: Mm; wys: Mm }): Scena {
  return { szer: strona.szer, wys: strona.wys, elementy: [], glify: {} };
}

/** Przeplata strony przodu i tyłu w pary: [P1, T1, P2, T2, ...], uzupełniając brakujący tył pustą stroną. */
export function przeplecStronyDwustronne(
  przody: readonly Scena[],
  tyly: readonly Scena[],
  rozmiarPustego?: { szer: Mm; wys: Mm },
): Scena[] {
  const wynik: Scena[] = [];
  for (let i = 0; i < przody.length; i++) {
    const p = przody[i]!;
    wynik.push(p);
    wynik.push(tyly[i] ?? pustaStrona(rozmiarPustego ?? { szer: p.szer, wys: p.wys }));
  }
  return wynik;
}

interface PoleTestowe {
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
  obrot: number;
}

function napisTestowy(
  tekst: string,
  styl: StylTekstu,
  czcionki: RejestrCzcionek,
): { elementy: ElementSceny[]; glify: Record<string, DefinicjaGlifu>; szer: Mm; wys: Mm } {
  const glify: Record<string, DefinicjaGlifu> = {};
  if (!tekst.trim()) return { elementy: [], glify, szer: 0, wys: 0 };
  const u = ulozTekst([{ tekst, styl }], undefined, czcionki);
  const ramka = { x: 0, y: 0, szer: u.szerokosc, wys: u.wysokosc };
  return {
    elementy: tekstNaScene(u, ramka, 'lewo', 'poczatek', glify),
    glify,
    szer: u.szerokosc,
    wys: u.wysokosc,
  };
}

/**
 * Obrys, krzyżyk środka oraz strzałka górnej krawędzi pola testowego w lokalnym układzie karty,
 * obracana o `obrot` wokół środka pola.
 */
function znacznikiPolaTestowego(
  p: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  obrot: number,
  kartaSzer: Mm,
  kartaWys: Mm,
  kolor: string,
): ElementSceny[] {
  const obrys = { kolor, grubosc: 0.2 };
  const krzyzyk = { kolor, grubosc: 0.15 };
  const cx = p.x + p.szer / 2;
  const cy = p.y + p.wys / 2;
  const d = Math.min(5, p.szer / 6, p.wys / 6);
  const elementy: ElementSceny[] = [
    { typ: 'prostokat', x: p.x, y: p.y, szer: p.szer, wys: p.wys, obrys },
    { typ: 'linia', x1: cx - d, y1: cy, x2: cx + d, y2: cy, obrys: krzyzyk },
    { typ: 'linia', x1: cx, y1: cy - d, x2: cx, y2: cy + d, obrys: krzyzyk },
  ];

  // Asymetryczna strzałka u góry karty (w lokalnych współrzędnych karty) – po odbiciu i obrocie
  // o `katRewersu` grot strzałki na rewersie pokrywa się pod światło z grotem na przodzie.
  const r = Math.min(3.5, kartaSzer / 8, kartaWys / 8);
  const odGory = Math.min(4, kartaWys / 6);
  const strzalka: ElementSceny = {
    typ: 'sciezka',
    kontur: [
      ['M', kartaSzer / 2, odGory],
      ['L', kartaSzer / 2 + r * 0.75, odGory + r * 1.4],
      ['L', kartaSzer / 2 - r * 0.75, odGory + r * 1.4],
      ['Z'],
    ],
    obrys: krzyzyk,
  };
  const wew: ElementSceny[] = [strzalka];
  elementy.push(
    obrot === 0
      ? { typ: 'grupa', x: p.x, y: p.y, elementy: wew }
      : {
          typ: 'grupa',
          x: cx,
          y: cy,
          obrot,
          macierz: [1, 0, 0, 1, -kartaSzer / 2, -kartaWys / 2],
          elementy: wew,
        },
  );
  return elementy;
}

/** Krzyż kalibracyjny na środku arkusza z podziałką co 1 mm (±5 mm) do odczytu korekty X/Y. */
function krzyzKalibracyjny(strona: { szer: Mm; wys: Mm }, kolor: string): ElementSceny[] {
  const cx = strona.szer / 2;
  const cy = strona.wys / 2;
  const obrys = { kolor, grubosc: 0.15 };
  const linie: ElementSceny[] = [
    { typ: 'linia', x1: cx - 6, y1: cy, x2: cx + 6, y2: cy, obrys },
    { typ: 'linia', x1: cx, y1: cy - 6, x2: cx, y2: cy + 6, obrys },
  ];
  for (let mm = -5; mm <= 5; mm++) {
    if (mm === 0) continue;
    const h = mm % 5 === 0 ? 1.4 : 0.7;
    linie.push(
      { typ: 'linia', x1: cx + mm, y1: cy - h, x2: cx + mm, y2: cy + h, obrys },
      { typ: 'linia', x1: cx - h, y1: cy + mm, x2: cx + h, y2: cy + mm, obrys },
    );
  }
  return linie;
}

/**
 * Dwustronny wydruk próbny (2 strony: przód + lustrzany tył) do sprawdzenia krawędzi odwracania
 * i odczytania korekty X/Y rewersu pod światło.
 */
export function stronyTestoweDwustronne(
  arkusz: Arkusz,
  talia: Talia,
  ctx: KontekstArkusza,
  etykiety: { przod?: string; tyl?: string } = {},
): [Scena, Scena] {
  const w = zbudujArkusz({ ...arkusz, liczbaStron: 1 }, talia, ctx);
  const u = arkusz.ustawienia;
  const strona = wymiaryStrony(u);
  const krawedz = u.dwustronny?.krawedz ?? 'dluga';
  const os = osOdwracania(strona, krawedz);
  const dop = u.rozmiary === 'mieszane' ? undefined : u.dopasowanie;

  const naStronie0 = w.pozycjeKart.filter((p) => p.strona === 0);
  let pola: PoleTestowe[];
  if (naStronie0.length > 0) {
    pola = naStronie0.map((p) => ({
      x: p.x,
      y: p.y,
      szer: p.szer,
      wys: p.wys,
      obrot: p.obrot,
    }));
  } else {
    // Pusta kartka: używamy slotów siatki (jak `stronaTestowa`), żeby można było kalibrować pusty arkusz.
    const s = w.slot;
    const wzor = talia.karty
      .map((k) => ctx.szablony.get(k.szablonId))
      .find((x) => x?.rozmiar.tryb === 'mm');
    const rozmiarKarty = dop?.linie === 'karta' && wzor ? wymiaryKarty(wzor) : undefined;
    pola = Array.from({ length: w.siatka.rzedy * w.siatka.kolumny }, (_, i) => {
      const k = i % w.siatka.kolumny;
      const r = Math.floor(i / w.siatka.kolumny);
      const slotPola = {
        x: w.poczatekSiatki.x + w.odstepKolumny(0, k) + k * s.szerokosc,
        y: w.poczatekSiatki.y + r * s.wysokosc + w.odstepRzedu(r),
        szer: s.szerokosc,
        wys: s.wysokosc,
      };
      const cel =
        rozmiarKarty &&
        slotPola.szer >= rozmiarKarty.szer - 1e-6 &&
        slotPola.wys >= rozmiarKarty.wys - 1e-6
          ? { ...polozenieKarty(slotPola, rozmiarKarty, dop), ...rozmiarKarty }
          : slotPola;
      return { ...cel, obrot: 0 };
    });
  }

  const kolor = '#000000';
  const stylNr: StylTekstu = { czcionka: 'tytul', rozmiar: 4, kolor };
  const stylNag: StylTekstu = { czcionka: 'tytul', rozmiar: 3.2, kolor };

  const budujStrone = (czyTyl: boolean): Scena => {
    const elementy: ElementSceny[] = [...krzyzKalibracyjny(strona, kolor)];
    const glify: Record<string, DefinicjaGlifu>[] = [];
    const tekstNag = czyTyl ? (etykiety.tyl ?? 'TYŁ') : (etykiety.przod ?? 'PRZÓD');
    const nag = napisTestowy(tekstNag, stylNag, ctx.czcionki);
    glify.push(nag.glify);
    elementy.push({ typ: 'grupa', x: 5, y: 3, elementy: nag.elementy });

    pola.forEach((p, i) => {
      const cel = czyTyl ? odbijProstokat(p, strona, os) : p;
      const kat = czyTyl ? katRewersu(p.obrot, os) : p.obrot;
      const zamienione = p.obrot % 180 !== 0;
      const kartaSzer = zamienione ? p.wys : p.szer;
      const kartaWys = zamienione ? p.szer : p.wys;
      elementy.push(...znacznikiPolaTestowego(cel, kat, kartaSzer, kartaWys, kolor));
      const nr = napisTestowy(String(i + 1), stylNr, ctx.czcionki);
      glify.push(nr.glify);
      elementy.push({ typ: 'grupa', x: cel.x + 1.5, y: cel.y + 1, elementy: nr.elementy });
    });

    return { szer: strona.szer, wys: strona.wys, elementy, glify: polaczGlify(...glify) };
  };

  return [budujStrone(false), budujStrone(true)];
}
