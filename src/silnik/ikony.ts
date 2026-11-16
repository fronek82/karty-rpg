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

const IKONY: Record<NazwaIkony, Kontur> = { gwiazdka: gwiazdka() };

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
