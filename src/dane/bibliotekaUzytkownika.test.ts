// @vitest-environment node
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DaneZasobow, OpisObrazu, Projekt } from '../model/projekt';
import { czyKontener } from '../model/szablon';
import { importujSvg } from '../ozdobniki';
import { pakietMausritter } from '../pakiety/mausritter';
import { projektDoEksportu, spakujOzdobnik } from './archiwum';
import { BazaProjektow } from './baza';
import { dodajElementDoBiblioteki } from './biblioteka';
import { przepiszZasobyProjektu } from './bibliotekaUzytkownika';
import { migrujDoBiblioteki, ZNACZNIK_MIGRACJI } from './migracjaBiblioteki';
import { projektZPakietu } from './pakiet';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const PNG = new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));
/** Ten sam obraz z innym ogonem po IEND – inny plik (inny skrót), ten sam format i wymiary. */
const PNG2 = new Uint8Array([...PNG, 1, 2, 3]);
const plikSvg = readFileSync('testy/zasoby/gwiazdka.svg', 'utf8');

let wzor: Projekt;
let wzorZasoby: DaneZasobow;
let idObrazu: string;
beforeAll(async () => {
  ({ projekt: wzor, zasoby: wzorZasoby } = await projektZPakietu(
    pakietMausritter,
    czcionka,
    async () => PNG,
    'wzor',
  ));
  idObrazu = wzor.zasoby.find((z): z is OpisObrazu => z.rodzaj === 'obraz')!.id;
});

/** Projekt pakietu z ikoną z własnego elementu (gwiazdka) w pierwszym szablonie. */
function projektZIkona(id: string): { projekt: Projekt; zasoby: DaneZasobow } {
  const { projekt: p, id: element } = dodajElementDoBiblioteki(
    { ...structuredClone(wzor), id },
    'Gwiazdka.svg',
    importujSvg(plikSvg, { rodzaj: 'ksztalt' }).element,
  );
  const kontener = p.szablony[0]!.korzen.dzieci.find(czyKontener)!;
  kontener.dzieci.push({ id: 'ikona-n8', typ: 'ikona', ikona: 'gwiazdka', element, rozmiar: 5 });
  return { projekt: p, zasoby: new Map(wzorZasoby) };
}

/** Id obrazów wskazanych w szablonach albo w danych kart (zbiór „ma”). */
const obrazySzablonow = (p: Projekt) => {
  const tekst = JSON.stringify([p.szablony, p.rewersy, p.talie]);
  return { has: (id: string) => tekst.includes(`"${id}"`) };
};

