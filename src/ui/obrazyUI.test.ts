import { describe, expect, it } from 'vitest';
import { wspolczynnikSkali } from './obrazyUI';

describe('limit powierzchni obrazu', () => {
  it('obraz w limicie zostaje, zbyt duży (PNG / JPEG bez EXIF też) jest zmniejszany do limitu', () => {
    expect(wspolczynnikSkali(4000, 3000)).toBe(1);
    const k = wspolczynnikSkali(8000, 6000);
    expect(k).toBeLessThan(1);
    expect(Math.round(8000 * k) * Math.round(6000 * k)).toBeLessThanOrEqual(16_000_000 * 1.001);
    expect(wspolczynnikSkali(100, 100, 2500)).toBe(0.5);
  });
});
