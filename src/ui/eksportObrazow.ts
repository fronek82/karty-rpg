import { zipSync } from 'fflate';
import { nazwaKarty } from '../dane/szablon';
import { wSkaliSzarosci, zSzarymiObrazami, type WynikArkusza } from '../druk/arkusz';
import type { Arkusz } from '../model/arkusz';
import type { Karta, Talia } from '../model/szablon';
import { renderujKarte } from '../silnik/karta';
import type { Scena } from '../silnik/scena';
import { scenaDoSvg } from '../silnik/svg';
import { t } from '../i18n';
import { nazwaPliku } from './pliki';
import type { ObrazWPamieci, ZasobyPakietu } from './zasoby';

/**
 * Eksport do obrazów (druk w punkcie fotograficznym): strony kartek albo karty osobno jako JPG/PNG
 * 300 dpi. Rasteryzacja w przeglądarce z tego samego SVG co podgląd (tekst to krzywe); obrazy
 * z biblioteki wstawiane jako `data:` – SVG wczytany do <img> nie pobiera zewnętrznych adresów.
 */

export type FormatObrazu = 'jpg' | 'png';
export const DPI = 300;
/** Jakość JPG (0–1). */
const JAKOSC_JPG = 0.92;

export interface PlikWyjsciowy {
  nazwa: string;
  bajty: Uint8Array;
}

/**
 * Największa liczba pikseli obrazu – bezpieczna dla canvas we wszystkich przeglądarkach
 * (Safari: ok. 16,7 Mpx); większa strona dostaje komunikat zamiast pustego pliku.
 */
export const MAKS_PIKSELI = 16_000_000;

/** Wymiar w pikselach dla wymiaru w mm przy danej rozdzielczości. */
export const piksele = (mm: number, dpi = DPI) => Math.max(1, Math.round((mm / 25.4) * dpi));

function base64(bajty: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bajty.length; i += 0x8000)
    s += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Adresy `data:` obrazów biblioteki (tworzone raz na eksport). */
function adresyDanych(obrazy: Map<string, ObrazWPamieci>) {
  const pamiec = new Map<string, string>();
  return (id: string) => {
    const o = obrazy.get(id);
    if (!o) return undefined;
    let a = pamiec.get(id);
    if (!a) {
      a = `data:image/${o.format === 'jpg' ? 'jpeg' : 'png'};base64,${base64(o.dane)}`;
      pamiec.set(id, a);
    }
    return a;
  };
}

/** SVG → JPG/PNG (piksele z mm przy 300 dpi). JPG na białym tle. */
export async function rasteryzuj(
  svg: string,
  szer: number,
  wys: number,
  format: FormatObrazu,
): Promise<Uint8Array> {
  const w = piksele(szer);
  const h = piksele(wys);
  if (w * h > MAKS_PIKSELI)
    throw new Error(
      t('pobierz.zaDuze', {
        szer: String(Math.round(szer)),
        wys: String(Math.round(wys)),
      }),
    );
  // SVG jako Blob (bez kodowania całego pliku z obrazami base64 w adresie).
  const adres = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image(w, h);
    img.src = adres;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('pobierz.bladRasteryzacji'));
    if (format === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) =>
      canvas.toBlob(ok, format === 'jpg' ? 'image/jpeg' : 'image/png', JAKOSC_JPG),
    );
    if (!blob) throw new Error(t('pobierz.bladRasteryzacji'));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(adres);
  }
}

const nr = (i: number, razem: number) => String(i + 1).padStart(String(razem).length, '0');

/** Sceny do eksportu stron: każda strona każdej kartki (z nazwą pliku). */
export function scenyStron(
  kartki: { arkusz: Arkusz; wynik?: WynikArkusza }[],
  format: FormatObrazu,
): { nazwa: string; scena: Scena; czarnoBialy: boolean }[] {
  const wynik: { nazwa: string; scena: Scena; czarnoBialy: boolean }[] = [];
  for (const k of kartki) {
    const strony = k.wynik?.strony ?? [];
    strony.forEach((scena, i) =>
      wynik.push({
        nazwa: nazwaPliku(
          strony.length > 1 ? `${k.arkusz.nazwa}-${nr(i, strony.length)}` : k.arkusz.nazwa,
          `.${format}`,
        ),
        scena,
        czarnoBialy: !!k.arkusz.ustawienia.czarnoBialy,
      }),
    );
  }
  return unikalneNazwy(wynik);
}

