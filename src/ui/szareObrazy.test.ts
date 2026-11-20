import { describe, expect, it } from 'vitest';
import type { Arkusz } from '../model/arkusz';
import { pt } from '../model/jednostki';
import type { Karta, Rewers, Szablon, Talia } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { obrazyCzarnoBialych } from './szareObrazy';

describe('obrazyCzarnoBialych', () => {
  it('uwzględnia teksturę tła i stałe obrazy użyte wyłącznie na rewersie arkusza dwustronnego', () => {
    const czcionki = rejestrTestowy();
    const sz: Szablon = {
      id: 's1',
      nazwa: 'Karta',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#ffffff',
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 't',
            typ: 'tekst',
            klucz: 'nazwa',
            styl: { czcionka: 'tytul', rozmiar: pt(10), kolor: '#000000' },
          },
        ],
      },
    };
    const revZObrazem: Rewers = {
      id: 'rev-img',
      nazwa: 'Rewers z obrazami',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#224466',
      teksturaTla: 'tekstura-tyl',
      korzen: {
        id: 'rk',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'logo-tyl',
            typ: 'obraz',
            zasob: 'emblemat-tyl',
            dopasowanie: 'dopasuj',
            pozycja: { x: 10, y: 10 },
            szerokosc: { mm: 20 },
            wysokosc: { mm: 20 },
          },
        ],
      },
    };
    const k1: Karta = { id: 'k1', szablonId: 's1', ilosc: 1, dane: { nazwa: 'Karta' } };
    const talia: Talia = { id: 't1', nazwa: 'T1', karty: [k1], rewersId: revZObrazem.id };
    const ark: Arkusz = {
      id: 'a1',
      nazwa: 'Arkusz',
      taliaId: 't1',
      ustawienia: {
        papier: 'A4',
        orientacja: 'pionowa',
        marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
        linie: { grubosc: 0.2, kolor: '#888888', kreska: 2, przerwa: 2 },
        czarnoBialy: true,
        dwustronny: { wlaczony: true, krawedz: 'dluga' },
      },
    };
    const zasoby = {
      czcionki,
      szablony: new Map([[sz.id, sz]]),
      obrazy: new Map([
        [
          'tekstura-tyl',
          {
            info: { szerokosc: 100, wysokosc: 100 },
            dane: new Uint8Array(),
            format: 'png' as const,
            adres: 'blob:1',
          },
        ],
        [
          'emblemat-tyl',
          {
            info: { szerokosc: 100, wysokosc: 100 },
            dane: new Uint8Array(),
            format: 'png' as const,
            adres: 'blob:2',
          },
        ],
      ]),
      plikiCzcionek: [],
      role: {},
      elementy: [],
    };
    const wynik = obrazyCzarnoBialych(
      { arkusze: [ark], talie: [talia], rewersy: [revZObrazem] },
      zasoby,
    );
    expect([...wynik].sort()).toEqual(['emblemat-tyl', 'tekstura-tyl']);

    // Gdy druk dwustronny jest wyłączony, obrazy z samego rewersu nie są niepotrzebnie konwertowane.
    const wynikJedno = obrazyCzarnoBialych(
      {
        arkusze: [
          {
            ...ark,
            ustawienia: { ...ark.ustawienia, dwustronny: { wlaczony: false, krawedz: 'dluga' } },
          },
        ],
        talie: [talia],
        rewersy: [revZObrazem],
      },
      zasoby,
    );
    expect([...wynikJedno]).toEqual([]);
  });
});
