import type { BazaDexie, BazaProjektow } from './baza';
import { czyProjektRewersowy } from './baza';
import { czyRewersUzywanyWProjekcie, czySzablonUzywanyWProjekcie } from './bibliotekaSzablonow';
import { migrujBajtyBazy, przygotujProjekt } from './schemat';
import { czyProjektWlasny } from './wlasneKarty';

/** Klucz znacznika migracji S1 w tabeli `meta`: brak → nie zaczęta, `w-toku`, `gotowa`. */
export const ZNACZNIK_MIGRACJI_SZABLONOW = 'migracjaS1';

/**
 * Jednorazowe przeniesienie wszystkich szablonów i tyłów z projektów (oraz dawnych paczek
 * biblioteki globalnej) do tabeli `szablony` (Plan S, etap S1):
 * - identyczne szablony/tyły (ten sam `hash`) są łączone w jeden rekord;
 * - powtórzone nazwy różnych szablonów dostają sufiks „(2)”, „(3)”…;
 * - kopie w projektach dostają `zrodlo: { id, hash }`;
 * - nieużywane kopie szablonów i tyłów są usuwane z projektów (zostają w bibliotece);
 * - pakiety gier (np. Mausritter) pozostają bez zmian (D-S5);
 * - wpisy `tylkoSzablony` (schowki usuniętych projektów z N6) są usuwane po przeniesieniu.
 *
 * Idempotentna: przed startem kopiuje `projekty` do `kopiaMigracji` (jak N8) i czyta z kopii.
 */
export async function migrujSzablonyDoBiblioteki(
  db: BazaDexie,
  baza: BazaProjektow,
): Promise<void> {
  const stan = await db.meta.get(ZNACZNIK_MIGRACJI_SZABLONOW);
  if (stan?.wartosc === 'gotowa') return;
  if (!stan) {
    await db.transaction('rw', [db.projekty, db.kopiaMigracji, db.meta], async () => {
      await db.kopiaMigracji.clear();
      await db.kopiaMigracji.bulkPut(await db.projekty.toArray());
      await db.meta.put({ klucz: ZNACZNIK_MIGRACJI_SZABLONOW, wartosc: 'w-toku' });
    });
  }

  // Dawne paczki szablonów i rewersów z tabeli `bibliotekaGlobalna` (jeśli jakieś zostały).
  const globalne = (await db.bibliotekaGlobalna.toArray()).filter(
    (w) => w.rodzaj === 'szablon' || w.rodzaj === 'rewers',
  );
  const przeniesioneGlobalne: string[] = [];
  for (const w of globalne) {
    try {
      const paczka = await db.paczkiBiblioteki.get(w.id);
      if (!paczka) continue;
      const bajty = await migrujBajtyBazy(paczka.dane);
      await baza.importujSzablonDoBiblioteki(bajty, {
        jako: w.rodzaj === 'rewers' ? 'rewers' : 'awers',
      });
      przeniesioneGlobalne.push(w.id);
    } catch (e) {
      console.warn(`Migracja szablonów: pominięto dawny wpis „${w.nazwa}”`, e);
    }
  }

  // Projekty z kopii bezpieczeństwa – w kolejności od najstarszego, żeby pierwotny szablon
  // zachował nazwę bez sufiksu, a późniejsze inne wersje o tej samej nazwie dostały „(2)”.
  const kopie = (await db.kopiaMigracji.toArray()).sort((a, b) =>
    a.zmieniono.localeCompare(b.zmieniono),
  );
  const doUsunieciaSchowki: string[] = [];

  for (const kopia of kopie) {
    try {
      const projekt = przygotujProjekt(kopia.projekt);
      // Pakiety gier (Mausritter itp.) nie korzystają z biblioteki szablonów (D-S5).
      if (!czyProjektWlasny(projekt)) continue;

      const rewersowy = czyProjektRewersowy(projekt);
      const mapaRewersow = new Map<string, { id: string; hash: string }>();

      for (const r of projekt.rewersy ?? []) {
        const wynik = await baza.dodajRewersDoBiblioteki(r, projekt.role, {
          zmieniono: projekt.zmieniono,
        });
        mapaRewersow.set(r.id, { id: wynik.id, hash: wynik.hash });
      }

      const mapaSzablonow = new Map<string, { id: string; hash: string }>();
      if (!rewersowy) {
        for (const s of projekt.szablony) {
          const domyslnyRewersId =
            typeof s.rewersId === 'string' ? mapaRewersow.get(s.rewersId)?.id : undefined;
          const wynik = await baza.dodajSzablonDoBiblioteki(s, projekt.role, {
            zmieniono: projekt.zmieniono,
            ...(domyslnyRewersId ? { domyslnyRewersId } : {}),
          });
          mapaSzablonow.set(s.id, { id: wynik.id, hash: wynik.hash });
        }
      }

      if (kopia.tylkoSzablony || rewersowy) {
        doUsunieciaSchowki.push(kopia.id);
        continue;
      }

      // W projekcie zostają tylko kopie używane przez karty/arkusze; każda dostaje `zrodlo`.
      const zachowaneSzablony = projekt.szablony
        .filter((s) => czySzablonUzywanyWProjekcie(projekt, s.id))
        .map((s) => {
          const zrodlo = mapaSzablonow.get(s.id);
          return zrodlo ? { ...s, zrodlo } : s;
        });

      const zachowaneRewersy = (projekt.rewersy ?? [])
        .filter((r) => czyRewersUzywanyWProjekcie(projekt, r.id, zachowaneSzablony))
        .map((r) => {
          const zrodlo = mapaRewersow.get(r.id);
          return zrodlo ? { ...r, zrodlo } : r;
        });

      const { rewersy: _r, ...bezRewersow } = projekt;
      void _r;
      const zaktualizowany = przygotujProjekt({
        ...bezRewersow,
        szablony: zachowaneSzablony,
        ...(zachowaneRewersy.length > 0 ? { rewersy: zachowaneRewersy } : {}),
      });

      await db.transaction('rw', db.projekty, async () => {
        const obecny = await db.projekty.get(kopia.id);
        if (!obecny || obecny.zmieniono !== kopia.zmieniono) return;
        await db.projekty.put({ ...obecny, projekt: zaktualizowany });
      });
    } catch (e) {
      console.warn(`Migracja szablonów: projekt „${kopia.id}” zostaje bez zmian`, e);
    }
  }

  await db.transaction(
    'rw',
    [
      db.projekty,
      db.zasoby,
      db.miniatury,
      db.bibliotekaGlobalna,
      db.paczkiBiblioteki,
      db.kopiaMigracji,
      db.meta,
    ],
    async () => {
      for (const id of doUsunieciaSchowki) {
        const obecny = await db.projekty.get(id);
        if (obecny && (obecny.tylkoSzablony || czyProjektRewersowy(obecny.projekt))) {
          await db.zasoby.where('projektId').equals(id).delete();
          await db.projekty.delete(id);
          await db.miniatury.delete(id);
          await db.miniatury.where('id').startsWith(`rewers:${id}:`).delete();
          await db.miniatury.where('id').startsWith(`szablon:${id}:`).delete();
        }
      }
      await db.bibliotekaGlobalna.bulkDelete(przeniesioneGlobalne);
      await db.paczkiBiblioteki.bulkDelete(przeniesioneGlobalne);
      await db.kopiaMigracji.clear();
      await db.meta.put({ klucz: ZNACZNIK_MIGRACJI_SZABLONOW, wartosc: 'gotowa' });
    },
  );
}
