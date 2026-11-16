import type { Mm } from '../model/jednostki';
import type { Kolor, StylTekstu, WyrownanieOsi } from '../model/szablon';
import type { Czcionka, RejestrCzcionek, UlozonyGlif } from './czcionki';
import type { DefinicjaGlifu, ElementSceny, GlifNaScenie } from './scena';

/** Fragment tekstu w jednym stylu. Akapit to ciąg fragmentów; `\n` w tekście kończy akapit. */
export interface Fragment {
  tekst: string;
  styl: StylTekstu;
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
}

interface GlifWWierszu {
  czcionka: Czcionka;
  skala: number;
  kolor: Kolor;
  x: Mm;
  dy: Mm;
  id: number;
}

export interface WierszTekstu {
  szerokosc: Mm;
  wysokosc: Mm;
  /** Odległość linii bazowej od góry wiersza. */
  linia: Mm;
  glify: GlifWWierszu[];
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
): Kawalek {
  const czcionka = czcionki.pobierz(styl.czcionka, styl.wariant);
  const rozmiar = styl.rozmiar * skala;
  const odstepLiter = (styl.odstepLiter ?? 0) * skala;
  const glify = czcionka.uloz(tekst);
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
    const czesci = f.tekst.split('\n');
    czesci.forEach((czesc, i) => {
      if (i > 0) akapity.push([]);
      if (czesc !== '') akapity[akapity.length - 1]!.push({ tekst: czesc, styl: f.styl });
    });
  }
  return akapity;
}

function metryki(k: Pick<Kawalek, 'czcionka' | 'rozmiar' | 'interlinia'>) {
  const naMm = k.rozmiar / k.czcionka.unitsPerEm;
  return {
    wysokosc: k.rozmiar * k.interlinia,
    wznos: k.czcionka.ascent * naMm,
    zejscie: k.czcionka.descent * naMm,
  };
}

function zbudujWiersz(kawalki: Kawalek[], zapasowy: Kawalek | undefined): WierszTekstu {
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
  const glify: GlifWWierszu[] = [];
  let x = 0;
  for (const k of kawalki) {
    const skala = k.rozmiar / k.czcionka.unitsPerEm;
    for (const g of k.glify) {
      if (!k.spacja) {
        glify.push({
          czcionka: k.czcionka,
          skala,
          kolor: k.kolor,
          x: x + g.dx * skala,
          dy: g.dy * skala,
          id: g.id,
        });
      }
      x += g.przesuniecie * skala + k.odstepLiter;
    }
  }
  const szerokosc = kawalki.length > 0 ? x - (kawalki[kawalki.length - 1]?.odstepLiter ?? 0) : 0;
  return { szerokosc, wysokosc, linia: (wysokosc - (wznos + zejscie)) / 2 + wznos, glify };
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
  for (const akapit of naAkapity(fragmenty)) {
    const zapasowy = pierwszy
      ? kawalek(' ', akapit[0]?.styl ?? pierwszy.styl, czcionki, skala)
      : undefined;
    // Słowa = ciągi kawałków bez spacji; łamać można tylko na spacjach.
    const slowa: { spacjaPrzed?: Kawalek; kawalki: Kawalek[]; szerokosc: Mm }[] = [];
    let spacja: Kawalek | undefined;
    let biezace: (typeof slowa)[number] | undefined;
    for (const f of akapit) {
      const tekst = f.styl.wielkieLitery ? f.tekst.toLocaleUpperCase('pl') : f.tekst;
      for (const czesc of tekst.split(/(\s+)/)) {
        if (czesc === '') continue;
        if (/^\s+$/.test(czesc)) {
          spacja = { ...kawalek(' ', f.styl, czcionki, skala), spacja: true };
          biezace = undefined;
          continue;
        }
        const k = kawalek(czesc, f.styl, czcionki, skala);
        if (!biezace) {
          biezace = {
            spacjaPrzed: slowa.length > 0 ? spacja : undefined,
            kawalki: [],
            szerokosc: 0,
          };
          slowa.push(biezace);
          spacja = undefined;
        }
        biezace.kawalki.push(k);
        biezace.szerokosc += k.szerokosc;
      }
    }

    let wiersz: Kawalek[] = [];
    let szerokoscWiersza = 0;
    for (const slowo of slowa) {
      const zSpacja = wiersz.length > 0 && slowo.spacjaPrzed ? slowo.spacjaPrzed.szerokosc : 0;
      if (
        szerokoscMax !== undefined &&
        wiersz.length > 0 &&
        szerokoscWiersza + zSpacja + slowo.szerokosc > szerokoscMax + 1e-6
      ) {
        wiersze.push(zbudujWiersz(wiersz, zapasowy));
        wiersz = [];
        szerokoscWiersza = 0;
      }
      if (wiersz.length > 0 && slowo.spacjaPrzed) {
        wiersz.push(slowo.spacjaPrzed);
        szerokoscWiersza += slowo.spacjaPrzed.szerokosc;
      }
      wiersz.push(...slowo.kawalki);
      szerokoscWiersza += slowo.szerokosc;
      if (szerokoscMax !== undefined && slowo.szerokosc > szerokoscMax + 1e-6) zaSzeroki = true;
    }
    wiersze.push(zbudujWiersz(wiersz, zapasowy));
  }
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
  wyrownanie: 'lewo' | 'srodek' | 'prawo',
  wyrownaniePionowe: WyrownanieOsi,
  slownikGlifow: Record<string, DefinicjaGlifu>,
): ElementSceny[] {
  const wolne = ramka.wys - uklad.wysokosc;
  let y =
    ramka.y +
    (wyrownaniePionowe === 'srodek' ? wolne / 2 : wyrownaniePionowe === 'koniec' ? wolne : 0);
  // Glify grupujemy według koloru – jeden element sceny na kolor.
  const wgKoloru = new Map<Kolor, GlifNaScenie[]>();
  for (const w of uklad.wiersze) {
    const wolneX = ramka.szer - w.szerokosc;
    const x0 =
      ramka.x + (wyrownanie === 'srodek' ? wolneX / 2 : wyrownanie === 'prawo' ? wolneX : 0);
    for (const g of w.glify) {
      const klucz = `${g.czcionka.id}#${g.id}`;
      if (!slownikGlifow[klucz]) slownikGlifow[klucz] = { kontur: g.czcionka.kontur(g.id) };
      const lista = wgKoloru.get(g.kolor) ?? [];
      lista.push({ klucz, x: x0 + g.x, y: y + w.linia - g.dy, skala: g.skala });
      wgKoloru.set(g.kolor, lista);
    }
    y += w.wysokosc;
  }
  return [...wgKoloru].map(([kolor, glify]) => ({ typ: 'tekst' as const, kolor, glify }));
}
