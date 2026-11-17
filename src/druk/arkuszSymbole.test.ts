import { describe, expect, it } from 'vitest';
import type { Arkusz } from '../model/arkusz';
import type { Szablon, Talia } from '../model/szablon';
import { ustawieniaKartkiDla } from '../dane/wlasneKarty';
import { daneCzaru, szablonCzaru } from '../silnik/__testy__/przyklady';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import type { DefinicjaSymbolu, ElementSceny } from '../silnik/scena';
import { symbolZElementu, znajdzElement } from '../ozdobniki';
import { symboleWSzarosci, wSkaliSzarosci, zbudujArkusz } from './arkusz';

const ozdobny: Szablon = {
  ...szablonCzaru,
  id: 'ozd',
  ramka: { grubosc: 0.3, kolor: '#ff0000', narozniki: { element: 'wb:lisc', rozmiar: 6 } },
};
const zwykly: Szablon = { ...szablonCzaru, id: 'zw' };
const ctx = {
  czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
  szablony: new Map([ozdobny, zwykly].map((s) => [s.id, s])),
};
const talia = (...ids: string[]): Talia => ({
  id: 't',
  nazwa: 't',
  karty: ids.map((id) => ({ id, szablonId: id, dane: daneCzaru, ilosc: 2 })),
});
const arkusz = (zmiana: Partial<Arkusz['ustawienia']> = {}): Arkusz => ({
  id: 'a',
  nazwa: 'a',
  taliaId: 't',
  ustawienia: { ...ustawieniaKartkiDla(ozdobny), tytul: undefined, ...zmiana },
});

const symbole = (e: ElementSceny[]): Extract<ElementSceny, { typ: 'symbol' }>[] =>
  e.flatMap((x) => (x.typ === 'grupa' ? symbole(x.elementy) : x.typ === 'symbol' ? [x] : []));

describe('symbole w arkuszu', () => {
  for (const tryb of ['jeden', 'mieszane'] as const) {
    it(`${tryb}: słowniki symboli kart scalone, rysunek raz`, () => {
      const w = zbudujArkusz(arkusz({ rozmiary: tryb }), talia('ozd', 'zw'), ctx);
      const s = w.strony[0]!;
      expect(Object.keys(s.symbole ?? {})).toEqual(['wb:lisc']);
      // 2 karty z ozdobą × 4 rogi.
      expect(symbole(s.elementy)).toHaveLength(8);
    });

    it(`${tryb}: scena bez symboli nie ma pola symbole`, () => {
      const w = zbudujArkusz(arkusz({ rozmiary: tryb }), talia('zw'), ctx);
      expect('symbole' in w.strony[0]!).toBe(false);
    });

    it(`${tryb}: czarno-biały szarzy kolor wstawienia i stałe kolory definicji`, () => {
      const w = zbudujArkusz(arkusz({ rozmiary: tryb, czarnoBialy: true }), talia('ozd'), ctx);
      expect(symbole(w.strony[0]!.elementy).every((e) => e.kolor === '#4c4c4c')).toBe(true);
    });
  }
});

describe('szarość symboli', () => {
  it('wSkaliSzarosci: kolor elementu symbol; bez koloru bez zmian', () => {
    const m: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
    const [a, b] = wSkaliSzarosci([
      { typ: 'symbol', klucz: 'x', macierz: m, kolor: '#ff0000' },
      { typ: 'symbol', klucz: 'x', macierz: m },
    ]);
    expect(a).toMatchObject({ kolor: '#4c4c4c' });
    expect(b).not.toHaveProperty('kolor');
  });

  it('symboleWSzarosci: stałe kolory szarzone, „kolor” zostaje', () => {
    const d: DefinicjaSymbolu = {
      szer: 1,
      wys: 1,
      kontury: [
        { kontur: [], wypelnienie: '#ff0000' },
        { kontur: [], wypelnienie: 'kolor', obrys: { grubosc: 1, kolor: '#00ff00' } },
        { kontur: [], obrys: { grubosc: 1, kolor: 'kolor' } },
      ],
    };
    const w = symboleWSzarosci({ d })!.d!;
    expect(w.kontury[0]!.wypelnienie).toBe('#4c4c4c');
    expect(w.kontury[1]).toMatchObject({ wypelnienie: 'kolor', obrys: { kolor: '#969696' } });
    expect(w.kontury[2]!.obrys!.kolor).toBe('kolor');
    expect(symboleWSzarosci(undefined)).toBeUndefined();
    // Wbudowane rysunki mają tylko kolor „kolor” – bez zmian.
    const wb = symbolZElementu(znajdzElement('wb:kat')!);
    expect(symboleWSzarosci({ k: wb })!.k).toEqual(wb);
  });
});
