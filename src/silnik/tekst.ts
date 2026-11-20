import type { Mm } from '../model/jednostki';
import type {
  Kolor,
  LukTekstu,
  NazwaIkony,
  StylTekstu,
  WariantCzcionki,
  WyrownanieOsi,
  WyrownanieTekstu,
} from '../model/szablon';
import type { Czcionka, RejestrCzcionek, UlozonyGlif } from './czcionki';
import type { DefinicjaGlifu, ElementSceny, GlifNaScenie } from './scena';
import { konturIkony } from './ikony';

/** Fragment tekstu w jednym stylu. Akapit to ciąg fragmentów; `\n` w tekście kończy akapit. */
export interface Fragment {
  tekst: string;
  styl: StylTekstu;
  /** Fragment jest etykietą pola – akapit z samą etykietą nie dostaje wcięcia ani odstępu po. */
  etykieta?: boolean;
  lista?: boolean;
  ikona?: NazwaIkony;
}

/** Mnożnik rozmiaru syntetycznych kapitalików (czcionka bez cechy `smcp`). */
export const SKALA_KAPITALIKOW = 0.75;

const WARIANTY: Record<WariantCzcionki, [boolean, boolean]> = {
  normalny: [false, false],
  pogrubiony: [true, false],
  kursywa: [false, true],
  'pogrubiona-kursywa': [true, true],
};
const zFlag = (b: boolean, i: boolean): WariantCzcionki =>
  b && i ? 'pogrubiona-kursywa' : b ? 'pogrubiony' : i ? 'kursywa' : 'normalny';

/**
 * Formatowanie w treści: `**pogrubienie**`, `*kursywa*`, `***pogrubiona kursywa***`; `\*` to
 * zwykła gwiazdka. Znacznik otwierający musi stać tuż przed tekstem, zamykający tuż po nim
 * (jak w Markdown) – `5 * 3 * 2` zostaje zwykłym tekstem; znacznik bez pary też. Każdy rodzaj
 * (`*`, `**`, `***`) paruje się osobno. Wariant łączy się z wariantem stylu (np. `**` w kursywie
 * daje pogrubioną kursywę).
 */
export function parsujFormatowanie(tekst: string, styl: StylTekstu): Fragment[] {
  type Znacznik = { znacznik: 1 | 2 | 3; para?: boolean; otwiera: boolean; zamyka: boolean };
  type Znak = { tekst: string } | Znacznik;
  const czesci: Znak[] = [];
  const re = /\\\*|\*{1,3}/g;
  let poz = 0;
  for (const m of tekst.matchAll(re)) {
    if (m.index > poz) czesci.push({ tekst: tekst.slice(poz, m.index) });
    if (m[0] === '\\*') czesci.push({ tekst: '*' });
    else {
      const przed = tekst[m.index - 1];
      const po = tekst[m.index + m[0].length];
      czesci.push({
        znacznik: m[0].length as 1 | 2 | 3,
        otwiera: po !== undefined && !/\s/.test(po),
        zamyka: przed !== undefined && !/\s/.test(przed),
      });
    }
    poz = m.index + m[0].length;
  }
  if (poz < tekst.length) czesci.push({ tekst: tekst.slice(poz) });
  // Parowanie: znacznik otwiera, ten sam rodzaj dalej zamyka.
  const otwarte = new Map<number, Znacznik>();
  for (const c of czesci) {
    if (!('znacznik' in c)) continue;
    const o = otwarte.get(c.znacznik);
    if (o && c.zamyka) {
      o.para = true;
      c.para = true;
      otwarte.delete(c.znacznik);
    } else if (c.otwiera) otwarte.set(c.znacznik, c);
  }
  const [b0, i0] = WARIANTY[styl.wariant ?? 'normalny'];
  let b = false;
  let i = false;
  const wynik: Fragment[] = [];
  // Ten sam obiekt stylu dla tego samego wariantu – sąsiednie kawałki się łączą.
  const style = new Map<WariantCzcionki, StylTekstu>();
  const dodajZeStylem = (t: string) => {
    if (t === '') return;
    const wariant = zFlag(b0 || b, i0 || i);
    let st = style.get(wariant);
    if (!st) {
      st = wariant === (styl.wariant ?? 'normalny') ? styl : { ...styl, wariant };
      style.set(wariant, st);
    }
    const ost = wynik[wynik.length - 1];
    if (ost && ost.styl === st) ost.tekst += t;
    else wynik.push({ tekst: t, styl: st });
  };
  for (const c of czesci) {
    if ('tekst' in c) dodajZeStylem(c.tekst);
    else if (!c.para) dodajZeStylem('*'.repeat(c.znacznik));
    else if (c.znacznik === 3) {
      b = !b;
      i = !i;
    } else if (c.znacznik === 2) b = !b;
    else i = !i;
  }
  return wynik;
}

