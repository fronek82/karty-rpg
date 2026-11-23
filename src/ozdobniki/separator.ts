import type { Mm } from '../model/jednostki';
import type { Kolor, PoleSeparator } from '../model/szablon';
import type { DefinicjaSymbolu, ElementSceny, Macierz, Obrys } from '../silnik/scena';
import { znajdzElement } from './katalog';
import { rozlozKafelki } from './motyw';
import { symbolZElementu } from './narozniki';
import type { ElementOzdobny } from './typy';

/** Domyślny odstęp linii od zakończeń i środka (mm). */
export const ODSTEP_OZDOBY_DOMYSLNY: Mm = 0.4;

type Ramka = { x: Mm; y: Mm; szer: Mm; wys: Mm };

export interface WynikSeparatora {
  elementy: ElementSceny[];
  /** Użyte rysunki (do słownika symboli sceny). */
  symbole: Record<string, DefinicjaSymbolu>;
  /** Identyfikatory nieznanych lub niepasujących elementów – ostrzeżenie `nieznany-element-ozdobny`. */
  nieznane: string[];
}

/** Element biblioteki danego rodzaju albo `undefined`. */
function element(
  id: string | undefined,
  rodzaj: ElementOzdobny['rodzaj'],
  wlasne?: readonly ElementOzdobny[],
) {
  const e = id ? znajdzElement(id, wlasne) : undefined;
  return e && e.rodzaj === rodzaj ? e : undefined;
}

/**
 * Wysokość ozdób w poprzek separatora (mm): największa z zakończeń, środka i pasa motywu
 * (tylko elementy znane). Silnik układu bierze `max(ta, grubość linii)` jako rozmiar separatora.
 */
export function wysokoscOzdobySeparatora(
  pole: PoleSeparator,
  wlasne?: readonly ElementOzdobny[],
): Mm {
  const r: Mm[] = [0];
  if (element(pole.zakonczenia?.element, 'zakonczenie', wlasne)) r.push(pole.zakonczenia!.rozmiar);
  if (element(pole.srodek?.element, 'srodek', wlasne)) r.push(pole.srodek!.rozmiar);
  if (
    pole.rysunek &&
    pole.rysunek !== 'linia' &&
    element(pole.rysunek.motyw, 'motyw', wlasne) &&
    pole.rysunek.szerokosc > 0
  )
    r.push(pole.rysunek.szerokosc);
  return Math.max(...r.filter((v) => Number.isFinite(v) && v > 0), 0);
}

/** Długość rysunku wzdłuż separatora w dostępnym miejscu: mm albo % (przycięta do miejsca). */
export function dlugoscSeparatora(pole: PoleSeparator, dostepna: Mm): Mm {
  const d = pole.dlugosc;
  if (!d) return dostepna;
  const v = 'mm' in d ? d.mm : (dostepna * d.procent) / 100;
  return Math.max(0, Math.min(dostepna, v));
}

/**
 * Separator ozdobny w `ramka`: oś wzdłuż separatora to `u` (od początku rysunku), w poprzek `v`
 * (od osi linii). Poziomy: `x = u`, `y = v`; pionowy: `x = −v`, `y = u` (rysunek obrócony o 90° zgodnie z zegarem).
 * Zakończenie lewe (górne), jego odbicie prawe (dolne), środek na środku długości z przerwą
 * w linii; motyw zamiast linii rozkładany równo na każdym odcinku (jak bok ramki).
 *
 * `obrys` – styl linii (undefined = brak linii), `odsuniecia` – osie linii w poprzek (podwójna).
 */
