/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Pakiet } from '../pakiety/typy';
import { wczytajZasobyPakietu } from './zasoby';

const PNG = 'src/pakiety/mausritter/obrazy/zastepczy.png';

const pakiet: Pick<Pakiet, 'czcionki' | 'zasoby' | 'szablony'> & Record<string, unknown> = {
  id: 'p',
  nazwa: 'P',
  opis: '',
  atrybucja: '',
  czcionki: [
    {
      rola: 'tytul',
      rodzina: 'Grenze Gotisch',
      warianty: { pogrubiony: 'GrenzeGotisch-Bold.ttf' },
    },
  ],
  szablony: [],
  talie: [],
  arkusze: [],
  zasoby: [{ id: 'obraz', plik: '/obraz.png', szerokosc: 512, wysokosc: 512, format: 'png' }],
};

function udawanyFetch(brakujace: string[] = []) {
  return vi.fn(async (adres: string) => {
    if (brakujace.some((b) => adres.endsWith(b))) return new Response(null, { status: 404 });
    const plik = adres === '/obraz.png' ? PNG : `public/czcionki/${adres.split('/').pop()}`;
    return new Response(readFileSync(plik));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('wczytajZasobyPakietu', () => {
  it('czcionki z katalogu bazowego, role i obrazy z adresem data:', async () => {
    const f = udawanyFetch();
    vi.stubGlobal('fetch', f);
    const z = await wczytajZasobyPakietu(pakiet, '/karty-rpg/');
    expect(f).toHaveBeenCalledWith('/karty-rpg/czcionki/GrenzeGotisch-Bold.ttf');
    expect(z.czcionki.pobierz('tytul', 'pogrubiony').id).toBe('GrenzeGotisch-Bold.ttf');
    const o = z.obrazy.get('obraz')!;
    expect(o.info).toEqual({ szerokosc: 512, wysokosc: 512 });
    // Adres data: koduje dokładnie te same bajty (także dla plików większych niż jeden blok).
    const zAdresu = Buffer.from(o.adres.replace('data:image/png;base64,', ''), 'base64');
    expect(zAdresu.equals(Buffer.from(o.dane))).toBe(true);
    expect(o.dane.length).toBe(readFileSync(PNG).length);
  });

  it('brak pliku – błąd z adresem i kodem HTTP', async () => {
    vi.stubGlobal('fetch', udawanyFetch(['GrenzeGotisch-Bold.ttf']));
    await expect(wczytajZasobyPakietu(pakiet, '/')).rejects.toThrow(
      '/czcionki/GrenzeGotisch-Bold.ttf: HTTP 404',
    );
  });
});