const KODY_IKON = new Map<string, NazwaIkony>([
  ['star', 'gwiazdka'],
  ['scissors', 'nozyczki'],
]);

/** Ikony zachowują styl otaczającego fragmentu. Nieznane kody pozostają tekstem. */
export function dodajNotacjeTekstu(
  fragmenty: Fragment[],
  listy: boolean | undefined,
  ikony: boolean | undefined,
): Fragment[] {
  if (!listy && !ikony) return fragmenty;
  return fragmenty.flatMap((f) => {
    const fragment = listy ? { ...f, lista: true } : f;
    if (!ikony) return [fragment];
    const wynik: Fragment[] = [];
    let od = 0;
    for (const m of f.tekst.matchAll(/(\\)?:(\w+):/g)) {
      const ikona = KODY_IKON.get(m[2]!);
      if (!ikona) continue;
      if (m.index > od) wynik.push({ ...fragment, tekst: f.tekst.slice(od, m.index) });
      wynik.push(m[1] ? { ...fragment, tekst: m[0].slice(1) } : { ...fragment, tekst: '', ikona });
      od = m.index + m[0].length;
    }
    if (f.tekst.length > od) wynik.push({ ...fragment, tekst: f.tekst.slice(od) });
    return wynik;
  });
}

const KOLOR_DOMYSLNY: Kolor = '#000000';
const INTERLINIA_DOMYSLNA = 1.2;

interface Kawalek {
  czcionka: Czcionka;
  rozmiar: Mm;
  interlinia: number;
  kolor: Kolor;
  odstepLiter: Mm;
  glify: UlozonyGlif[];
  szerokosc: Mm;
  spacja: boolean;
  ikona?: NazwaIkony;
}

interface GlifWWierszu {
  czcionka: Czcionka;
  skala: number;
  kolor: Kolor;
  x: Mm;
  /** Pozycja kursora przed dodaniem `dx` glifu – do wyznaczenia środka klastra na łuku. */
  xKursor: Mm;
  /** Szerokość przesunięcia glifu w mm (0 dla znaków łączących / dostawnych). */
  przesuniecie: Mm;
  dy: Mm;
  id: number;
  /** Liczba odstępów między słowami przed glifem w wierszu (do justowania). */
  nrSpacji: number;
}

interface IkonaWWierszu {
  ikona: NazwaIkony;
  x: Mm;
  rozmiar: Mm;
  kolor: Kolor;
  nrSpacji: number;
}

export interface WierszTekstu {
  szerokosc: Mm;
  wysokosc: Mm;
  /** Odległość linii bazowej od góry wiersza. */
  linia: Mm;
  /** Wznos i zejście pisma w wierszu (mm). */
  wznos: Mm;
  zejscie: Mm;
  glify: GlifWWierszu[];
  ikony?: IkonaWWierszu[];
  szerokoscPozycjiListy?: Mm;
  /** Odstępy między słowami w wierszu. */
  spacje: number;
  /** Ostatni wiersz akapitu (nie jest justowany). */
  ostatni: boolean;
}

export interface UkladTekstu {
  wiersze: WierszTekstu[];
  /** Szerokość najszerszego wiersza. */
  szerokosc: Mm;
  wysokosc: Mm;
  /** Któreś słowo nie mieści się w zadanej szerokości. */
  zaSzeroki: boolean;
}

function kawalek(
  tekst: string,
  styl: StylTekstu,
  czcionki: RejestrCzcionek,
  skala: number,
  cechy?: string[],
): Kawalek {
  const czcionka = czcionki.pobierz(styl.czcionka, styl.wariant);
  const rozmiar = styl.rozmiar * skala;
  const odstepLiter = (styl.odstepLiter ?? 0) * skala;
  const glify = czcionka.uloz(tekst, cechy);
  const naMm = rozmiar / czcionka.unitsPerEm;
  const szerokosc = glify.reduce(
    (s, g) => s + g.przesuniecie * naMm + (g.przesuniecie > 0 ? odstepLiter : 0),
    0,
  );
  return {
    czcionka,
    rozmiar,
    interlinia: styl.interlinia ?? INTERLINIA_DOMYSLNA,
    kolor: styl.kolor ?? KOLOR_DOMYSLNY,
    odstepLiter,
    glify,
    szerokosc,
    spacja: false,
  };
}

