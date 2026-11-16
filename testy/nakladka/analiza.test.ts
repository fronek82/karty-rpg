import { describe, expect, it } from 'vitest';
import { dopasuj, dopasujLinie, znajdzLinie } from './analiza';

const PX = 10;
/** Profil 300 mm: cienkie linie (3 px) w podanych miejscach + opcjonalne szerokie paski. */
function profil(linie: number[], paski: [number, number][] = [], sila = 100) {
  const p = new Float64Array(300 * PX);
  for (const mm of linie) for (let d = -1; d <= 1; d++) p[Math.round(mm * PX) + d] = sila;
  for (const [od, do_] of paski) for (let i = od * PX; i < do_ * PX; i++) p[i] = sila * 2;
  return p;
}

describe('analiza nakładki', () => {
  it('znajdzLinie: położenie z dokładnością poniżej piksela; brak linii → undefined', () => {
    const p = profil([50]);
    expect(znajdzLinie(p, PX, 51, 3, 10)).toBeCloseTo(50.05, 1);
    expect(znajdzLinie(p, PX, 100, 3, 10)).toBeUndefined();
    expect(znajdzLinie(new Float64Array(3000), PX, 50, 3, 0)).toBeUndefined();
  });

  it('znajdzLinie: szeroki ciemny pasek obok linii nie wygrywa', () => {
    const p = profil([50], [[51, 53]]);
    expect(znajdzLinie(p, PX, 51, 3, 10)).toBeCloseTo(50.05, 1);
  });

  it('dopasuj: dokładna skala i przesunięcie, reszty ~0', () => {
    const nasze = [10, 35.75, 61.5, 87.25];
    const d = dopasuj(
      nasze,
      nasze.map((p) => 0.9989 * p + 0.4),
    );
    expect(d.a).toBeCloseTo(0.9989, 6);
    expect(d.b).toBeCloseTo(0.4, 6);
    expect(d.maksReszta).toBeLessThan(1e-9);
  });

  it('dopasujLinie: drugi przebieg poprawia pomyłkę pierwszego (sąsiednia linia w oknie)', () => {
    const nasze = [20, 45.75, 71.5, 97.25, 123];
    const ref = nasze.map((p) => p + 0.5);
    // Fałszywa, mocniejsza cienka linia 2 mm od jednej z prawdziwych.
    const p = profil(ref);
    for (let d = -1; d <= 1; d++) p[Math.round(73.5 * PX) + d] = 300;
    const d = dopasujLinie(p, PX, nasze, 10);
    expect(d.b).toBeCloseTo(0.55, 1);
    expect(d.maksReszta).toBeLessThan(0.1);
    expect(d.brakujace).toEqual([]);
  });

  it('dopasujLinie: za mało linii → jawny błąd', () => {
    expect(() => dopasujLinie(profil([]), PX, [10], 1)).toThrow(/Za mało linii/);
  });
});
