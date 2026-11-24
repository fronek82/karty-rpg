import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import {
  LIMIT_KOLOROW_UZYTYCH,
  MAKS_KOLOROW_PALETY,
  dodajDoPalety,
  koloryUzyte,
  normalizujKolor,
  usunZPalety,
} from './koloryProjektu';
import { migruj, przygotujProjekt } from './schemat';

const projekt = (zmiany: Partial<Projekt> = {}): Projekt => ({
  wersja: WERSJA_SCHEMATU,
  id: 'p',
  nazwa: 'P',
  utworzono: '2026-01-01T00:00:00.000Z',
  zmieniono: '2026-01-01T00:00:00.000Z',
  role: {},
  zasoby: [],
  szablony: [],
  talie: [],
  arkusze: [],
  ...zmiany,
});

describe('normalizujKolor', () => {
  it('sprowadza #rgb i wielkie litery do #rrggbb, odrzuca inne zapisy', () => {
    expect(normalizujKolor('#ABC')).toBe('#aabbcc');
    expect(normalizujKolor('#7D2240')).toBe('#7d2240');
    expect(normalizujKolor('#7d224080')).toBeUndefined();
    expect(normalizujKolor('red')).toBeUndefined();
    expect(normalizujKolor('#12')).toBeUndefined();
  });
});

describe('koloryUzyte', () => {
  it('zbiera kolory przodów i tyłów od najczęstszego, bez tekstów przykładowych', () => {
    const p = {
      szablony: [
        {
          tlo: '#111111',
          korzen: { dzieci: [{ styl: { kolor: '#222222' } }, { styl: { kolor: '#222222' } }] },
          przyklad: { opis: '#999999' },
          parametry: [{ wartosc: '#888888' }],
        },
      ],
      rewersy: [
        {
          tlo: '#222222',
          ramka: { kolor: '#333333' },
          tloZDanych: { klucz: 'typ', domyslny: '#ABC', mapa: [{ wartosc: '#1', kolor: '#444' }] },
          nazwa: '#123',
          korzen: { dzieci: [{ tekst: '#fed' }] },
        },
      ],
    } as unknown as Pick<Projekt, 'szablony' | 'rewersy'>;
    // Teksty wyglądające jak kolor (`nazwa`, `tekst`, wartość reguły) nie są kolorami.
    expect(koloryUzyte(p)).toEqual(['#222222', '#111111', '#333333', '#aabbcc', '#444444']);
  });

  it('ma limit długości listy', () => {
    const szablony = Array.from({ length: LIMIT_KOLOROW_UZYTYCH + 5 }, (_, i) => ({
      tlo: `#${i.toString(16).padStart(6, '0')}`,
    })) as unknown as Projekt['szablony'];
    expect(koloryUzyte({ szablony })).toHaveLength(LIMIT_KOLOROW_UZYTYCH);
  });
});

describe('paleta projektu', () => {
  it('dodaje bez powtórzeń i usuwa; pusta paleta znika', () => {
    let p = dodajDoPalety(projekt(), '#7D2240');
    expect(p.paleta).toEqual(['#7d2240']);
    expect(dodajDoPalety(p, '#7d2240')).toBe(p);
    p = dodajDoPalety(p, '#fff');
    expect(p.paleta).toEqual(['#7d2240', '#ffffff']);
    p = usunZPalety(p, '#7d2240');
    expect(p.paleta).toEqual(['#ffffff']);
    p = usunZPalety(p, '#ffffff');
    expect('paleta' in p).toBe(false);
    expect(dodajDoPalety(p, 'nie-kolor')).toBe(p);
  });

  it('przy pełnej palecie wypada najstarszy kolor', () => {
    let p = projekt();
    for (let i = 0; i <= MAKS_KOLOROW_PALETY; i++)
      p = dodajDoPalety(p, `#${i.toString(16).padStart(6, '0')}`);
    expect(p.paleta).toHaveLength(MAKS_KOLOROW_PALETY);
    expect(p.paleta![0]).toBe('#000001');
  });

  it('schemat przyjmuje paletę, a migracja 32→33 nie zmienia danych', () => {
    const p = dodajDoPalety(projekt(), '#123456');
    expect(przygotujProjekt(p).paleta).toEqual(['#123456']);
    expect(() => przygotujProjekt({ ...p, paleta: ['#ABCDEF'] })).toThrow();
    const stary = { ...projekt(), wersja: 32 };
    expect(migruj(stary)).toEqual({ ...stary, wersja: WERSJA_SCHEMATU });
  });
});