/** Dzieli fragmenty na akapity (po `\n`) i słowa; spacje zwijane do jednej. */
function naAkapity(fragmenty: Fragment[]): Fragment[][] {
  const akapity: Fragment[][] = [[]];
  for (const f of fragmenty) {
    if (f.ikona) {
      akapity[akapity.length - 1]!.push(f);
      continue;
    }
    const czesci = f.tekst.split('\n');
    czesci.forEach((czesc, i) => {
      if (i > 0) akapity.push([]);
      if (czesc !== '') akapity[akapity.length - 1]!.push({ ...f, tekst: czesc });
    });
  }
  return akapity;
}

/**
 * Kawałki jednego słowa: zwykle jeden; kapitaliki bez cechy `smcp` – małe litery jako
 * mniejsze wersaliki (osobne kawałki).
 */
function kawalkiSlowa(
  tekst: string,
  styl: StylTekstu,
  czcionki: RejestrCzcionek,
  skala: number,
): Kawalek[] {
  if (!styl.kapitaliki || styl.wielkieLitery) return [kawalek(tekst, styl, czcionki, skala)];
  if (czcionki.pobierz(styl.czcionka, styl.wariant).maCeche('smcp'))
    return [kawalek(tekst, styl, czcionki, skala, ['smcp'])];
  const male = { ...styl, rozmiar: styl.rozmiar * SKALA_KAPITALIKOW };
  return tekst
    .split(/(\p{Ll}+)/u)
    .filter((c) => c !== '')
    .map((c) =>
      /^\p{Ll}+$/u.test(c)
        ? kawalek(c.toLocaleUpperCase('pl'), male, czcionki, skala)
        : kawalek(c, styl, czcionki, skala),
    );
}

function znacznikListy(akapit: Fragment[]): { numer: string; styl: StylTekstu } | undefined {
  const f = akapit[0];
  if (!f?.lista || f.etykieta) return undefined;
  const tekst = akapit.map((x) => (x.ikona ? '\uFFFC' : x.tekst)).join('');
  const m = /^(\d{1,9}\.)[ \t]+/.exec(tekst);
  if (!m || !tekst.slice(m[0].length).trim()) return undefined;
  let pozostalo = m[0].length;
  let i = 0;
  while (pozostalo > 0) {
    const x = akapit[i]!;
    if (x.tekst.length > pozostalo) {
      akapit[i] = { ...x, tekst: x.tekst.slice(pozostalo) };
      break;
    }
    pozostalo -= x.tekst.length;
    i++;
  }
  akapit.splice(0, i);
  return { numer: m[1]!, styl: f.styl };
}

function kawalekIkony(
  ikona: NazwaIkony,
  styl: StylTekstu,
  czcionki: RejestrCzcionek,
  skala: number,
): Kawalek {
  const k = kawalek('', styl, czcionki, skala);
  return { ...k, ikona, odstepLiter: 0, szerokosc: k.rozmiar };
}

const WZNOS_IKONY = 0.8;
function metryki(k: Kawalek) {
  if (k.ikona) {
    const wznos = k.rozmiar * WZNOS_IKONY;
    return {
      wysokosc: k.rozmiar * Math.max(1, k.interlinia),
      wznos,
      zejscie: k.rozmiar - wznos,
    };
  }
  const naMm = k.rozmiar / k.czcionka.unitsPerEm;
  return {
    wysokosc: k.rozmiar * k.interlinia,
    wznos: k.czcionka.ascent * naMm,
    zejscie: k.czcionka.descent * naMm,
  };
}

