/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { nowyProjektGry } from '../../dane/nowyProjekt';
import { zbudujArkusz } from '../../druk/arkusz';
import { ustawJezyk } from '../../i18n';
import { pakietMausritter } from '../../pakiety/mausritter';
import { scenaDoSvg } from '../../silnik/svg';
import type { ZasobyProjektu } from '../zasobyProjektu';
import type { Projekt } from '../../model/projekt';
import { ID_PUSTEJ } from './idPodgladow';
import {
  krokiPodgladow,
  lokalizowanyProjekt,
  wczytajZasobyPakietu,
  type Podglad,
} from './podglady';

const czytaj = (adres: string) =>
  Promise.resolve(
    new Uint8Array(
      readFileSync(adres.endsWith('.png') ? 'src/pakiety/mausritter/obrazy/zastepczy.png' : adres),
    ),
  );

let projekt: Projekt;
let zasoby: ZasobyProjektu;
beforeAll(async () => {
  ({ projekt, zasoby } = await wczytajZasobyPakietu(
    pakietMausritter,
    (plik) => `public/czcionki/${plik}`,
    czytaj,
  ));
});
afterEach(() => ustawJezyk('pl'));

const liczWszystkie = (): Map<string, Podglad> =>
  new Map(
    krokiPodgladow(pakietMausritter, lokalizowanyProjekt(projekt, pakietMausritter), zasoby).map(
      (k) => [k.id, k.licz()],
    ),
  );

describe('podglądy ekranu gry', () => {
  it('jest 1 podgląd pustej kartki + po jednym na każdy układ pakietu', () => {
    const kroki = krokiPodgladow(
      pakietMausritter,
      lokalizowanyProjekt(projekt, pakietMausritter),
      zasoby,
    );
    expect(kroki.map((k) => k.id)).toEqual([
      ID_PUSTEJ,
      ...pakietMausritter.gotoweUklady.map((u) => u.id),
    ]);
    expect(kroki).toHaveLength(1 + pakietMausritter.gotoweUklady.length);
  });

  it('każdy podgląd liczy się bez ostrzeżeń silnika', () => {
    for (const [id, p] of liczWszystkie()) expect(p.ostrzezenia, id).toEqual([]);
  });

  it('SVG podglądu układu = scena z zbudujArkusz → scenaDoSvg dla kartki z nowego projektu', async () => {
    const podglady = liczWszystkie();
    for (const u of pakietMausritter.gotoweUklady) {
      // Projekt tak, jak powstaje po kliknięciu (z normalizacją kartki do przypiętych kart).
      const { projekt: nowy } = await nowyProjektGry(
        pakietMausritter,
        (plik) => czytaj(`public/czcionki/${plik}`),
        czytaj,
        {
          uklad: u.id,
          id: 'x',
        },
      );
      const wspolne = zasoby.zRolami(nowy.role, nowy.szablony).zasoby;
      const strony = nowy.arkusze.map((a) => {
        const talia = nowy.talie.find((x) => x.id === a.taliaId)!;
        const w = zbudujArkusz(a, talia, {
          czcionki: wspolne.czcionki,
          szablony: wspolne.szablony,
          obraz: (id) => wspolne.obrazy.get(id)?.info,
        });
        return scenaDoSvg(w.strony[0]!, {
          przedrostekId: `pg-${u.id}-${u.arkusze[nowy.arkusze.indexOf(a)]}-`,
          adresObrazu: (id) => wspolne.obrazy.get(id)?.adres,
          atrybuty: { 'aria-hidden': 'true', focusable: 'false' },
        });
      });
      expect(
        podglady.get(u.id)!.strony.map((s) => s.svg),
        u.id,
      ).toEqual(strony);
    }
  });

  it('„Wszystkie trzy” to trzy kartki układów, w kolejności układu; SVG ma unikalne przedrostki', () => {
    const p = liczWszystkie();
    const wszystkie = p.get('wszystkie')!;
    expect(wszystkie.strony).toHaveLength(3);
    // Ta sama scena kartki w dwóch kafelkach nie powtarza identyfikatorów między kafelkami.
    const id = [...p.values()].flatMap((x) =>
      x.strony.flatMap((s) => [...s.svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!)),
    );
    expect(new Set(id).size).toBe(id.length);
  });

  it('pusta kartka niesie geometrię siatki z układu: 10×7 slotów po 25,75 mm, A4 poziomo', () => {
    const s = liczWszystkie().get(ID_PUSTEJ)!.strony[0]!;
    expect(s.siatka).toMatchObject({ kolumny: 10, rzedy: 7 });
    expect(s.siatka!.slot.szerokosc).toBeCloseTo(25.75);
    expect(s.szerokosc).toBeCloseTo(297);
    expect(s.wysokosc).toBeCloseTo(210);
    // Siatka mieści się na kartce.
    expect(s.siatka!.poczatek.x + 10 * s.siatka!.slot.szerokosc).toBeLessThanOrEqual(297);
    expect(s.siatka!.poczatek.y + 7 * s.siatka!.slot.wysokosc).toBeLessThanOrEqual(210);
    // Układy gotowe nie mają nakładki siatki.
    expect(liczWszystkie().get('bron')!.strony[0]!.siatka).toBeUndefined();
  });

  it('nagłówki grup na podglądzie „Stany” są w bieżącym języku', () => {
    const pl = liczWszystkie().get('stany')!.strony[0]!.svg;
    ustawJezyk('en');
    const en = liczWszystkie().get('stany')!.strony[0]!.svg;
    expect(en).not.toBe(pl);
    expect(en).not.toContain('NaN');
  });
});
