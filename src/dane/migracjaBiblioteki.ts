import { t } from '../i18n';
import type { DaneZasobow } from '../model/projekt';
import { importujOzdobnik, spakujOzdobnik } from './archiwum';
import { zasobyElementow } from './biblioteka';
import type { BazaDexie, BazaProjektow } from './baza';
import {
  opisZWpisu,
  przepiszObrazElementu,
  type RodzajWpisuBiblioteki,
  type WpisBiblioteki,
} from './bibliotekaUzytkownika';
import { wgrajCzcionke } from './czcionki';
import { KATALOG_GOOGLE_FONTS } from './googleFonts';
import { opisObrazu, wymiaryPliku } from './obrazy';
import { BladDanych, migrujBajtyBazy, przygotujProjekt } from './schemat';

/** Klucz znacznika migracji N8 w tabeli `meta`: brak → nie zaczęta, `w-toku`, `gotowa`. */
export const ZNACZNIK_MIGRACJI = 'migracjaN8';

const RODZAJE: ReadonlySet<string> = new Set(['ozdobnik', 'obraz', 'czcionka']);

let plikiGoogle: Set<string> | undefined;
const czyPlikGoogle = (nazwa: string) =>
  (plikiGoogle ??= new Set(
    KATALOG_GOOGLE_FONTS.flatMap((p) =>
      p.warianty.map((w) => w.plik.split('/').pop()!.toLowerCase()),
    ),
  )).has(nazwa.toLowerCase());

/**
 * Dodaje do biblioteki użytkownika zawartość dawnej paczki biblioteki globalnej: surowy plik
 * obrazu albo czcionki, paczkę `.kartyrpg-ozdobnik`. Zwraca id wpisu (istniejącego przy
 * powtórce).
 */
export async function dodajPaczkeDoBiblioteki(
  baza: BazaProjektow,
  rodzaj: RodzajWpisuBiblioteki,
  nazwa: string,
  bajty: Uint8Array,
): Promise<string> {
  if (rodzaj === 'obraz') {
    const wymiary = wymiaryPliku(bajty);
    if (!wymiary) throw new BladDanych(t('dane.zlyObraz', { plik: nazwa }));
    return baza.dodajZasobDoBiblioteki(opisObrazu(nazwa, bajty, wymiary, new Set()), bajty);
  }
  if (rodzaj === 'czcionka') {
    const { opis, dane } = wgrajCzcionke(nazwa, bajty, {
      zrodlo: czyPlikGoogle(nazwa) ? 'google' : 'wlasna',
    });
    return baza.dodajZasobDoBiblioteki({ ...opis, nazwa }, dane);
  }
  const { element, zasoby, dane } = importujOzdobnik(bajty);
  const mapa = new Map<string, string>();
  for (const opis of zasoby) {
    const id = await baza.dodajZasobDoBiblioteki(opis, dane.get(opis.id)!, { wewnetrzny: true });
    if (id !== opis.id) mapa.set(opis.id, id);
  }
  return baza.dodajElementDoBibliotekiUzytkownika({
    ...przepiszObrazElementu(element, mapa),
    nazwa,
  });
}

/** Wpis biblioteki w postaci dawnej paczki (plik obrazu/czcionki albo `.kartyrpg-ozdobnik`). */
export async function paczkaZWpisu(baza: BazaProjektow, wpis: WpisBiblioteki): Promise<Uint8Array> {
  if (wpis.rodzaj !== 'ozdobnik') {
    const bajty = await baza.bajtyBiblioteki(wpis.id);
    if (!bajty) throw new BladDanych(t('globalna.brakWpisu'));
    return bajty;
  }
  const element = { ...wpis.element!, id: wpis.id, nazwa: wpis.nazwa };
  const obraz = zasobyElementow([element])[0];
  if (obraz === undefined) return spakujOzdobnik(element);
  const [wpisObrazu] = await baza.wpisyBibliotekiPoId([obraz]);
  const opis = wpisObrazu && opisZWpisu(wpisObrazu);
  const dane = await baza.bajtyBiblioteki(obraz);
  if (!opis || !dane) throw new BladDanych(t('globalna.brakObrazu', { id: wpis.id, zasob: obraz }));
  return spakujOzdobnik(element, { opis, dane });
}