function zbudujWiersz(
  kawalki: Kawalek[],
  zapasowy: Kawalek | undefined,
  wciecie: Mm,
  ostatni: boolean,
): WierszTekstu {
  // Spacje na końcu wiersza nie zajmują miejsca.
  while (kawalki.length > 0 && kawalki[kawalki.length - 1]!.spacja) kawalki.pop();
  const doMetryk = kawalki.length > 0 ? kawalki : zapasowy ? [zapasowy] : [];
  let wysokosc = 0;
  let wznos = 0;
  let zejscie = 0;
  for (const k of doMetryk) {
    const m = metryki(k);
    wysokosc = Math.max(wysokosc, m.wysokosc);
    wznos = Math.max(wznos, m.wznos);
    zejscie = Math.max(zejscie, m.zejscie);
  }
  if (kawalki.some((k) => k.ikona)) wysokosc = Math.max(wysokosc, wznos + zejscie);
  const glify: GlifWWierszu[] = [];
  const ikony: IkonaWWierszu[] = [];
  let x = wciecie;
  let spacje = 0;
  for (const k of kawalki) {
    const skala = k.rozmiar / k.czcionka.unitsPerEm;
    if (k.spacja) spacje++;
    if (k.ikona) {
      ikony.push({ ikona: k.ikona, x, rozmiar: k.rozmiar, kolor: k.kolor, nrSpacji: spacje });
      x += k.szerokosc;
      continue;
    }
    let oczekujeOdstep = false;
    for (let i = 0; i < k.glify.length; i++) {
      const g = k.glify[i]!;
      const przesuniecie = g.przesuniecie * skala;
      if (!k.spacja) {
        glify.push({
          czcionka: k.czcionka,
          skala,
          kolor: k.kolor,
          x: x + g.dx * skala,
          xKursor: x,
          przesuniecie,
          dy: g.dy * skala,
          id: g.id,
          nrSpacji: spacje,
        });
      }
      x += przesuniecie;
      if (g.przesuniecie > 0) oczekujeOdstep = true;
      const nastepny = k.glify[i + 1];
      if (oczekujeOdstep && (!nastepny || nastepny.przesuniecie > 0)) {
        x += k.odstepLiter;
        oczekujeOdstep = false;
      }
    }
  }
  const ostKawalek = kawalki[kawalki.length - 1];
  const ostOdstep =
    ostKawalek && ostKawalek.glify.some((g) => g.przesuniecie > 0) ? ostKawalek.odstepLiter : 0;
  const szerokosc = kawalki.length > 0 ? x - ostOdstep : 0;
  return {
    szerokosc,
    wysokosc,
    linia: (wysokosc - (wznos + zejscie)) / 2 + wznos,
    wznos,
    zejscie,
    glify,
    ...(ikony.length ? { ikony } : {}),
    spacje,
    ostatni,
  };
}

// Granice grafemów zachowują litery ze znakami łączącymi i sekwencje Unicode jako całość.
const GRAFEMY = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Najdłuższy mieszczący się prefiks od granicy grafemu; każdy prefiks składamy razem. */
function prefiksSlowa(
  f: Fragment,
  granice: number[],
  od: number,
  miejsce: Mm,
  czcionki: RejestrCzcionek,
  skala: number,
) {
  const sprawdz = (do_: number) => {
    const kawalki = kawalkiSlowa(f.tekst.slice(granice[od], granice[do_]), f.styl, czcionki, skala);
    return { do_, kawalki, szer: kawalki.reduce((s, k) => s + k.szerokosc, 0) };
  };
  let pasuje = sprawdz(od + 1);
  const ostatni = granice.length - 1;
  if (pasuje.szer > miejsce + 1e-6 || pasuje.do_ === ostatni) return pasuje;

  // Najpierw szukamy górnej granicy blisko początku, również dla bardzo długich wklejek.
  let proba = sprawdz(Math.min(ostatni, od + 2));
  while (proba.szer <= miejsce + 1e-6) {
    pasuje = proba;
    if (pasuje.do_ === ostatni) return pasuje;
    proba = sprawdz(Math.min(ostatni, od + 2 * (pasuje.do_ - od)));
  }
  let zaDaleko = proba.do_;
  while (zaDaleko - pasuje.do_ > 1) {
    proba = sprawdz(Math.floor((pasuje.do_ + zaDaleko) / 2));
    if (proba.szer > miejsce + 1e-6) zaDaleko = proba.do_;
    else pasuje = proba;
  }
  return pasuje;
}

/**
 * Układa tekst w wiersze. `szerokoscMax` = undefined oznacza brak łamania.
 * `skala` mnoży wszystkie rozmiary (do auto-dopasowania).
 */
