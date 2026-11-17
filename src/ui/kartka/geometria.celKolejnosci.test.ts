import { describe, expect, it } from 'vitest';
import { celKolejnosci } from './geometria';

const karta = (kartaId: string, strona: number, x: number, y = 0, szer = 40, wys = 60) => ({
  klucz: `${kartaId}#${x}`,
  kartaId,
  numer: 0,
  strona,
  x,
  y,
  szer,
  wys,
  obrocona: false,
  pas: 0,
  karta: { id: kartaId, szablonId: 's', dane: {}, ilosc: 1 },
});
const obszar = { x: 10, y: 10, szer: 190, wys: 277 };

describe('celKolejnosci – wskaźnik wstawienia', () => {
  const m = {
    obszar,
    karty: [karta('a', 0, 10), karta('b', 0, 50), karta('c', 0, 90)],
  };
  it('lewa połowa karty – przed nią, prawa – przed następną', () => {
    expect(celKolejnosci(m, [], 0, { x: 55, y: 20 })).toMatchObject({ przedId: 'b', x: 50 });
    expect(celKolejnosci(m, [], 0, { x: 85, y: 20 })).toMatchObject({ przedId: 'c', x: 90 });
  });
  it('prawa połowa ostatniej karty – na końcu listy', () => {
    const c = celKolejnosci(m, [], 0, { x: 125, y: 20 });
    expect(c.przedId).toBeUndefined();
    expect(c.x).toBe(130);
  });
  it('przenoszone karty nie są celem (pomijane także jako „następna”)', () => {
    const c = celKolejnosci(m, ['c'], 0, { x: 85, y: 20 });
    expect(c.przedId).toBeUndefined();
    expect(celKolejnosci(m, ['b'], 0, { x: 75, y: 20 }).przedId).toBe('c');
  });
  it('strona bez kart: początek obszaru, przed pierwszą kartą z dalszych stron', () => {
    const m2 = { obszar, karty: [karta('a', 1, 10)] };
    expect(celKolejnosci(m2, [], 0, { x: 50, y: 50 })).toMatchObject({
      przedId: 'a',
      strona: 0,
      x: 10,
      y: 10,
    });
    expect(celKolejnosci({ obszar, karty: [] }, [], 0, { x: 50, y: 50 }).przedId).toBeUndefined();
  });
  it('karta z ilością > 1: „przed” przy pierwszym egzemplarzu, „za” przy ostatnim', () => {
    const w = {
      obszar,
      karty: [karta('a', 0, 10), karta('b', 0, 50), karta('b', 0, 90), karta('c', 0, 130)],
    };
    // Lewa połowa drugiego egzemplarza b – wskaźnik przed pierwszym egzemplarzem.
    expect(celKolejnosci(w, [], 0, { x: 95, y: 20 })).toMatchObject({ przedId: 'b', x: 50 });
    // Prawa połowa pierwszego egzemplarza b – wskaźnik za ostatnim.
    expect(celKolejnosci(w, [], 0, { x: 85, y: 20 })).toMatchObject({ przedId: 'c', x: 130 });
  });
});
