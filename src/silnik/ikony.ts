import type { NazwaIkony } from '../model/szablon';
import type { Kontur } from './scena';

/** Pięcioramienna gwiazdka ★ w kwadracie 1×1 (oś Y w dół), wierzchołek u góry. */
function gwiazdka(): Kontur {
  const kontur: Kontur = [];
  const r = 0.5;
  const rWew = r * 0.382; // proporcja klasycznej gwiazdy pięcioramiennej
  // Środek przesunięty w dół, żeby gwiazdka była optycznie wyśrodkowana w kwadracie.
  const cx = 0.5;
  const cy = 0.5 + (r - r * Math.cos(Math.PI / 5)) / 2;
  for (let i = 0; i < 10; i++) {
    const kat = -Math.PI / 2 + (i * Math.PI) / 5;
    const promien = i % 2 === 0 ? r : rWew;
    const x = Math.round((cx + promien * Math.cos(kat)) * 1e4) / 1e4;
    const y = Math.round((cy + promien * Math.sin(kat)) * 1e4) / 1e4;
    kontur.push(i === 0 ? ['M', x, y] : ['L', x, y]);
  }
  kontur.push(['Z']);
  return kontur;
}

const KAPPA = 0.5522847498;

/** Okrąg jako kontur; `przeciwnie` – odwrotny kierunek (otwór przy wypełnianiu nonzero). */
function okrag(cx: number, cy: number, r: number, przeciwnie = false): Kontur {
  const k = r * KAPPA;
  const z = (v: number) => Math.round(v * 1e4) / 1e4;
  if (!przeciwnie) {
    return [
      ['M', z(cx + r), z(cy)],
      ['C', z(cx + r), z(cy + k), z(cx + k), z(cy + r), z(cx), z(cy + r)],
      ['C', z(cx - k), z(cy + r), z(cx - r), z(cy + k), z(cx - r), z(cy)],
      ['C', z(cx - r), z(cy - k), z(cx - k), z(cy - r), z(cx), z(cy - r)],
      ['C', z(cx + k), z(cy - r), z(cx + r), z(cy - k), z(cx + r), z(cy)],
      ['Z'],
    ];
  }
  return [
    ['M', z(cx + r), z(cy)],
    ['C', z(cx + r), z(cy - k), z(cx + k), z(cy - r), z(cx), z(cy - r)],
    ['C', z(cx - k), z(cy - r), z(cx - r), z(cy - k), z(cx - r), z(cy)],
    ['C', z(cx - r), z(cy + k), z(cx - k), z(cy + r), z(cx), z(cy + r)],
    ['C', z(cx + k), z(cy + r), z(cx + r), z(cy + k), z(cx + r), z(cy)],
    ['Z'],
  ];
}

/** Nożyczki ✂ w kwadracie 1×1: uchwyty z lewej, ostrza skierowane w prawo (własny rysunek). */
function nozyczki(): Kontur {
  const ostrze = (y0: number, y1: number): Kontur => [
    // Od uchwytu, przez oś (0,5; 0,5), do czubka po przeciwnej stronie.
    ['M', 0.3, y0 - 0.045],
    ['L', 1.0, y1],
    ['L', 0.3, y0 + 0.045],
    ['Z'],
  ];
  return [
    ...okrag(0.17, 0.27, 0.16),
    ...okrag(0.17, 0.27, 0.095, true),
    ...okrag(0.17, 0.73, 0.16),
    ...okrag(0.17, 0.73, 0.095, true),
    ...ostrze(0.36, 0.6),
    ...ostrze(0.64, 0.4),
  ];
}

const IKONY: Record<NazwaIkony, Kontur> = { gwiazdka: gwiazdka(), nozyczki: nozyczki() };

/** Kontur ikony przeskalowany do kwadratu o boku `rozmiar` w punkcie (x, y). */
export function konturIkony(nazwa: NazwaIkony, x: number, y: number, rozmiar: number): Kontur {
  return IKONY[nazwa].map((k): Kontur[number] => {
    switch (k[0]) {
      case 'M':
      case 'L':
        return [k[0], x + k[1] * rozmiar, y + k[2] * rozmiar];
      case 'C':
        return [
          'C',
          x + k[1] * rozmiar,
          y + k[2] * rozmiar,
          x + k[3] * rozmiar,
          y + k[4] * rozmiar,
          x + k[5] * rozmiar,
          y + k[6] * rozmiar,
        ];
      case 'Z':
        return ['Z'];
    }
  });
}