export function ulozTekst(
  fragmenty: Fragment[],
  szerokoscMax: Mm | undefined,
  czcionki: RejestrCzcionek,
  skala = 1,
  lamDlugieSlowa = false,
): UkladTekstu {
  const wiersze: WierszTekstu[] = [];
  let zaSzeroki = false;
  const pierwszy = fragmenty[0];
  const akapity = naAkapity(fragmenty);
  akapity.forEach((akapit, nrAkapitu) => {
    const odWiersza = wiersze.length;
    const pozycjaListy = znacznikListy(akapit);
    const numer =
      pozycjaListy && kawalek(`${pozycjaListy.numer} `, pozycjaListy.styl, czcionki, skala);
    const zapasowy = pierwszy
      ? kawalek(' ', akapit[0]?.styl ?? pierwszy.styl, czcionki, skala)
      : undefined;
    // Wcięcie i odstęp po akapicie – ze stylu początku akapitu; akapit z samą etykietą bez nich.
    const tylkoEtykieta = akapit.length > 0 && akapit.every((f) => f.etykieta);
    const stylAkapitu = akapit.find((f) => !f.etykieta)?.styl ?? akapit[0]?.styl;
    const wciecie = tylkoEtykieta || akapit[0]?.etykieta ? 0 : (stylAkapitu?.wciecie ?? 0) * skala;
    // Bez odstępu: po ostatnim akapicie, po samej etykiecie i przed samą etykietą (np. „pod”).
    const nastepny = akapity[nrAkapitu + 1];
    const przedEtykieta = !!nastepny && nastepny.length > 0 && nastepny.every((f) => f.etykieta);
    const odstepPo =
      tylkoEtykieta || przedEtykieta || nrAkapitu === akapity.length - 1
        ? 0
        : (stylAkapitu?.odstepAkapitow ?? 0) * skala;
    const slowa: {
      spacjaPrzed?: Kawalek;
      kawalki: Kawalek[];
      szerokosc: Mm;
      fragmenty: Fragment[];
    }[] = [];
    let spacja: Kawalek | undefined;
    let biezace: (typeof slowa)[number] | undefined;
    const dodaj = (ks: Kawalek[], fragment: Fragment) => {
      if (!biezace) {
        biezace = {
          spacjaPrzed: slowa.length > 0 ? spacja : undefined,
          kawalki: [],
          szerokosc: 0,
          fragmenty: [],
        };
        slowa.push(biezace);
        spacja = undefined;
      }
      if (lamDlugieSlowa) biezace.fragmenty.push(fragment);
      for (const k of ks) {
        biezace.kawalki.push(k);
        biezace.szerokosc += k.szerokosc;
      }
    };
    for (const f of akapit) {
      if (f.ikona) {
        dodaj([kawalekIkony(f.ikona, f.styl, czcionki, skala)], f);
        continue;
      }
      const tekst = f.styl.wielkieLitery ? f.tekst.toLocaleUpperCase('pl') : f.tekst;
      for (const czesc of tekst.split(/(\s+)/)) {
        if (czesc === '') continue;
        if (/^\s+$/.test(czesc)) {
          spacja = { ...kawalek(' ', f.styl, czcionki, skala), spacja: true };
          biezace = undefined;
          continue;
        }
        dodaj(kawalkiSlowa(czesc, f.styl, czcionki, skala), { ...f, tekst: czesc });
      }
    }
    if (numer && slowa[0]) {
      slowa[0].kawalki.unshift(numer);
      slowa[0].szerokosc += numer.szerokosc;
    }
    const wiszace = numer ? wciecie + numer.szerokosc : 0;

    let wiersz: Kawalek[] = [];
    let szerokoscWiersza = wciecie;
    let pierwszyWiersz = true;
    const nowyWiersz = () => {
      wiersze.push(zbudujWiersz(wiersz, zapasowy, pierwszyWiersz ? wciecie : wiszace, false));
      wiersz = [];
      szerokoscWiersza = wiszace;
      pierwszyWiersz = false;
    };
    for (const slowo of slowa) {
      const zSpacja = wiersz.length > 0 && slowo.spacjaPrzed ? slowo.spacjaPrzed.szerokosc : 0;
      if (
        szerokoscMax !== undefined &&
        wiersz.length > 0 &&
        szerokoscWiersza + zSpacja + slowo.szerokosc > szerokoscMax + 1e-6
      ) {
        nowyWiersz();
      }
      if (
        lamDlugieSlowa &&
        szerokoscMax !== undefined &&
        szerokoscWiersza + slowo.szerokosc > szerokoscMax + 1e-6
      ) {
        const pisz = (kawalki: Kawalek[], szer: Mm) => {
          for (const k of kawalki) wiersz.push(k);
          szerokoscWiersza += szer;
          if (szerokoscWiersza > szerokoscMax + 1e-6) zaSzeroki = true;
        };
        if (numer && slowo === slowa[0]) pisz([numer], numer.szerokosc);
        for (const f of slowo.fragmenty) {
          if (f.ikona) {
            const k = kawalekIkony(f.ikona, f.styl, czcionki, skala);
            if (wiersz.length && szerokoscWiersza + k.szerokosc > szerokoscMax + 1e-6) nowyWiersz();
            pisz([k], k.szerokosc);
            continue;
          }
          const granice = Array.from(GRAFEMY.segment(f.tekst), (g) => g.index);
          granice.push(f.tekst.length);
          for (let od = 0; od < granice.length - 1;) {
            const p = prefiksSlowa(
              f,
              granice,
              od,
              szerokoscMax - szerokoscWiersza,
              czcionki,
              skala,
            );
            if (wiersz.length && szerokoscWiersza + p.szer > szerokoscMax + 1e-6) {
              nowyWiersz();
              continue;
            }
            pisz(p.kawalki, p.szer);
            od = p.do_;
            if (od < granice.length - 1) nowyWiersz();
          }
        }
        continue;
      }
      if (wiersz.length > 0 && slowo.spacjaPrzed) {
        wiersz.push(slowo.spacjaPrzed);
        szerokoscWiersza += slowo.spacjaPrzed.szerokosc;
      }
      for (const k of slowo.kawalki) wiersz.push(k);
      szerokoscWiersza += slowo.szerokosc;
      const odsuniecie = pierwszyWiersz ? wciecie : wiszace;
      if (
        szerokoscMax !== undefined &&
        slowo.szerokosc + (numer ? odsuniecie : 0) > szerokoscMax + 1e-6
      )
        zaSzeroki = true;
    }
    const ostatni = zbudujWiersz(wiersz, zapasowy, pierwszyWiersz ? wciecie : wiszace, true);
    ostatni.wysokosc += odstepPo;
    wiersze.push(ostatni);
    if (numer) {
      const pozycja = wiersze.slice(odWiersza);
      const szerokosc = pozycja.reduce((m, w) => Math.max(m, w.szerokosc), 0);
      for (const w of pozycja) w.szerokoscPozycjiListy = szerokosc;
    }
  });
  return {
    wiersze,
    szerokosc: wiersze.reduce((m, w) => Math.max(m, w.szerokosc), 0),
    wysokosc: wiersze.reduce((s, w) => s + w.wysokosc, 0),
    zaSzeroki,
  };
}