/** Sceny kart osobno: każda karta talii kartki raz (bez powtórzeń między kartkami). */
export function scenyKart(
  kartki: { arkusz: Arkusz; talia: Talia }[],
  zasoby: Pick<ZasobyPakietu, 'czcionki' | 'szablony' | 'obrazy' | 'elementy'>,
  format: FormatObrazu,
): { nazwa: string; scena: Scena; czarnoBialy: boolean }[] {
  const widziane = new Set<string>();
  const karty: { karta: Karta; czarnoBialy: boolean }[] = [];
  for (const k of kartki)
    for (const karta of k.talia.karty)
      if (!widziane.has(karta.id) && zasoby.szablony.has(karta.szablonId)) {
        widziane.add(karta.id);
        karty.push({ karta, czarnoBialy: !!k.arkusz.ustawienia.czarnoBialy });
      }
  return unikalneNazwy(
    karty.map(({ karta, czarnoBialy }, i) => {
      const s = zasoby.szablony.get(karta.szablonId)!;
      const { scena } = renderujKarte(s, karta, {
        czcionki: zasoby.czcionki,
        obraz: (id) => zasoby.obrazy.get(id)?.info,
        ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
      });
      const opis = nazwaKarty(karta.dane, s) || s.nazwa;
      return {
        nazwa: nazwaPliku(`${nr(i, karty.length)}-${opis}`, `.${format}`),
        scena: czarnoBialy ? { ...scena, elementy: wSkaliSzarosci(scena.elementy) } : scena,
        czarnoBialy,
      };
    }),
  );
}

function unikalneNazwy<T extends { nazwa: string }>(lista: T[]): T[] {
  const uzyte = new Set<string>();
  return lista.map((x) => {
    let nazwa = x.nazwa;
    for (let n = 2; uzyte.has(nazwa); n++) nazwa = x.nazwa.replace(/(\.\w+)$/, `-${n}$1`);
    uzyte.add(nazwa);
    return { ...x, nazwa };
  });
}

/** Rasteryzacja listy scen (po kolei – pamięć) z postępem. */
export async function obrazyScen(
  sceny: { nazwa: string; scena: Scena; czarnoBialy: boolean }[],
  obrazy: Map<string, ObrazWPamieci>,
  format: FormatObrazu,
  postep?: (gotowe: number, razem: number) => void,
): Promise<PlikWyjsciowy[]> {
  const adres = adresyDanych(obrazy);
  const pliki: PlikWyjsciowy[] = [];
  for (const [i, s] of sceny.entries()) {
    postep?.(i, sceny.length);
    const scena = s.czarnoBialy ? zSzarymiObrazami(s.scena) : s.scena;
    const svg = scenaDoSvg(scena, { adresObrazu: adres });
    pliki.push({ nazwa: s.nazwa, bajty: await rasteryzuj(svg, scena.szer, scena.wys, format) });
  }
  postep?.(sceny.length, sceny.length);
  return pliki;
}

/** Jeden plik – bez archiwum; kilka – ZIP (obrazy już skompresowane: bez kompresji). */
export function spakuj(
  pliki: PlikWyjsciowy[],
  nazwaZip: string,
): { nazwa: string; bajty: Uint8Array; typ: string } {
  if (pliki.length === 1) {
    const p = pliki[0]!;
    return { ...p, typ: p.nazwa.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  }
  return {
    nazwa: nazwaZip,
    bajty: zipSync(Object.fromEntries(pliki.map((p) => [p.nazwa, p.bajty])), { level: 0 }),
    typ: 'application/zip',
  };
}
