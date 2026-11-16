import type { ElementSceny, Kontur, Obrys, Scena } from './scena';
import { liczba } from './liczby';

/**
 * Serializator sceny do SVG. Jednostka użytkownika = 1 mm. Glify zapisane raz w `<defs>`
 * i wstawiane przez `<use>` – tekst nie zależy od czcionek przeglądarki.
 */

export interface OpcjeSvg {
  /** Adres (np. data: lub blob:) obrazu z biblioteki; undefined = obraz pominięty. */
  adresObrazu?: (zasob: string) => string | undefined;
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
  if (!o) return '';
  let a = ` stroke="${o.kolor}" stroke-width="${liczba(o.grubosc)}"`;
  if (o.kreska) a += ` stroke-dasharray="${o.kreska.map((v) => liczba(v)).join(' ')}"`;
  return a;
}

const wypelnienie = (k: string | undefined) => ` fill="${k ?? 'none'}"`;

export function scenaDoSvg(scena: Scena, opcje: OpcjeSvg = {}): string {
  // Identyfikatory glifów: kolejne numery w posortowanej kolejności kluczy – wynik deterministyczny.
  const klucze = Object.keys(scena.glify).sort();
  const idGlifu = new Map(klucze.map((k, i) => [k, `g${i}`]));
  let licznikPrzyciec = 0;
  const przyciecia: string[] = [];

  const element = (e: ElementSceny): string => {
    switch (e.typ) {
      case 'prostokat': {
        const r = e.promien ? ` rx="${liczba(e.promien)}"` : '';
        return `<rect x="${liczba(e.x)}" y="${liczba(e.y)}" width="${liczba(e.szer)}" height="${liczba(e.wys)}"${r}${wypelnienie(e.wypelnienie)}${atrybutyObrysu(e.obrys)}/>`;
      }
      case 'linia':
        return `<line x1="${liczba(e.x1)}" y1="${liczba(e.y1)}" x2="${liczba(e.x2)}" y2="${liczba(e.y2)}"${atrybutyObrysu(e.obrys)}/>`;
      case 'okrag':
        return `<circle cx="${liczba(e.cx)}" cy="${liczba(e.cy)}" r="${liczba(e.r)}"${wypelnienie(e.wypelnienie)}${atrybutyObrysu(e.obrys)}/>`;
      case 'sciezka':
        return `<path d="${konturNaD(e.kontur)}"${wypelnienie(e.wypelnienie)}${atrybutyObrysu(e.obrys)}/>`;
      case 'tekst':
        return (
          `<g fill="${e.kolor}">` +
          e.glify
            .map((g) => {
              const s = liczba(g.skala, 6);
              return `<use href="#${idGlifu.get(g.klucz)}" transform="matrix(${s} 0 0 -${s} ${liczba(g.x)} ${liczba(g.y)})"/>`;
            })
            .join('') +
          '</g>'
        );
      case 'obraz': {
        const adres = opcje.adresObrazu?.(e.zasob);
        if (!adres) return '';
        let clip = '';
        if (e.przyciecie) {
          const id = `p${licznikPrzyciec++}`;
          const p = e.przyciecie;
          przyciecia.push(
            `<clipPath id="${id}"><rect x="${liczba(p.x)}" y="${liczba(p.y)}" width="${liczba(p.szer)}" height="${liczba(p.wys)}"/></clipPath>`,
          );
          clip = ` clip-path="url(#${id})"`;
        }
        return `<image href="${esc(adres)}" x="${liczba(e.x)}" y="${liczba(e.y)}" width="${liczba(e.szer)}" height="${liczba(e.wys)}" preserveAspectRatio="none"${clip}/>`;
      }
      case 'grupa': {
        const obrot = e.obrot ? ` rotate(${liczba(e.obrot)})` : '';
        return `<g transform="translate(${liczba(e.x)} ${liczba(e.y)})${obrot}">${e.elementy.map(element).join('')}</g>`;
      }
    }
  };

  const tresc = scena.elementy.map(element).join('');
  const glify = klucze
    .map((k) => `<path id="${idGlifu.get(k)}" d="${konturNaD(scena.glify[k]!.kontur, 2)}"/>`)
    .join('');
  const dodatkowe = Object.entries(opcje.atrybuty ?? {})
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${liczba(scena.szer)}mm" height="${liczba(scena.wys)}mm" viewBox="0 0 ${liczba(scena.szer)} ${liczba(scena.wys)}"${dodatkowe}>` +
    `<defs>${glify}${przyciecia.join('')}</defs>` +
    tresc +
    '</svg>'
  );
}