/**
 * Auto-dopasowanie: zmniejsza tekst krokami 2%, aż zmieści się w ramce,
 * ale nie poniżej `minRozmiar / rozmiar`. Zwraca najlepszy znaleziony układ.
 */
export function ulozDopasowany(
  fragmenty: Fragment[],
  szer: Mm,
  wys: Mm,
  czcionki: RejestrCzcionek,
  wieleWierszy: boolean,
  minimalnaSkala: number,
  lamDlugieSlowa = false,
): UkladTekstu & { przepelnienie: boolean } {
  const miesciSie = (u: UkladTekstu) =>
    u.wysokosc <= wys + 1e-6 && u.szerokosc <= szer + 1e-6 && !u.zaSzeroki;
  let skala = 1;
  let uklad = ulozTekst(
    fragmenty,
    wieleWierszy ? szer : undefined,
    czcionki,
    skala,
    lamDlugieSlowa,
  );
  while (!miesciSie(uklad) && skala - 0.02 >= minimalnaSkala - 1e-9) {
    skala -= 0.02;
    uklad = ulozTekst(fragmenty, wieleWierszy ? szer : undefined, czcionki, skala, lamDlugieSlowa);
  }
  return { ...uklad, przepelnienie: !miesciSie(uklad) };
}

/** Zamienia ułożony tekst na elementy sceny w ramce (x, y, szer, wys). */
export function tekstNaScene(
  uklad: UkladTekstu,
  ramka: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  wyrownanie: WyrownanieTekstu,
  wyrownaniePionowe: WyrownanieOsi,
  slownikGlifow: Record<string, DefinicjaGlifu>,
  obwodka?: { grubosc: Mm; kolor: Kolor },
): ElementSceny[] {
  const wolne = ramka.wys - uklad.wysokosc;
  let y =
    ramka.y +
    (wyrownaniePionowe === 'srodek' ? wolne / 2 : wyrownaniePionowe === 'koniec' ? wolne : 0);
  // Glify grupujemy według koloru – jeden element sceny na kolor.
  const wgKoloru = new Map<Kolor, GlifNaScenie[]>();
  const ikony: ElementSceny[] = [];
  for (const w of uklad.wiersze) {
    const wolneX = ramka.szer - w.szerokosc;
    const wolneDlaWyrownania = ramka.szer - (w.szerokoscPozycjiListy ?? w.szerokosc);
    const x0 =
      ramka.x +
      (wyrownanie === 'srodek'
        ? wolneDlaWyrownania / 2
        : wyrownanie === 'prawo'
          ? wolneDlaWyrownania
          : 0);
    // Justowanie: wolne miejsce rozdzielone między odstępy słów (bez ostatniego wiersza akapitu).
    const naSpacje =
      wyrownanie === 'justuj' && !w.ostatni && w.spacje > 0 && wolneX > 0 ? wolneX / w.spacje : 0;
    for (const g of w.glify) {
      const klucz = `${g.czcionka.id}#${g.id}`;
      if (!slownikGlifow[klucz]) slownikGlifow[klucz] = { kontur: g.czcionka.kontur(g.id) };
      const lista = wgKoloru.get(g.kolor) ?? [];
      lista.push({
        klucz,
        x: x0 + g.x + g.nrSpacji * naSpacje,
        y: y + w.linia - g.dy,
        skala: g.skala,
      });
      wgKoloru.set(g.kolor, lista);
    }
    for (const i of w.ikony ?? [])
      ikony.push({
        typ: 'sciezka',
        kontur: konturIkony(
          i.ikona,
          x0 + i.x + i.nrSpacji * naSpacje,
          y + w.linia - WZNOS_IKONY * i.rozmiar,
          i.rozmiar,
        ),
        wypelnienie: i.kolor,
        ...(obwodka && obwodka.grubosc > 0 ? { obrys: obwodka } : {}),
      });
    y += w.wysokosc;
  }
  const tekst = [...wgKoloru].map(([kolor, glify]) =>
    obwodka && obwodka.grubosc > 0
      ? {
          typ: 'tekst' as const,
          kolor,
          glify,
          obwodka: { kolor: obwodka.kolor, grubosc: obwodka.grubosc },
        }
      : { typ: 'tekst' as const, kolor, glify },
  );
  return [...tekst, ...ikony];
}