describe('biblioteka użytkownika: zapis i widok projektu', () => {
  it('zasoby i ozdobniki trafiają do biblioteki; projekt w bazie trzyma tylko czcionki wbudowane', async () => {
    const baza = new BazaProjektow('n8-zapis');
    const { projekt, zasoby } = projektZIkona('pA');
    await baza.zapisz(projekt, zasoby);
    expect((await baza.wpisyBiblioteki('obraz')).map((w) => w.id)).toEqual([idObrazu]);
    expect(await baza.wpisyBiblioteki('ozdobnik')).toHaveLength(1);
    expect(await baza.wpisyBiblioteki('czcionka')).toEqual([]); // czcionki pakietu są wbudowane
    const surowy = await baza.migawka(['pA']);
    const dok = surowy[0]!.projekt.projekt;
    expect(dok.biblioteka).toBeUndefined();
    expect(dok.zasoby.every((z) => z.rodzaj === 'czcionka' && z.zrodlo === 'wbudowana')).toBe(true);
    expect(surowy[0]!.zasoby.map((z) => z.id).sort()).toEqual(dok.zasoby.map((z) => z.id).sort());
    baza.zamknij();
  });

  it('element i obraz z biblioteki są w widoku innego projektu', async () => {
    const baza = new BazaProjektow('n8-widok');
    const b = { ...structuredClone(wzor), id: 'pB' };
    b.szablony = b.szablony.map((s) => ({ ...s, korzen: { ...s.korzen, dzieci: [] } }));
    b.talie = b.talie.map((t) => ({ ...t, karty: [], grupy: undefined }));
    b.arkusze = b.arkusze.map((a) => ({ ...a, kolejnosc: undefined, przypiete: undefined }));
    b.zasoby = b.zasoby.filter((z) => z.rodzaj === 'czcionka');
    await baza.zapisz(b, wzorZasoby);
    const { projekt, zasoby } = projektZIkona('pA');
    await baza.zapisz(projekt, zasoby);
    const widok = await baza.wczytaj('pB');
    expect(widok.projekt.zasoby.some((z) => z.id === idObrazu)).toBe(true);
    expect(widok.zasoby.get(idObrazu)).toEqual(PNG);
    expect(widok.projekt.biblioteka?.ozdobniki.map((e) => e.nazwa)).toEqual(['Gwiazdka.svg']);
    baza.zamknij();
  });

  it('ponowne wgranie tego samego pliku pod innym id nie tworzy wpisu – odwołania wskazują istniejący', async () => {
    const baza = new BazaProjektow('n8-dedup');
    await baza.zapisz({ ...structuredClone(wzor), id: 'p1' }, wzorZasoby);
    const mapa = new Map([[idObrazu, 'obraz-kopia']]);
    const kopia = przepiszZasobyProjektu({ ...structuredClone(wzor), id: 'p2' }, mapa, new Map());
    const dane: DaneZasobow = new Map(wzorZasoby);
    dane.set('obraz-kopia', PNG);
    dane.delete(idObrazu);
    expect(obrazySzablonow(kopia).has('obraz-kopia')).toBe(true);
    const mapy = await baza.zapisz(kopia, dane);
    expect(mapy.obrazy.get('obraz-kopia')).toBe(idObrazu);
    expect(await baza.wpisyBiblioteki('obraz')).toHaveLength(1);
    const p2 = (await baza.migawka(['p2']))[0]!.projekt.projekt;
    expect(obrazySzablonow(p2).has(idObrazu)).toBe(true);
    expect(obrazySzablonow(p2).has('obraz-kopia')).toBe(false);
    // Ten sam plik dodany wprost do biblioteki (np. na stronie Biblioteki) – też istniejący wpis.
    expect(
      await baza.dodajZasobDoBiblioteki(
        {
          rodzaj: 'obraz',
          id: 'inny',
          nazwa: 'inny.png',
          format: 'png',
          szerokosc: 1,
          wysokosc: 1,
        },
        PNG,
      ),
    ).toBe(idObrazu);
    baza.zamknij();
  });
});

