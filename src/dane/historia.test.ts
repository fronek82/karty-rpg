import { describe, expect, it } from 'vitest';
import { cofnij, LIMIT_HISTORII, ponow, pustaHistoria, zapamietaj } from './historia';

describe('historia zmian', () => {
  it('cofnij i ponów; nowa zmiana czyści przyszłość', () => {
    let h = zapamietaj(pustaHistoria<number>(), 1);
    h = zapamietaj(h, 2);
    const c = cofnij(h, 3)!;
    expect(c.stan).toBe(2);
    const p = ponow(c.historia, 2)!;
    expect(p.stan).toBe(3);
    const n = zapamietaj(c.historia, 2);
    expect(ponow(n, 9)).toBeUndefined();
    expect(cofnij(pustaHistoria<number>(), 1)).toBeUndefined();
  });

  it('seria zmian z tym samym kluczem w krótkim czasie to jeden krok', () => {
    let h = zapamietaj(pustaHistoria<string>(), 'M', { klucz: 'nazwa', czas: 0 });
    h = zapamietaj(h, 'Mi', { klucz: 'nazwa', czas: 500 });
    h = zapamietaj(h, 'Mie', { klucz: 'nazwa', czas: 1000 });
    expect(h.przeszle).toEqual(['M']);
    h = zapamietaj(h, 'Miecz', { klucz: 'nazwa', czas: 5000 }); // po przerwie – nowy krok
    h = zapamietaj(h, 'Miecz!', { klucz: 'wartosc', czas: 5100 }); // inne pole – nowy krok
    expect(h.przeszle).toEqual(['M', 'Miecz', 'Miecz!']);
  });

  it('limit długości historii', () => {
    let h = pustaHistoria<number>();
    for (let i = 0; i < LIMIT_HISTORII + 20; i++) h = zapamietaj(h, i);
    expect(h.przeszle).toHaveLength(LIMIT_HISTORII);
    expect(h.przeszle[0]).toBe(20);
  });
});