export interface GraniceLuku {
  minX: Mm;
  minY: Mm;
  maxX: Mm;
  maxY: Mm;
  szer: Mm;
  wys: Mm;
}

const KATY_KARDYNALNE = [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI];

function promienWierszaNaLuku(luk: LukTekstu, przesunieciePionowe: Mm): Mm {
  const r0 = Math.max(1, luk.promien);
  return (luk.kierunek ?? 'gora') === 'dol'
    ? r0 + przesunieciePionowe
    : Math.max(1, r0 - przesunieciePionowe);
}

/** Dokładny prostokąt opisany na tekście ułożonym po łuku (względem środka okręgu (0, 0)). */
export function graniceTekstuPoLuku(uklad: UkladTekstu, luk: LukTekstu): GraniceLuku {
  const kierunek = luk.kierunek ?? 'gora';
  const znakY = kierunek === 'dol' ? 1 : -1;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let przesuniecie = 0;

  const dodajPunkt = (r: Mm, alfa: number) => {
    const px = r * Math.sin(alfa);
    const py = znakY * r * Math.cos(alfa);
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  };

  for (const w of uklad.wiersze) {
    const r = promienWierszaNaLuku(luk, przesuniecie);
    const pol = w.szerokosc > 0 ? Math.min(Math.PI, w.szerokosc / (2 * r)) : 0;
    const rZew = kierunek === 'dol' ? r + w.zejscie : r + w.wznos;
    const rWew = Math.max(0, kierunek === 'dol' ? r - w.wznos : r - w.zejscie);
    const katy = [-pol, pol];
    for (const k of KATY_KARDYNALNE) if (k > -pol && k < pol) katy.push(k);
    for (const alfa of katy) {
      dodajPunkt(rZew, alfa);
      dodajPunkt(rWew, alfa);
    }
    przesuniecie += w.wysokosc;
  }

  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, szer: 0, wys: 0 };
  return { minX, minY, maxX, maxY, szer: maxX - minX, wys: maxY - minY };
}

/** Auto-dopasowanie tekstu po łuku do prostokąta ramki (krok 2%, nie poniżej `minimalnaSkala`). */
export function ulozPoLukuDopasowany(
  fragmenty: Fragment[],
  luk: LukTekstu,
  szer: Mm,
  wys: Mm,
  czcionki: RejestrCzcionek,
  minimalnaSkala: number,
): UkladTekstu & { granice: GraniceLuku; przepelnienie: boolean } {
  const miesciSie = (g: GraniceLuku) => g.szer <= szer + 1e-6 && g.wys <= wys + 1e-6;
  let skala = 1;
  let uklad = ulozTekst(fragmenty, undefined, czcionki, skala);
  let granice = graniceTekstuPoLuku(uklad, luk);
  while (!miesciSie(granice) && skala - 0.02 >= minimalnaSkala - 1e-9) {
    skala -= 0.02;
    uklad = ulozTekst(fragmenty, undefined, czcionki, skala);
    granice = graniceTekstuPoLuku(uklad, luk);
  }
  return { ...uklad, granice, przepelnienie: !miesciSie(granice) };
}

/**
 * Zamienia tekst ułożony po łuku na elementy sceny w ramce.
 * Glify o zerowym przesunięciu (znaki łączące / dostawne) obracają się razem ze swoim glifem
 * bazowym jako jeden klaster – nie odrywają się od litery bazowej na łuku.
 */
