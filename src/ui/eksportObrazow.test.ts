import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ustawieniaKartkiDla } from '../dane/wlasneKarty';
import type { Arkusz } from '../model/arkusz';
import type { Talia } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { daneCzaru, szablonCzaru } from '../silnik/__testy__/przyklady';
import type { Scena } from '../silnik/scena';
import { MAKS_PIKSELI, piksele, scenyKart, scenyStron, spakuj } from './eksportObrazow';

const scena = (szer: number, wys: number): Scena => ({ szer, wys, elementy: [], glify: {} });
const arkusz = (nazwa: string, czarnoBialy = false): Arkusz => ({
  id: nazwa,
  nazwa,
  taliaId: 't',
  ustawienia: { ...ustawieniaKartkiDla(szablonCzaru), czarnoBialy },
});

describe('eksport obrazów', () => {
  it('piksele przy 300 dpi; A4 mieści się w limicie przeglądarek', () => {
    expect([piksele(210), piksele(297)]).toEqual([2480, 3508]);
    expect(piksele(210) * piksele(297)).toBeLessThan(MAKS_PIKSELI);
    expect(piksele(1000) * piksele(1000)).toBeGreaterThan(MAKS_PIKSELI);
  });

  it('strony: nazwy z kartki i numeru strony, bez powtórzeń; czarno-białe oznaczone', () => {
    const s = scenyStron(
      [
        { arkusz: arkusz('Kartka 1'), wynik: { strony: [scena(210, 297), scena(210, 297)] } },
        { arkusz: arkusz('Kartka 1', true), wynik: { strony: [scena(210, 297)] } },
        { arkusz: arkusz('Pusta') },
      ] as never,
      'png',
    );
    expect(s.map((x) => [x.nazwa, x.czarnoBialy])).toEqual([
      ['kartka-1-1.png', false],
      ['kartka-1-2.png', false],
      ['kartka-1.png', true],
    ]);
  });

  it('karty osobno: każda karta raz (bez kopii z „Ilość”), nazwa z numeru i nazwy karty', () => {
    const talia: Talia = {
      id: 't',
      nazwa: 't',
      karty: [
        { id: 'a', szablonId: szablonCzaru.id, dane: daneCzaru, ilosc: 3 },
        { id: 'b', szablonId: szablonCzaru.id, dane: { ...daneCzaru, nazwa: 'Tarcza' }, ilosc: 1 },
        { id: 'c', szablonId: 'nie-ma', dane: {}, ilosc: 1 },
      ],
    };
    const k = scenyKart(
      [
        { arkusz: arkusz('A'), talia },
        { arkusz: arkusz('B'), talia },
      ],
      {
        czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
        szablony: new Map([[szablonCzaru.id, szablonCzaru]]),
        obrazy: new Map(),
      },
      'jpg',
    );
    expect(k.map((x) => x.nazwa)).toEqual(['1-ognista-kula.jpg', '2-tarcza.jpg']);
    expect([k[0]!.scena.szer, k[0]!.scena.wys]).toEqual([63, 88]);
  });

  it('jeden plik bez archiwum, kilka – ZIP', () => {
    const p = { nazwa: 'a.png', bajty: new Uint8Array([1, 2]) };
    expect(spakuj([p], 'x.zip')).toEqual({ ...p, typ: 'image/png' });
    const z = spakuj([p, { nazwa: 'b.jpg', bajty: new Uint8Array([3]) }], 'x.zip');
    expect([z.nazwa, z.typ]).toEqual(['x.zip', 'application/zip']);
    expect(Object.keys(unzipSync(z.bajty))).toEqual(['a.png', 'b.jpg']);
  });
});