export function rysujSeparatorOzdobny(
  pole: PoleSeparator,
  ramka: Ramka,
  linia: { obrys: Obrys | undefined; odsuniecia: Mm[] },
  kolor: Kolor,
  wlasne?: readonly ElementOzdobny[],
): WynikSeparatora {
  const poziomy = pole.kierunek === 'poziomy';
  const dostepna = poziomy ? ramka.szer : ramka.wys;
  const srodekPoprzek = poziomy ? ramka.y + ramka.wys / 2 : ramka.x + ramka.szer / 2;
  const pocz = poziomy ? ramka.x : ramka.y;
  const dl = dlugoscSeparatora(pole, dostepna);
  const u0 = pocz + (dostepna - dl) / 2;
  const elementy: ElementSceny[] = [];
  const symbole: Record<string, DefinicjaSymbolu> = {};
  const nieznane: string[] = [];
  const odstep = Math.max(0, pole.odstepOdOzdoby ?? ODSTEP_OZDOBY_DOMYSLNY);

  const znajdz = (id: string | undefined, rodzaj: ElementOzdobny['rodzaj']) => {
    if (!id) return undefined;
    const e = element(id, rodzaj, wlasne);
    if (!e && !nieznane.includes(id)) nieznane.push(id);
    return e;
  };

  // Macierz symbolu: rysunek (px, py) → u = ou + sx·px, v = ov + sy·py.
  // Pionowy: obrót o 90° zgodnie z ruchem wskazówek zegara (x = środek − v, y = u).
  const macierz = (ou: Mm, sx: number, ov: Mm, sy: number): Macierz =>
    poziomy ? [sx, 0, 0, sy, ou, srodekPoprzek + ov] : [0, sx, -sy, 0, srodekPoprzek - ov, ou];
  const symbol = (e: ElementOzdobny, m: Macierz) => {
    symbole[e.id] = symbolZElementu(e);
    elementy.push({ typ: 'symbol', klucz: e.id, macierz: m, kolor });
  };

  const zak = znajdz(pole.zakonczenia?.element, 'zakonczenie');
  let wz = 0;
  if (zak && pole.zakonczenia!.rozmiar > 0) {
    wz = (pole.zakonczenia!.rozmiar * zak.szer) / zak.wys;
    if (2 * wz > dl) wz = 0;
  }
  const rz = pole.zakonczenia?.rozmiar ?? 0;
  const sr = znajdz(pole.srodek?.element, 'srodek');
  let ws = 0;
  if (sr && pole.srodek!.rozmiar > 0) {
    ws = (pole.srodek!.rozmiar * sr.szer) / sr.wys;
    // Środek wraz z odstępami po obu stronach (i odstępami przy zakończeniach) musi się zmieścić.
    const odstepy = 2 * odstep + (wz > 0 ? 2 * odstep : 0);
    if (dl - 2 * wz - odstepy < ws) ws = 0;
  }

  const od = wz > 0 ? u0 + wz + odstep : u0;
  const doo = wz > 0 ? u0 + dl - wz - odstep : u0 + dl;
  const mid = u0 + dl / 2;
  const odcinki: [Mm, Mm][] =
    ws > 0
      ? [
          [od, mid - ws / 2 - odstep],
          [mid + ws / 2 + odstep, doo],
        ]
      : [[od, doo]];

  const r = pole.rysunek && pole.rysunek !== 'linia' ? pole.rysunek : undefined;
  const motyw = r ? znajdz(r.motyw, 'motyw') : undefined;
  for (const [a, b] of odcinki) {
    const d = b - a;
    if (!(d > 1e-9)) continue;
    if (motyw && r && r.szerokosc > 0) {
      const { n, krok } = rozlozKafelki(d, r.szerokosc, motyw);
      for (let i = 0; i < n; i++)
        symbol(
          motyw,
          macierz(a + i * krok, krok / motyw.szer, -r.szerokosc / 2, r.szerokosc / motyw.wys),
        );
    } else if (linia.obrys) {
      for (const v of linia.odsuniecia) {
        const c = srodekPoprzek + (poziomy ? v : -v);
        elementy.push(
          poziomy
            ? { typ: 'linia', x1: a, y1: c, x2: b, y2: c, obrys: linia.obrys }
            : { typ: 'linia', x1: c, y1: a, x2: c, y2: b, obrys: linia.obrys },
        );
      }
    }
  }

  if (zak && wz > 0) {
    const sy = rz / zak.wys;
    const sx = wz / zak.szer;
    symbol(zak, macierz(u0, sx, -rz / 2, sy));
    symbol(zak, macierz(u0 + dl, -sx, -rz / 2, sy));
  }
  if (sr && ws > 0) {
    const rs = pole.srodek!.rozmiar;
    symbol(sr, macierz(mid - ws / 2, ws / sr.szer, -rs / 2, rs / sr.wys));
  }
  return { elementy, symbole, nieznane };
}
