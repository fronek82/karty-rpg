import { describe, expect, it } from 'vitest';
import { nazwaPliku } from './pliki';

describe('nazwaPliku', () => {
  it('polskie znaki, spacje i znaki specjalne → bezpieczna nazwa', () => {
    expect(nazwaPliku('Karty broni i pancerzy', '.pdf')).toBe('karty-broni-i-pancerzy.pdf');
    expect(nazwaPliku('Łódź – żółć / stany?', '.pdf')).toBe('lodz-zolc-stany.pdf');
    expect(nazwaPliku('   ', '.pdf')).toBe('projekt.pdf');
  });
});
