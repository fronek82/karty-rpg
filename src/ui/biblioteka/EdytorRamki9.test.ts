import { describe, expect, it } from 'vitest';
import { maksWciecie } from './EdytorRamki9';

describe('maksWciecie', () => {
  const el = { szer: 120, wys: 80 };
  const w = { gora: 10, prawo: 30, dol: 20, lewo: 40 };

  it('strona jest ograniczona do wymiaru minus wcięcie strony przeciwnej – przeciwna nie jest ruszana', () => {
    expect(maksWciecie('lewo', el, w)).toBe(90);
    expect(maksWciecie('prawo', el, w)).toBe(80);
    expect(maksWciecie('gora', el, w)).toBe(60);
    expect(maksWciecie('dol', el, w)).toBe(70);
  });

  it('nie schodzi poniżej zera', () => {
    expect(maksWciecie('lewo', el, { ...w, prawo: 500 })).toBe(0);
  });
});
