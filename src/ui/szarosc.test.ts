import { describe, expect, it } from 'vitest';
import { pikseleNaSzarosc } from './szarosc';

describe('pikseleNaSzarosc', () => {
  it('luminancja jak dla kolorów wektorowych, kanał alfa bez zmian', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 128, 0, 255, 0, 255, 10, 20, 30, 0]);
    pikseleNaSzarosc(px);
    expect([...px]).toEqual([76, 76, 76, 128, 150, 150, 150, 255, 18, 18, 18, 0]);
  });
});
