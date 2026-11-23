// @vitest-environment node
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { czyKontener } from '../model/szablon';
import { importujSvg } from '../ozdobniki';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  dodajSzablon,
  eksportujProjekt,
  eksportujSzablon,
  importujProjekt,
  importujSzablon,
  jakoKopia,
} from './archiwum';
import { BazaProjektow } from './baza';
import { dodajElementDoBiblioteki, odwolaniaDoElementow } from './biblioteka';
import { projektZPakietu } from './pakiet';

/**
 * N8b: eksport dołącza kopie użytych zasobów biblioteki, import dodaje je do biblioteki
 * użytkownika z deduplikacją (id, potem skrót) i przemapowaniem odwołań.
 */

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const PNG = new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));
const svgGwiazdki = readFileSync('testy/zasoby/gwiazdka.svg', 'utf8');

let wzor: Projekt;
let wzorZasoby: DaneZasobow;
beforeAll(async () => {
  ({ projekt: wzor, zasoby: wzorZasoby } = await projektZPakietu(
    pakietMausritter,
    czcionka,
    async () => PNG,
    'wzor',
  ));
});

/** Projekt pakietu z ikoną z własnego elementu w pierwszym szablonie. */
function zIkona(id: string) {
  const { projekt: p, id: element } = dodajElementDoBiblioteki(
    { ...structuredClone(wzor), id },
    'Gwiazdka.svg',
    importujSvg(svgGwiazdki, { rodzaj: 'ksztalt' }).element,
  );
  p.szablony[0]!.korzen.dzieci.find(czyKontener)!.dzieci.push({
    id: 'ikona-n8',
    typ: 'ikona',
    ikona: 'gwiazdka',
    element,
    rozmiar: 5,
  });
  return { projekt: p, zasoby: new Map(wzorZasoby), element };
}

/** Plik `.kartyrpg` wyeksportowany z widoku projektu w osobnej bazie. */
async function plikProjektu(nazwaBazy: string): Promise<Uint8Array> {
  const zrodlo = new BazaProjektow(nazwaBazy);
  const { projekt, zasoby } = zIkona('pZ');
  await zrodlo.zapisz(projekt, zasoby);
  const widok = await zrodlo.wczytaj('pZ');
  zrodlo.zamknij();
  return eksportujProjekt(widok.projekt, widok.zasoby);
}

const ileWpisow = async (baza: BazaProjektow) => ({
  obrazy: (await baza.wpisyBiblioteki('obraz')).length,
  ozdobniki: (await baza.wpisyBiblioteki('ozdobnik')).length,
  czcionki: (await baza.wpisyBiblioteki('czcionka')).length,
});

describe('import projektu do biblioteki użytkownika', () => {
  it('na „czystej” bazie przenosi obraz i ozdobnik do biblioteki; drugi import nie tworzy duplikatów', async () => {
    const plik = await plikProjektu('n8b-zrodlo');
    const baza = new BazaProjektow('n8b-czysta');
    expect(await ileWpisow(baza)).toEqual({ obrazy: 0, ozdobniki: 0, czcionki: 0 });
    const pierwszy = importujProjekt(plik);
    await baza.zapisz(pierwszy.projekt, pierwszy.zasoby);
    const po1 = await ileWpisow(baza);
    expect(po1).toEqual({ obrazy: 1, ozdobniki: 1, czcionki: 0 });
    const widok = await baza.wczytaj('pZ');
    const idElementu = widok.projekt.biblioteka!.ozdobniki[0]!.id;
    expect(odwolaniaDoElementow(widok.projekt.szablony[0]!)).toContain(idElementu);

    // Drugi import tego samego pliku jako kopia – te same wpisy biblioteki.
    const drugi = importujProjekt(plik);
    await baza.zapisz(jakoKopia(drugi.projekt, 'Kopia'), drugi.zasoby);
    expect(await ileWpisow(baza)).toEqual(po1);
    expect((await baza.lista()).length).toBe(2);
    baza.zamknij();
  });

  it('element o zajętym id, ale innej treści, dostaje nowe id, a szablon wskazuje nowe', async () => {
    const plik = await plikProjektu('n8b-zrodlo-2');
    const baza = new BazaProjektow('n8b-kolizja');
    // W bibliotece jest już „wl:Gwiazdka” – ale jako narożnik (inna treść).
    const inna = importujSvg(svgGwiazdki, { rodzaj: 'naroznik' }).element;
    await baza.dodajElementDoBibliotekiUzytkownika({ ...inna, id: 'wl:Gwiazdka', nazwa: 'Moja' });
    const { projekt, zasoby } = importujProjekt(plik);
    const mapy = await baza.zapisz(projekt, zasoby);
    const noweId = mapy.elementy.get('wl:Gwiazdka');
    expect(noweId).toBeDefined();
    expect(noweId).not.toBe('wl:Gwiazdka');
    const ozdobniki = await baza.wpisyBiblioteki('ozdobnik');
    expect(ozdobniki).toHaveLength(2);
    expect(ozdobniki.find((w) => w.id === 'wl:Gwiazdka')?.element?.rodzaj).toBe('naroznik');
    const widok = await baza.wczytaj('pZ');
    expect(odwolaniaDoElementow(widok.projekt.szablony[0]!)).toContain(noweId);
    baza.zamknij();
  });
});

describe('import szablonu do biblioteki użytkownika', () => {
  it('szablon z ozdobnikiem dodany dwa razy do projektu daje jeden wpis biblioteki', async () => {
    const zrodlo = new BazaProjektow('n8b-szablon-zrodlo');
    const z = zIkona('pS');
    await zrodlo.zapisz(z.projekt, z.zasoby);
    const widokZrodla = await zrodlo.wczytaj('pS');
    zrodlo.zamknij();
    const plik = eksportujSzablon(
      widokZrodla.projekt,
      widokZrodla.zasoby,
      widokZrodla.projekt.szablony[0]!.id,
    ).bajty;

    const baza = new BazaProjektow('n8b-szablon');
    const cel = { ...structuredClone(wzor), id: 'pC' };
    await baza.zapisz(cel, wzorZasoby);
    for (let i = 0; i < 2; i++) {
      const { projekt, zasoby } = await baza.wczytaj('pC');
      const wynik = dodajSzablon(projekt, zasoby, importujSzablon(plik));
      await baza.zapisz(wynik.projekt, wynik.zasoby);
    }
    // Obraz pakietu jest tylko w danych kart, więc plik szablonu go nie niesie; biblioteka ma
    // ten sam obraz z projektu docelowego (bez duplikatu).
    expect(await ileWpisow(baza)).toEqual({ obrazy: 1, ozdobniki: 1, czcionki: 0 });
    const widok = await baza.wczytaj('pC');
    const id = (await baza.wpisyBiblioteki('ozdobnik'))[0]!.id;
    const nowe = widok.projekt.szablony.slice(-2);
    for (const s of nowe) expect(odwolaniaDoElementow(s)).toContain(id);
    baza.zamknij();
  });
});
