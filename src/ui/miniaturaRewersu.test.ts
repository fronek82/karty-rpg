import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import { renderujMiniatureRewersu } from './miniaturaRewersu';

function projektZRewersem(
  obrazFormat?: 'png' | 'jpg',
  rozmiarObrazu = 16,
): {
  projekt: Projekt;
  dane: DaneZasobow;
} {
  const obrazId = 'obr-tlo';
  const dane: DaneZasobow = new Map();
  if (obrazFormat) {
    dane.set(obrazId, new Uint8Array(rozmiarObrazu).fill(65));
  }
  const projekt: Projekt = {
    wersja: WERSJA_SCHEMATU,
    id: 'proj-rew-test',
    nazwa: 'Rewers',
    utworzono: '2026-11-21T12:00:00.000Z',
    zmieniono: '2026-11-21T12:00:00.000Z',
    role: {},
    zasoby: obrazFormat
      ? [
          {
            id: obrazId,
            rodzaj: 'obraz',
            nazwa: 'Tło',
            format: obrazFormat,
            szerokosc: 100,
            wysokosc: 100,
          },
        ]
      : [],
    szablony: [],
    rewersy: [
      {
        id: 'rew-1',
        nazwa: 'Smoczy grzbiet',
        rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
        tlo: '#1b263b',
        ...(obrazFormat ? { teksturaTla: obrazId, teksturaTryb: 'wypelnij' as const } : {}),
        korzen: { id: 'korzen', typ: 'swobodny', dzieci: [] },
      },
    ],
    talie: [],
    arkusze: [],
  };
  return { projekt, dane };
}

describe('miniaturaRewersu', () => {
  it('zwraca undefined dla nieistniejącego rewersId', () => {
    const { projekt, dane } = projektZRewersem();
    expect(renderujMiniatureRewersu(projekt, dane, 'nie-ma')).toBeUndefined();
  });

  it('osadza obraz PNG i JPG tła jako data: URI w SVG miniatury', () => {
    const png = projektZRewersem('png', 32);
    const svgPng = renderujMiniatureRewersu(png.projekt, png.dane, 'rew-1');
    expect(svgPng).toContain('<svg');
    expect(svgPng).toContain('data:image/png;base64,');

    const jpg = projektZRewersem('jpg', 32);
    const svgJpg = renderujMiniatureRewersu(jpg.projekt, jpg.dane, 'rew-1');
    expect(svgJpg).toContain('<svg');
    expect(svgJpg).toContain('data:image/jpeg;base64,');
  });

  it('pomija osadzanie zbyt dużego obrazu (>1,5 MB), zachowując poprawny SVG karty', () => {
    const duzy = projektZRewersem('png', 1_600_000);
    const svg = renderujMiniatureRewersu(duzy.projekt, duzy.dane, 'rew-1');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('data:image/png;base64,');
  });

  it('renderuje miniaturę pojedynczego szablonu awersu (renderujMiniatureSzablonu)', async () => {
    const { renderujMiniatureSzablonu } = await import('./miniaturaRewersu');
    const { projekt, dane } = projektZRewersem();
    projekt.szablony = [
      {
        id: 'sz-1',
        nazwa: 'Karta zaklęcia',
        rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
        tlo: '#f5efe6',
        korzen: { id: 'k', typ: 'kolumna', dzieci: [] },
      },
    ];
    const svg = renderujMiniatureSzablonu(projekt, dane, 'sz-1');
    expect(svg).toContain('<svg');
    expect(svg).toContain('#f5efe6');
    expect(renderujMiniatureSzablonu(projekt, dane, 'brak')).toBeUndefined();
  });

  it('czyDwustronnyWlaczony włącza druk dwustronny domyślnie przy przypisanym rewersie i respektuje jawne wyłączenie', async () => {
    const { czyDwustronnyWlaczony } = await import('../dane/rewers');
    const { projekt } = projektZRewersem();
    const rewersyMapa = new Map((projekt.rewersy ?? []).map((r) => [r.id, r] as const));
    const szablonyMapa = new Map(projekt.szablony.map((s) => [s.id, s] as const));
    const arkusz = { taliaId: 't1', ustawienia: {} as never };
    const taliaBez = { id: 't1', nazwa: 'Talia', karty: [] };
    const taliaZRew = { id: 't1', nazwa: 'Talia', rewersId: 'rew-1', karty: [] };

    const taliaZRewKarty = {
      id: 't1',
      nazwa: 'Talia',
      karty: [{ id: 'k1', szablonId: 'sz-1', dane: {}, ilosc: 1, rewersId: 'rew-1' }],
    };
    const szablonyZSz = new Map([
      [
        'sz-1',
        {
          id: 'sz-1',
          nazwa: 'Karta',
          rozmiar: { tryb: 'mm' as const, szerokosc: 63, wysokosc: 88 },
          tlo: '#ffffff',
          korzen: { id: 'k', typ: 'kolumna' as const, dzieci: [] },
        },
      ],
    ]);

    expect(czyDwustronnyWlaczony(arkusz, taliaBez, szablonyMapa, rewersyMapa)).toBe(false);
    expect(czyDwustronnyWlaczony(arkusz, taliaZRew, szablonyMapa, rewersyMapa)).toBe(true);
    expect(czyDwustronnyWlaczony(arkusz, taliaZRewKarty, szablonyZSz, rewersyMapa)).toBe(true);
    expect(
      czyDwustronnyWlaczony(
        {
          taliaId: 't1',
          ustawienia: { dwustronny: { wlaczony: false, krawedz: 'dluga' } } as never,
        },
        taliaZRew,
        szablonyMapa,
        rewersyMapa,
      ),
    ).toBe(false);
  });
});