/**
 * Jednorazowe przeniesienie danych do biblioteki użytkownika (N8): wpisy biblioteki globalnej
 * (ozdobnik, obraz, czcionka), zasoby obrazów i czcionek (poza wbudowanymi) oraz ozdobniki
 * wszystkich projektów – z deduplikacją i przepisaniem odwołań.
 *
 * Idempotentna: przed startem kopiuje wpisy projektów do `kopiaMigracji` i czyta projekty z tej
 * kopii; bajty zasobów projektów i paczki globalne usuwa dopiero na końcu; dodawanie do
 * biblioteki deduplikuje po skrócie. Przerwana – przy następnym otwarciu bazy rusza od nowa.
 * Projekt, którego nie da się przenieść (uszkodzony), zostaje bez zmian, z własnymi zasobami.
 */
export async function migrujDoBiblioteki(db: BazaDexie, baza: BazaProjektow): Promise<void> {
  const stan = await db.meta.get(ZNACZNIK_MIGRACJI);
  if (stan?.wartosc === 'gotowa') return;
  if (!stan) {
    await db.transaction('rw', [db.projekty, db.kopiaMigracji, db.meta], async () => {
      await db.kopiaMigracji.clear();
      await db.kopiaMigracji.bulkPut(await db.projekty.toArray());
      await db.meta.put({ klucz: ZNACZNIK_MIGRACJI, wartosc: 'w-toku' });
    });
  }

  // Wpisy globalne: usuwane są tylko te, które udało się przenieść (reszta zostaje w starych
  // tabelach – `odczytajZBiblioteki` czyta je dalej).
  const globalne = (await db.bibliotekaGlobalna.toArray()).filter((w) => RODZAJE.has(w.rodzaj));
  const przeniesione: string[] = [];
  for (const w of globalne) {
    try {
      const paczka = await db.paczkiBiblioteki.get(w.id);
      if (!paczka) continue;
      const bajty = await migrujBajtyBazy(paczka.dane);
      await dodajPaczkeDoBiblioteki(baza, w.rodzaj as RodzajWpisuBiblioteki, w.nazwa, bajty);
      przeniesione.push(w.id);
    } catch (e) {
      console.warn(`Migracja biblioteki: pominięto wpis „${w.nazwa}”`, e);
    }
  }

  // Projekty: dokument podmieniany tylko wtedy, gdy nikt go nie zmienił od zrobienia kopii
  // (np. druga karta po zakończonej migracji); bajty sprząta się tylko w przeniesionych.
  const zmigrowane: string[] = [];
  for (const kopia of await db.kopiaMigracji.toArray()) {
    try {
      const projekt = przygotujProjekt(kopia.projekt);
      const wiersze = await db.zasoby.where('projektId').equals(kopia.id).toArray();
      const dane: DaneZasobow = new Map();
      for (const w of wiersze) dane.set(w.id, await migrujBajtyBazy(w.dane));
      const { projekt: dokument } = await baza.przeniesDoBiblioteki(projekt, (id) => dane.get(id), {
        nowe: true,
      });
      const podmieniony = await db.transaction('rw', db.projekty, async () => {
        const obecny = await db.projekty.get(kopia.id);
        if (!obecny || obecny.zmieniono !== kopia.zmieniono) return false;
        await db.projekty.put({ ...obecny, projekt: dokument });
        return true;
      });
      if (podmieniony) zmigrowane.push(kopia.id);
    } catch (e) {
      console.warn(`Migracja biblioteki: projekt „${kopia.id}” zostaje bez zmian`, e);
    }
  }

  await db.transaction(
    'rw',
    [db.projekty, db.zasoby, db.bibliotekaGlobalna, db.paczkiBiblioteki, db.kopiaMigracji, db.meta],
    async () => {
      for (const id of zmigrowane) {
        const w = await db.projekty.get(id);
        if (!w) continue;
        const opisane = new Set(w.projekt.zasoby.map((z) => z.id));
        await db.zasoby
          .where('projektId')
          .equals(id)
          .filter((z) => !opisane.has(z.id))
          .delete();
      }
      await db.bibliotekaGlobalna.bulkDelete(przeniesione);
      await db.paczkiBiblioteki.bulkDelete(przeniesione);
      await db.kopiaMigracji.clear();
      await db.meta.put({ klucz: ZNACZNIK_MIGRACJI, wartosc: 'gotowa' });
    },
  );
}
