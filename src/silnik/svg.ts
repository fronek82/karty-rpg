import {
  czyObrys,
  kolorSceny,
  type DefinicjaSymbolu,
  type GlifNaScenie,
  type KolorSymbolu,
  type ElementSceny,
  type Kontur,
  type Obrys,
  type Scena,
} from './scena';
import { liczba } from './liczby';

/**
 * Serializator sceny do SVG. Jednostka użytkownika = 1 mm. Glify zapisane raz w `<defs>`
 * i wstawiane przez `<use>` – tekst nie zależy od czcionek przeglądarki.
 */

export interface OpcjeSvg {
  /** Adres (np. data: lub blob:) obrazu z biblioteki; undefined = obraz pominięty. */
  adresObrazu?: (zasob: string) => string | undefined;
  /**
   * Przedrostek identyfikatorów (glify, przycięcia). Gdy na jednej stronie HTML jest kilka SVG,
   * każdy musi mieć inny – inaczej `<use href="#g0">` wskaże glif z innej karty.
   */
  przedrostekId?: string;
  /** Dodatkowe atrybuty elementu <svg> (np. klasa w UI). */
  atrybuty?: Record<string, string>;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function konturNaD(kontur: Kontur, miejsc = 3): string {
  const n = (v: number) => liczba(v, miejsc);
  return kontur
    .map((k) => {
      switch (k[0]) {
        case 'M':
        case 'L':
          return `${k[0]}${n(k[1])} ${n(k[2])}`;
        case 'C':
          return `C${n(k[1])} ${n(k[2])} ${n(k[3])} ${n(k[4])} ${n(k[5])} ${n(k[6])}`;
        case 'Z':
          return 'Z';
      }
    })
    .join('');
}

function atrybutyObrysu(o: Obrys | undefined): string {
  if (!czyObrys(o)) return '';
  let a = ` stroke="${kolorSceny(o.kolor)}" stroke-width="${liczba(o.grubosc)}"`;
  if (o.kreska) a += ` stroke-dasharray="${o.kreska.map((v) => liczba(v)).join(' ')}"`;
  if (o.kreska && o.fazaKreski) a += ` stroke-dashoffset="${liczba(o.fazaKreski)}"`;
  return a;
}

const wypelnienie = (k: string | undefined) =>
  ` fill="${k === undefined ? 'none' : kolorSceny(k)}"`;

function macierzSvg(m: readonly number[]): string {
  return `matrix(${m.map((v, i) => liczba(v, i < 4 ? 6 : 3)).join(' ')})`;
}

/** Kolor w SVG symbolu: `'kolor'` = `currentColor` (kolor ustawia `<use color>`). */
const kolorWSymbolu = (k: KolorSymbolu) => (k === 'kolor' ? 'currentColor' : kolorSceny(k));

function tresciSymbolu(d: DefinicjaSymbolu): string {
  return d.kontury
    .map((c) => {
      const wyp = c.wypelnienie === undefined ? 'none' : kolorWSymbolu(c.wypelnienie);
      const obrys = c.obrys && c.obrys.grubosc > 0 ? c.obrys : undefined;
      const lin = obrys
        ? ` stroke="${kolorWSymbolu(obrys.kolor)}" stroke-width="${liczba(obrys.grubosc, 3)}" stroke-linejoin="round" stroke-linecap="round"`
        : '';
      const regula = c.evenodd && wyp !== 'none' ? ' fill-rule="evenodd"' : '';
      return `<path d="${konturNaD(c.kontur, 3)}" fill="${wyp}"${regula}${lin}/>`;
    })
    .join('');
}

export function scenaDoSvg(scena: Scena, opcje: OpcjeSvg = {}): string {
  // Identyfikatory glifów: kolejne numery w posortowanej kolejności kluczy – wynik deterministyczny.
  const klucze = Object.keys(scena.glify).sort();
  const px = opcje.przedrostekId ?? '';
  const idGlifu = new Map(klucze.map((k, i) => [k, `${px}g${i}`]));
  const kluczeSymboli = Object.keys(scena.symbole ?? {}).sort();
  const idSymbolu = new Map(kluczeSymboli.map((k, i) => [k, `${px}s${i}`]));
  let licznikPrzyciec = 0;
  const przyciecia: string[] = [];

  const element = (e: ElementSceny): string => {
    switch (e.typ) {
      case 'prostokat': {
        // Promień ograniczony jak w PDF (rogi kołowe, nie eliptyczne).
        const pr = Math.max(0, Math.min(e.promien ?? 0, e.szer / 2, e.wys / 2));
        const r = pr > 0 ? ` rx="${liczba(pr)}" ry="${liczba(pr)}"` : '';
        return `<rect x="${liczba(e.x)}" y="${liczba(e.y)}" width="${liczba(e.szer)}" height="${liczba(e.wys)}"${r}${wypelnienie(e.wypelnienie)}${atrybutyObrysu(e.obrys)}/>`;
      }
      case 'linia':
        return `<line x1="${liczba(e.x1)}" y1="${liczba(e.y1)}" x2="${liczba(e.x2)}" y2="${liczba(e.y2)}"${atrybutyObrysu(e.obrys)}/>`;
      case 'okrag':
        return `<circle cx="${liczba(e.cx)}" cy="${liczba(e.cy)}" r="${liczba(e.r)}"${wypelnienie(e.wypelnienie)}${atrybutyObrysu(e.obrys)}/>`;
      case 'sciezka':
        return `<path d="${konturNaD(e.kontur)}"${wypelnienie(e.wypelnienie)}${e.evenodd && e.wypelnienie !== undefined ? ' fill-rule="evenodd"' : ''}${atrybutyObrysu(e.obrys)}/>`;
      case 'tekst': {
        const transformGlifu = (g: GlifNaScenie) => {
          if (!g.obrot) {
            const sk = liczba(g.skala, 6);
            return `matrix(${sk} 0 0 -${sk} ${liczba(g.x)} ${liczba(g.y)})`;
          }
          const kat = (g.obrot * Math.PI) / 180;
          const a = g.skala * Math.cos(kat);
          const b = g.skala * Math.sin(kat);
          return `matrix(${liczba(a, 6)} ${liczba(b, 6)} ${liczba(b, 6)} ${liczba(-a, 6)} ${liczba(g.x)} ${liczba(g.y)})`;
        };
        const uzycia = (obrys?: { grubosc: number }) =>
          e.glify
            .map((g) => {
              const sw = obrys ? ` stroke-width="${liczba(obrys.grubosc / g.skala, 2)}"` : '';
              return `<use href="#${idGlifu.get(g.klucz)}" transform="${transformGlifu(g)}"${sw}/>`;
            })
            .join('');
        // Obwódka: osobna warstwa pod literami (grubość w jednostkach glifu = mm / skala).
        const obw = e.obwodka && e.obwodka.grubosc > 0 ? e.obwodka : undefined;
        const podklad = obw
          ? `<g fill="${kolorSceny(obw.kolor)}" stroke="${kolorSceny(obw.kolor)}" stroke-linejoin="round">${uzycia(obw)}</g>`
          : '';
        return `${podklad}<g fill="${kolorSceny(e.kolor)}">${uzycia()}</g>`;
      }
      case 'obraz': {
        const adres = opcje.adresObrazu?.(e.zasob);
        if (!adres) return '';
        let clip = '';
        if (e.przyciecie) {
          const id = `${px}p${licznikPrzyciec++}`;
          const p = e.przyciecie;
          przyciecia.push(
            `<clipPath id="${id}"><rect x="${liczba(p.x)}" y="${liczba(p.y)}" width="${liczba(p.szer)}" height="${liczba(p.wys)}"/></clipPath>`,
          );
          clip = ` clip-path="url(#${id})"`;
        }
        const obrot = e.obrot
          ? ` transform="rotate(${liczba(e.obrot)} ${liczba(e.x + e.szer / 2)} ${liczba(e.y + e.wys / 2)})"`
          : '';
        const obraz = `<image href="${esc(adres)}" x="${liczba(e.x)}" y="${liczba(e.y)}" width="${liczba(e.szer)}" height="${liczba(e.wys)}" preserveAspectRatio="none"${obrot}/>`;
        // Przycięcie na grupie: na samym <image> obracałoby się razem z obrazem.
        return clip ? `<g${clip}>${obraz}</g>` : obraz;
      }
      case 'symbol': {
        const id = idSymbolu.get(e.klucz);
        if (!id) return '';
        return `<use href="#${id}" transform="${macierzSvg(e.macierz)}" color="${kolorSceny(e.kolor)}"/>`;
      }
      case 'grupa': {
        if (e.krycie !== undefined && e.krycie <= 0) return '';
        const obrot = e.obrot ? ` rotate(${liczba(e.obrot)})` : '';
        const macierz = e.macierz ? ` ${macierzSvg(e.macierz)}` : '';
        const krycie =
          e.krycie !== undefined && e.krycie < 1 ? ` opacity="${liczba(e.krycie, 4)}"` : '';
        let g = `<g transform="translate(${liczba(e.x)} ${liczba(e.y)})${obrot}${macierz}"${krycie}>${e.elementy.map(element).join('')}</g>`;
        // Przycięcia w układzie otaczającym. Zagnieżdżenie wyznacza część wspólną obu klipów.
        const przytnij = (d: string) => {
          const id = `${px}p${licznikPrzyciec++}`;
          przyciecia.push(`<clipPath id="${id}">${d}</clipPath>`);
          g = `<g clip-path="url(#${id})">${g}</g>`;
        };
        const p = e.przyciecie;
        if (e.przyciecieKonturem) przytnij(`<path d="${konturNaD(e.przyciecieKonturem)}"/>`);
        if (p)
          przytnij(
            `<rect x="${liczba(p.x)}" y="${liczba(p.y)}" width="${liczba(p.szer)}" height="${liczba(p.wys)}"/>`,
          );
        return g;
      }
      case 'wzor': {
        if (!(e.szer > 0 && e.wys > 0)) return '';
        const id = `${px}w${licznikPrzyciec++}`;
        const tresc = e.elementy.map(element).join('');
        // Rysunek wystający poza kafelek: kopie przesunięte o okres (wzór przycina do kafelka).
        const kopie = [-1, 0, 1]
          .flatMap((j) => [-1, 0, 1].map((i) => [i, j] as const))
          .filter(([i, j]) => i || j)
          .map(
            ([i, j]) =>
              `<use href="#${id}t" transform="translate(${liczba(i * e.szer)} ${liczba(j * e.wys)})"/>`,
          )
          .join('');
        przyciecia.push(
          `<pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="0" width="${liczba(e.szer)}" height="${liczba(e.wys)}" patternTransform="${macierzSvg(e.macierz)}"><g id="${id}t">${tresc}</g>${kopie}</pattern>`,
        );
        const o = e.obszar;
        return `<rect x="${liczba(o.x)}" y="${liczba(o.y)}" width="${liczba(o.szer)}" height="${liczba(o.wys)}" fill="url(#${id})"/>`;
      }
    }
  };

  const tresc = scena.elementy.map(element).join('');
  const glify = klucze
    .map((k) => `<path id="${idGlifu.get(k)}" d="${konturNaD(scena.glify[k]!.kontur, 2)}"/>`)
    .join('');
  const symbole = kluczeSymboli
    .map((k) => `<g id="${idSymbolu.get(k)}">${tresciSymbolu(scena.symbole![k]!)}</g>`)
    .join('');
  const dodatkowe = Object.entries(opcje.atrybuty ?? {})
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${liczba(scena.szer)}mm" height="${liczba(scena.wys)}mm" viewBox="0 0 ${liczba(scena.szer)} ${liczba(scena.wys)}"${dodatkowe}>` +
    `<defs>${glify}${symbole}${przyciecia.join('')}</defs>` +
    tresc +
    '</svg>'
  );
}