describe('biblioteka użytkownika: usuwanie i eksport', () => {
  it('obraz usunięty z biblioteki (np. w innej karcie) nie blokuje zapisu i nie wraca', async () => {
    const baza = new BazaProjektow('n8-usuniety');
    const { projekt, zasoby } = projektZIkona('pA');
    zasoby.set('obraz-luzny', PNG2);
    const zLuznym: Projekt = {
      ...projekt,
      zasoby: [
        ...projekt.zasoby,
        {
          rodzaj: 'obraz',
          id: 'obraz-luzny',
          nazwa: 'luzny.png',
          format: 'png',
          szerokosc: 1,
          wysokosc: 1,
        },
      ],
    };
    await baza.zapisz(zLuznym, zasoby);
    const widok = await baza.wczytaj('pA');
    expect(widok.projekt.zasoby.some((z) => z.id === 'obraz-luzny')).toBe(true);
    await baza.usunZBiblioteki('obraz-luzny');
    // Edytor trzyma stary widok z bajtami w pamięci – zwykły zapis dokumentu.
    await baza.zapisz(widok.projekt, undefined, { dane: widok.zasoby });
    expect((await baza.wpisyBiblioteki('obraz')).map((w) => w.id)).not.toContain('obraz-luzny');
    // „Cofnij” na stronie biblioteki przywraca ten sam wpis (to samo id).
    expect(await baza.zapiszWBibliotece('obraz', 'luzny.png', PNG2, 'obraz-luzny')).toBe(
      'obraz-luzny',
    );
    expect((await baza.wpisyBiblioteki('obraz')).map((w) => w.id)).toContain('obraz-luzny');
    baza.zamknij();
  });

  it('eksport projektu bierze z widoku tylko użyte zasoby i ozdobniki', async () => {
    const baza = new BazaProjektow('n8-eksport');
    const { projekt, zasoby } = projektZIkona('pA');
    await baza.zapisz(projekt, zasoby);
    const pusty = { ...structuredClone(wzor), id: 'pP' };
    pusty.szablony = pusty.szablony.map((s) => ({ ...s, korzen: { ...s.korzen, dzieci: [] } }));
    pusty.talie = pusty.talie.map((t) => ({ ...t, karty: [], grupy: undefined }));
    pusty.arkusze = pusty.arkusze.map((a) => ({
      ...a,
      kolejnosc: undefined,
      przypiete: undefined,
    }));
    pusty.zasoby = pusty.zasoby.filter((z) => z.rodzaj === 'czcionka');
    await baza.zapisz(pusty, wzorZasoby);
    const widokPusty = await baza.wczytaj('pP');
    expect(widokPusty.projekt.zasoby.some((z) => z.rodzaj === 'obraz')).toBe(true);
    const doPliku = projektDoEksportu(widokPusty.projekt);
    expect(doPliku.zasoby.some((z) => z.rodzaj === 'obraz')).toBe(false);
    expect(doPliku.biblioteka).toBeUndefined();
    const doPlikuA = projektDoEksportu((await baza.wczytaj('pA')).projekt);
    expect(doPlikuA.zasoby.some((z) => z.rodzaj === 'obraz')).toBe(true);
    expect(doPlikuA.biblioteka?.ozdobniki).toHaveLength(1);
    baza.zamknij();
  });
});

