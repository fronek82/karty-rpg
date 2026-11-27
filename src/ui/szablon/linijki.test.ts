import { describe, expect, it } from 'vitest';
import { migruj, schematProjektu } from '../../dane/schemat';
import { WERSJA_SCHEMATU } from '../../model/projekt';
import {
  formatujMmLinii,
  kreskiLinijki,
  mmNaProcentLinijki,
  nowaLiniaPomocnicza,
  pozycjeLiniiOsi,
  pxNaMm,
  WYSTAWANIE_MM,
  zaokraglijLinie,
} from './linijki';

describe('linijki i linie pomocnicze (UI2 R5)', () => {
  it('zaokrągla pozycję linii pomocniczej do kroku 0,5 mm', () => {
    expect(zaokraglijLinie(10.2)).toBe(10);
    expect(zaokraglijLinie(10.3)).toBe(10.5);
    expect(zaokraglijLinie(10.74)).toBe(10.5);
    expect(zaokraglijLinie(10.76)).toBe(11);
    expect(zaokraglijLinie(-2.3)).toBe(-2.5);
  });

  it('generuje kreski co 1 mm z wystawaniem 10 mm i etykietami cm co 10 mm', () => {
    const kreski = kreskiLinijki(63, WYSTAWANIE_MM);
    expect(kreski[0]).toEqual({ mm: -10, rodzaj: 'cm', etykieta: '-1' });
    expect(kreski.find((k) => k.mm === 0)).toEqual({ mm: 0, rodzaj: 'cm', etykieta: '0' });
    expect(kreski.find((k) => k.mm === 5)).toEqual({ mm: 5, rodzaj: 'polcm' });
    expect(kreski.find((k) => k.mm === 3)).toEqual({ mm: 3, rodzaj: 'mm' });
    expect(kreski.find((k) => k.mm === 60)).toEqual({ mm: 60, rodzaj: 'cm', etykieta: '6' });
    expect(kreski.at(-1)?.mm).toBe(73);
  });

  it('przelicza px na mm i mm na procent szerokości linijki', () => {
    expect(pxNaMm(315, 630, 63)).toBeCloseTo(31.5, 5);
    expect(pxNaMm(0, 630, 63)).toBe(0);
    expect(pxNaMm(100, 0, 63)).toBe(0);
    expect(mmNaProcentLinijki(-10, 60, 10)).toBeCloseTo(0, 5);
    expect(mmNaProcentLinijki(0, 60, 10)).toBeCloseTo(12.5, 5);
    expect(mmNaProcentLinijki(70, 60, 10)).toBeCloseTo(100, 5);
  });

  it('tworzy unikalne identyfikatory linii i filtruje pozycje według osi', () => {
    const l1 = nowaLiniaPomocnicza([], 'h', 12.3);
    expect(l1).toEqual({ id: 'lp-1', os: 'h', mm: 12.5 });
    const l2 = nowaLiniaPomocnicza([l1], 'v', 31.4);
    expect(l2).toEqual({ id: 'lp-2', os: 'v', mm: 31.5 });
    expect(pozycjeLiniiOsi([l1, l2], 'h')).toEqual([12.5]);
    expect(pozycjeLiniiOsi([l1, l2], 'v')).toEqual([31.5]);
    expect(formatujMmLinii(12.5)).toBe('12,5 mm');
    expect(formatujMmLinii(20)).toBe('20 mm');
  });

  it('migruje projekt z wersji 34 do 35 i waliduje liniePomocnicze w schemacie', () => {
    expect(WERSJA_SCHEMATU).toBeGreaterThanOrEqual(35);
    const stary = {
      wersja: 34,
      id: 'p1',
      nazwa: 'Test',
      utworzono: '2026-01-01T00:00:00.000Z',
      zmieniono: '2026-01-01T00:00:00.000Z',
      role: {},
      zasoby: [],
      szablony: [
        {
          id: 's1',
          nazwa: 'Karta',
          rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
          korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
        },
      ],
      talie: [],
      arkusze: [],
    };
    const poMigracji = migruj(stary) as Record<string, unknown>;
    expect(poMigracji.wersja).toBe(WERSJA_SCHEMATU);
    expect(schematProjektu.safeParse(poMigracji).success).toBe(true);

    const zLiniami = {
      ...poMigracji,
      szablony: [
        {
          ...stary.szablony[0]!,
          liniePomocnicze: [
            { id: 'lp-1', os: 'h', mm: 15 },
            { id: 'lp-2', os: 'v', mm: 31.5 },
          ],
        },
      ],
    };
    expect(schematProjektu.safeParse(zLiniami).success).toBe(true);
  });
});
