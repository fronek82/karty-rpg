import type { Mm } from '../model/jednostki';
import type {
  Kolor,
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
  const szerokosc =
    glify.reduce((s, g) => s + g.przesuniecie * naMm, 0) + odstepLiter * glify.length;
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
    for (const g of k.glify) {
      if (!k.spacja) {
        glify.push({
          czcionka: k.czcionka,
          skala,
          kolor: k.kolor,
          x: x + g.dx * skala,
          dy: g.dy * skala,
          id: g.id,
          nrSpacji: spacje,
        });
      }
      x += g.przesuniecie * skala + k.odstepLiter;
    }
  }
  const szerokosc = kawalki.length > 0 ? x - (kawalki[kawalki.length - 1]?.odstepLiter ?? 0) : 0;
  return {
    szerokosc,
    wysokosc,
    linia: (wysokosc - (wznos + zejscie)) / 2 + wznos,
    glify,
    ...(ikony.length ? { ikony } : {}),
    spacje,
    ostatni,
  };
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
    // Słowa = ciągi kawałków bez spacji; łamać można tylko na spacjach.
    const slowa: { spacjaPrzed?: Kawalek; kawalki: Kawalek[]; szerokosc: Mm }[] = [];
    let spacja: Kawalek | undefined;
    let biezace: (typeof slowa)[number] | undefined;
    const dodaj = (ks: Kawalek[]) => {
      if (!biezace) {
        biezace = {
          spacjaPrzed: slowa.length > 0 ? spacja : undefined,
          kawalki: [],
          szerokosc: 0,
        };
        slowa.push(biezace);
        spacja = undefined;
      }
      for (const k of ks) {
        biezace.kawalki.push(k);
        biezace.szerokosc += k.szerokosc;
      }
    };
    for (const f of akapit) {
      if (f.ikona) {
        dodaj([kawalekIkony(f.ikona, f.styl, czcionki, skala)]);
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
        dodaj(kawalkiSlowa(czesc, f.styl, czcionki, skala));
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
    for (const slowo of slowa) {
      const zSpacja = wiersz.length > 0 && slowo.spacjaPrzed ? slowo.spacjaPrzed.szerokosc : 0;
      if (
        szerokoscMax !== undefined &&
        wiersz.length > 0 &&
        szerokoscWiersza + zSpacja + slowo.szerokosc > szerokoscMax + 1e-6
      ) {
        wiersze.push(zbudujWiersz(wiersz, zapasowy, pierwszyWiersz ? wciecie : wiszace, false));
        wiersz = [];
        szerokoscWiersza = wiszace;
        pierwszyWiersz = false;
      }
      if (wiersz.length > 0 && slowo.spacjaPrzed) {
        wiersz.push(slowo.spacjaPrzed);
        szerokoscWiersza += slowo.spacjaPrzed.szerokosc;
      }
      wiersz.push(...slowo.kawalki);
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
      const szerokosc = Math.max(...pozycja.map((w) => w.szerokosc));
      for (const w of pozycja) w.szerokoscPozycjiListy = szerokosc;
    }
  });
  return {
    wiersze,
    szerokosc: Math.max(0, ...wiersze.map((w) => w.szerokosc)),
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
): UkladTekstu & { przepelnienie: boolean } {
  const miesciSie = (u: UkladTekstu) =>
    u.wysokosc <= wys + 1e-6 && u.szerokosc <= szer + 1e-6 && !u.zaSzeroki;
  let skala = 1;
  let uklad = ulozTekst(fragmenty, wieleWierszy ? szer : undefined, czcionki, skala);
  while (!miesciSie(uklad) && skala - 0.02 >= minimalnaSkala - 1e-9) {
    skala -= 0.02;
    uklad = ulozTekst(fragmenty, wieleWierszy ? szer : undefined, czcionki, skala);
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