describe('migracja do biblioteki użytkownika (baza w wersji 4)', () => {
  /** Stara baza: dwa projekty i wpis ozdobnika w bibliotece globalnej. */
  async function przygotujStaraBaze(nazwa: string) {
    const a = projektZIkona('pA');
    // pB: obraz o tym samym id, ale innej treści – musi dostać nowe id i przepisane odwołania.
    const b = projektZIkona('pB');
    b.zasoby.set(idObrazu, PNG2);
    const stara = new Dexie(nazwa);
    stara.version(4).stores({
      projekty: 'id, zmieniono',
      zasoby: '[projektId+id], projektId',
      miniatury: 'id',
      uklady: 'id, nazwa',
      bibliotekaGlobalna: 'id, rodzaj',
      paczkiBiblioteki: 'id',
    });
    for (const { projekt, zasoby } of [a, b]) {
      await stara.table('projekty').add({ id: projekt.id, zmieniono: projekt.zmieniono, projekt });
      await stara
        .table('zasoby')
        .bulkAdd([...zasoby].map(([id, dane]) => ({ projektId: projekt.id, id, dane })));
    }
    const element = a.projekt.biblioteka!.ozdobniki[0]!;
    await stara
      .table('bibliotekaGlobalna')
      .add({ id: 'g1', rodzaj: 'ozdobnik', nazwa: 'Gwiazdka' });
    await stara.table('paczkiBiblioteki').add({ id: 'g1', dane: spakujOzdobnik(element) });
    await stara
      .table('bibliotekaGlobalna')
      .add({ id: 'g2', rodzaj: 'obraz', nazwa: 'zastepczy.png' });
    await stara.table('paczkiBiblioteki').add({ id: 'g2', dane: PNG });
    // Uszkodzony plik czcionki – nie da się go przenieść, więc zostaje w starych tabelach.
    await stara.table('bibliotekaGlobalna').add({ id: 'g4', rodzaj: 'czcionka', nazwa: 'zla.ttf' });
    await stara.table('paczkiBiblioteki').add({ id: 'g4', dane: new Uint8Array([1, 2, 3]) });
    await stara.table('bibliotekaGlobalna').add({ id: 'g3', rodzaj: 'szablon', nazwa: 'Szablon' });
    await stara.table('paczkiBiblioteki').add({ id: 'g3', dane: new Uint8Array([1]) });
    stara.close();
    return { a, b };
  }

  async function sprawdzWynik(baza: BazaProjektow) {
    const obrazy = await baza.wpisyBiblioteki('obraz');
    expect(obrazy).toHaveLength(2); // PNG (pA i paczka globalna) i PNG2 (pB)
    expect(await baza.wpisyBiblioteki('ozdobnik')).toHaveLength(1); // pA, pB i paczka – ta sama treść
    const pA = await baza.wczytaj('pA');
    const pB = await baza.wczytaj('pB');
    // Wpisy rozpoznawane po bajtach (id nadaje pierwszy dodany – tu paczka globalna).
    const idPo = async (bajty: Uint8Array) => {
      for (const w of obrazy)
        if ((await baza.bajtyBiblioteki(w.id))?.join() === bajty.join()) return w.id;
      throw new Error('brak wpisu');
    };
    const id1 = await idPo(PNG);
    const id2 = await idPo(PNG2);
    expect(obrazySzablonow(pA.projekt).has(id1)).toBe(true);
    expect(obrazySzablonow(pB.projekt).has(id2)).toBe(true);
    expect(obrazySzablonow(pB.projekt).has(id1)).toBe(false);
    expect(pB.zasoby.get(id2)).toEqual(PNG2);
    const surowe = await baza.migawka(['pA', 'pB']);
    for (const m of surowe) {
      expect(m.projekt.projekt.biblioteka).toBeUndefined();
      expect(m.zasoby.every((z) => m.projekt.projekt.zasoby.some((o) => o.id === z.id))).toBe(true);
    }
    expect(await baza.odczytajZBiblioteki('g4')).toEqual(new Uint8Array([1, 2, 3]));
    // Wpis szablonu w bibliotece globalnej zostaje bez zmian.
    expect((await baza.bibliotekaGlobalna('szablon')).map((w) => w.id)).toEqual(['g3']);
  }

  it('przenosi obrazy i ozdobniki z dwóch projektów i biblioteki globalnej z deduplikacją', async () => {
    const nazwa = 'n8-migracja';
    await przygotujStaraBaze(nazwa);
    const baza = new BazaProjektow(nazwa);
    await sprawdzWynik(baza);
    baza.zamknij();
    // Ponowne otwarcie – migracja już zrobiona, nic się nie dubluje.
    const znowu = new BazaProjektow(nazwa);
    await sprawdzWynik(znowu);
    znowu.zamknij();
  });

  it('przerwana migracja (przed sprzątaniem) powtórzona daje ten sam wynik', async () => {
    const nazwa = 'n8-migracja-przerwana';
    const { a, b } = await przygotujStaraBaze(nazwa);
    const pomocnicza = new BazaProjektow(nazwa, { bezMigracji: true });
    const db = (pomocnicza as unknown as { db: import('./baza').BazaDexie }).db;
    await migrujDoBiblioteki(db, pomocnicza);
    // Symulacja przerwania: stan „w toku”, kopia zapasowa i bajty projektów jak przed sprzątaniem.
    await db.meta.put({ klucz: ZNACZNIK_MIGRACJI, wartosc: 'w-toku' });
    for (const { projekt, zasoby } of [a, b]) {
      await db.kopiaMigracji.put({ id: projekt.id, zmieniono: projekt.zmieniono, projekt });
      await db.zasoby.bulkPut(
        [...zasoby].map(([id, dane]) => ({ projektId: projekt.id, id, dane })),
      );
    }
    await migrujDoBiblioteki(db, pomocnicza);
    expect(await db.kopiaMigracji.count()).toBe(0);
    expect((await db.meta.get(ZNACZNIK_MIGRACJI))?.wartosc).toBe('gotowa');
    pomocnicza.zamknij();
    const baza = new BazaProjektow(nazwa);
    await sprawdzWynik(baza);
    baza.zamknij();
  });
});
