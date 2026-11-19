import type { Postrzepienie, Szkic } from '../model/szablon';
import { konturOkregu, konturProstokata } from '../silnik/konturyFigur';
import type { Kontur, ElementSceny } from '../silnik/scena';

type Punkt = { x: number; y: number };
type Obszar = Punkt & { szer: number; wys: number };

function generator(ziarno: number) {
  let stan = ziarno >>> 0;
  return () => {
    stan = (Math.imul(stan, 1664525) + 1013904223) >>> 0;
    return stan / 2 ** 32;
  };
}

function dlugosc(a: Punkt, b: Punkt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function naOdcinku(a: Punkt, b: Punkt, t: number): Punkt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Wcięcia do wewnątrz zostawiają fizyczny format karty i jej narożniki w zadanym obszarze. */
export function konturPostrzepiony(r: Obszar, ustawienia: Postrzepienie): Kontur {
  if (!(ustawienia.sila > 0 && r.szer > 0 && r.wys > 0))
    return konturProstokata(r.x, r.y, r.szer, r.wys);
  const losuj = generator(ustawienia.ziarno);
  const sila = Math.min(ustawienia.sila, r.szer / 5, r.wys / 5);
  const rogi = [
    { x: r.x, y: r.y },
    { x: r.x + r.szer, y: r.y },
    { x: r.x + r.szer, y: r.y + r.wys },
    { x: r.x, y: r.y + r.wys },
  ];
  const wynik: Kontur = [['M', r.x, r.y]];
  rogi.forEach((a, i) => {
    const b = rogi[(i + 1) % rogi.length]!;
    const d = dlugosc(a, b);
    const ile = Math.min(128, Math.max(2, Math.ceil(d / Math.max(0.5, ustawienia.ziarnistosc))));
    const nx = (a.y - b.y) / d;
    const ny = (b.x - a.x) / d;
    for (let n = 1; n < ile; n++) {
      const f = (n + (losuj() - 0.5) * 0.65) / ile;
      const p = naOdcinku(a, b, f);
      const wciecie = Math.min(sila, 0.45 * Math.min(f, 1 - f) * d) * losuj();
      wynik.push(['L', p.x + nx * wciecie, p.y + ny * wciecie]);
    }
    wynik.push(['L', b.x, b.y]);
  });
  wynik.push(['Z']);
  return wynik;
}

function szkicujKontur(kontur: Kontur, ustawienia: Szkic): Kontur {
  const losuj = generator(ustawienia.ziarno);
  const wynik: Kontur = [];
  let poczatek: Punkt = { x: 0, y: 0 };
  let p = poczatek;
  for (const k of kontur) {
    if (k[0] === 'M') {
      poczatek = p = { x: k[1], y: k[2] };
      wynik.push(k);
      continue;
    }
    const koniec =
      k[0] === 'Z' ? poczatek : k[0] === 'L' ? { x: k[1], y: k[2] } : { x: k[5], y: k[6] };
    const a = p;
    const krzywa = (t: number) => {
      if (k[0] !== 'C') return naOdcinku(a, koniec, t);
      const l = naOdcinku(a, { x: k[1], y: k[2] }, t);
      const m = naOdcinku({ x: k[1], y: k[2] }, { x: k[3], y: k[4] }, t);
      const r = naOdcinku({ x: k[3], y: k[4] }, koniec, t);
      return naOdcinku(naOdcinku(l, m, t), naOdcinku(m, r, t), t);
    };
    const d = dlugosc(p, koniec);
    const n = Math.min(48, Math.max(k[0] === 'C' ? 8 : 1, Math.ceil(d / 2.5)));
    const sila = Math.min(ustawienia.sila, d / 5);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const s = krzywa(f);
      const przed = krzywa(f - 0.001);
      const po = krzywa(f + 0.001);
      const dT = dlugosc(przed, po);
      const z = dT ? ((losuj() - 0.5) * 2 * sila) / dT : 0;
      wynik.push(['L', s.x + (przed.y - po.y) * z, s.y + (po.x - przed.x) * z]);
    }
    wynik.push(k[0] === 'Z' ? ['Z'] : ['L', koniec.x, koniec.y]);
    p = koniec;
  }
  return wynik;
}

export function szkicujElementy(
  elementy: ElementSceny[],
  szkic: Szkic | undefined,
): ElementSceny[] {
  if (!szkic || szkic.sila <= 0) return elementy;
  return elementy.map((e) => {
    if (!('obrys' in e) || !e.obrys) return e;
    const kontur: Kontur =
      e.typ === 'sciezka'
        ? e.kontur
        : e.typ === 'prostokat'
          ? konturProstokata(e.x, e.y, e.szer, e.wys, e.promien)
          : e.typ === 'okrag'
            ? konturOkregu(e.cx, e.cy, e.r)
            : [
                ['M', e.x1, e.y1],
                ['L', e.x2, e.y2],
              ];
    return { ...e, typ: 'sciezka', kontur: szkicujKontur(kontur, szkic) };
  });
}
