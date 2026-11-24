import { describe, expect, it } from 'vitest';
import { kolejnePowiekszenie, MAX_POWIEKSZENIA, MIN_POWIEKSZENIA } from './powiekszenie';

describe('kolejnePowiekszenie', () => {
  it('przechodzi po stopniach w obie strony', () => {
    expect(kolejnePowiekszenie(1, 1)).toBe(1.25);
    expect(kolejnePowiekszenie(1, -1)).toBe(0.75);
    expect(kolejnePowiekszenie(1.1, 1)).toBe(1.25);
    expect(kolejnePowiekszenie(1.1, -1)).toBe(1);
  });
  it('zatrzymuje się na krańcach', () => {
    expect(kolejnePowiekszenie(MAX_POWIEKSZENIA, 1)).toBe(MAX_POWIEKSZENIA);
    expect(kolejnePowiekszenie(MIN_POWIEKSZENIA, -1)).toBe(MIN_POWIEKSZENIA);
  });
});