export function tekstPoLukuNaScene(
  uklad: UkladTekstu,
  luk: LukTekstu,
  ramka: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  wyrownanie: WyrownanieTekstu,
  wyrownaniePionowe: WyrownanieOsi,
  slownikGlifow: Record<string, DefinicjaGlifu>,
  obwodka?: { grubosc: Mm; kolor: Kolor },
): ElementSceny[] {
  const kierunek = luk.kierunek ?? 'gora';
  const znakY = kierunek === 'dol' ? 1 : -1;
  const g = graniceTekstuPoLuku(uklad, luk);
  const wolneX = ramka.szer - g.szer;
  const wolneY = ramka.wys - g.wys;
  const ox = ramka.x + (wyrownanie === 'srodek' ? wolneX / 2 : wyrownanie === 'prawo' ? wolneX : 0);
  const oy =
    ramka.y +
    (wyrownaniePionowe === 'srodek' ? wolneY / 2 : wyrownaniePionowe === 'koniec' ? wolneY : 0);
  const cx = ox - g.minX;
  const cy = oy - g.minY;

  const wgKoloru = new Map<Kolor, GlifNaScenie[]>();
  const ikony: ElementSceny[] = [];
  let przesuniecie = 0;

  for (const w of uklad.wiersze) {
    const r = promienWierszaNaLuku(luk, przesuniecie);
    // Grupowanie glifów w klastry (glif bazowy + kolejne znaki łączące o przesunięciu 0).
    const klastry: GlifWWierszu[][] = [];
    for (const gl of w.glify) {
      const poprzedni = klastry[klastry.length - 1]?.[0];
      if (!poprzedni || gl.przesuniecie > 0 || gl.nrSpacji !== poprzedni.nrSpacji) {
        klastry.push([gl]);
      } else {
        klastry[klastry.length - 1]!.push(gl);
      }
    }
    for (const kl of klastry) {
      const baza = kl[0]!;
      const srodek = baza.xKursor + baza.przesuniecie / 2;
      const s = srodek - w.szerokosc / 2;
      const alfa = s / r;
      const ax = cx + r * Math.sin(alfa);
      const ay = cy + znakY * r * Math.cos(alfa);
      const fi = kierunek === 'dol' ? -alfa : alfa;
      const cosFi = Math.cos(fi);
      const sinFi = Math.sin(fi);
      const obrot = (fi * 180) / Math.PI;
      for (const gl of kl) {
        const klucz = `${gl.czcionka.id}#${gl.id}`;
        if (!slownikGlifow[klucz]) slownikGlifow[klucz] = { kontur: gl.czcionka.kontur(gl.id) };
        const lx = gl.x - srodek;
        const ly = -gl.dy;
        const gx = ax + lx * cosFi - ly * sinFi;
        const gy = ay + lx * sinFi + ly * cosFi;
        const lista = wgKoloru.get(gl.kolor) ?? [];
        lista.push({
          klucz,
          x: gx,
          y: gy,
          skala: gl.skala,
          ...(Math.abs(obrot) > 1e-6 ? { obrot } : {}),
        });
        wgKoloru.set(gl.kolor, lista);
      }
    }
    for (const i of w.ikony ?? []) {
      const srodek = i.x + i.rozmiar / 2;
      const s = srodek - w.szerokosc / 2;
      const alfa = s / r;
      const ax = cx + r * Math.sin(alfa);
      const ay = cy + znakY * r * Math.cos(alfa);
      const obrot = ((kierunek === 'dol' ? -alfa : alfa) * 180) / Math.PI;
      ikony.push({
        typ: 'grupa',
        x: ax,
        y: ay,
        ...(Math.abs(obrot) > 1e-6 ? { obrot } : {}),
        elementy: [
          {
            typ: 'sciezka',
            kontur: konturIkony(i.ikona, -i.rozmiar / 2, -WZNOS_IKONY * i.rozmiar, i.rozmiar),
            wypelnienie: i.kolor,
            ...(obwodka && obwodka.grubosc > 0 ? { obrys: obwodka } : {}),
          },
        ],
      });
    }
    przesuniecie += w.wysokosc;
  }

  const tekst = [...wgKoloru].map(([kolor, glify]) =>
    obwodka && obwodka.grubosc > 0
      ? {
          typ: 'tekst' as const,
          kolor,
          glify,
          obwodka: { kolor: obwodka.kolor, grubosc: obwodka.grubosc },
        }
      : { typ: 'tekst' as const, kolor, glify },
  );
  return [...tekst, ...ikony];
}
