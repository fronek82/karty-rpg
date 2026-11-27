import Dexie, { type EntityTable } from 'dexie';
import { t } from '../i18n';
import type { PresetUkladu } from '../model/arkusz';
import {
  WERSJA_SCHEMATU,
  type DaneZasobow,
  type OpisZasobu,
  type Projekt,
  type ZrodloCzcionki,
} from '../model/projekt';
import {
  kluczTresciSzablonu,
  type Rewers,
  type Szablon,
  type WariantCzcionki,
} from '../model/szablon';
import type { ElementOzdobny } from '../ozdobniki/typy';
import {
  elementyProjektu,
  liczbaTelZElementem,
  unikalneIdElementu,
  zasobyElementow,
  zasobyObrazowSzablonu,
} from './biblioteka';
import {
  MAKS_SZABLONOW_BIBLIOTEKI,
  oczyscRewersDoBiblioteki,
  oczyscSzablonDoBiblioteki,
  roleSzablonu,
  skrotSzablonu,
  unikalnaNazwaSzablonu,
  type RodzajSzablonu,
  type WpisSzablonu,
} from './bibliotekaSzablonow';
import {
  czyZasobProjektu,
  elementZWpisu,
  kluczCzcionki,
  MAKS_WPISOW_BIBLIOTEKI,
  elementyUzyteWDokumencie,
  obrazyRamek,
  obrazyUzyteWDokumencie,
  opisZWpisu,
  przepiszObrazElementu,
  przepiszZasobyProjektu,
  skrotBajtow,
  skrotElementu,
  type RodzajWpisuBiblioteki,
  type WpisBiblioteki,
} from './bibliotekaUzytkownika';
import { unikalneId } from './czcionki';
import {
  BladDanych,
  migrujBajtyBazy,
  presetUkladu,
  przygotujProjekt,
  type BajtyWBazie,
} from './schemat';

interface WpisZasobu {
  projektId: string;
  id: string;
  dane: BajtyWBazie;
}

interface WpisProjektu {
  id: string;
  zmieniono: string;
  /** Projekt jako obiekt. Bajty zasobów są w osobnej tabeli. */
  projekt: Projekt;
  /**
   * Projekt usunięty z „Moich projektów”, który przechowuje już tylko swoje szablony awersów
   * i rewersy (widoczne dalej w „Moich szablonach”). Bez kart i niewidoczny na liście projektów.
   */
  tylkoSzablony?: boolean;
}

/** Czy projekt ma szablony widoczne w „Moich szablonach” (niepuste awersy własne lub rewersy). */
function maSzablonyDoZachowania(p: Projekt): boolean {
  const wlasny = !p.pakiet || p.pakiet === 'wlasne';
  return (
    (p.rewersy?.length ?? 0) > 0 || (wlasny && p.szablony.some((s) => s.korzen.dzieci.length > 0))
  );
}

/**
 * Bez obrazów, których nie używa żaden szablon, rewers, podkład ani ozdobnik projektu (np. ilustracje
 * usuniętych kart). Czcionki zostają.
 */
function bezNieuzywanychObrazow(p: Projekt): Projekt {
  const elementy = elementyProjektu(p);
  const uzyte = new Set([
    ...zasobyElementow(elementy),
    ...[...p.szablony, ...(p.rewersy ?? [])].flatMap((s) => zasobyObrazowSzablonu(s, elementy)),
    ...p.szablony.flatMap((s) => (s.podklad ? [s.podklad.zasob] : [])),
  ]);
  return { ...p, zasoby: p.zasoby.filter((z) => z.rodzaj !== 'obraz' || uzyte.has(z.id)) };
}

/** Projekt bez kart (talie puste, kartki bez przypięć i kolejności) – zostają szablony i rewersy. */
function bezKart(p: Projekt): Projekt {
  return {
    ...p,
    zmieniono: new Date().toISOString(),
    talie: p.talie.map(({ grupy: _grupy, ...tl }) => {
      void _grupy;
      return { ...tl, karty: [] };
    }),
    arkusze: p.arkusze.map(
      ({ kolejnosc: _k, przypiete: _p, naglowki: _n, liczbaStron: _l, ...a }) => {
        void [_k, _p, _n, _l];
        return a;
      },
    ),
  };
}

export interface PodsumowanieProjektu {
  id: string;
  nazwa: string;
  zmieniono: string;
  liczbaKart: number;
  liczbaStron: number;
  pakiet?: string;
  /** Czy projekt reprezentuje awers (talię/arkusz) czy samodzielny rewers. */
  typStrony?: 'awers' | 'rewers';
  /** Identyfikator rewersu otwieranego domyślnie dla samodzielnego projektu rewersowego. */
  rewersId?: string;
  /** Identyfikator szablonu otwieranego w edytorze szablonu dla projektu własnego (awers). */
  szablonId?: string;
  /** Pierwszy niepusty szablon awersu w projekcie (do podglądu Awers + Rewers). */
  aktywnySzablonId?: string;
  /** Aktywny rewers przypisany w talii, szablonie lub karcie (do podglądu Awers + Rewers). */
  aktywnyRewersId?: string;
  /** Wymiary karty (mm) z aktywnego szablonu lub rewersu – do etykiety na kafelku startowym. */
  wymiary?: { szer: number; wys: number };
}

/** Stabilny klucz miniatury SVG konkretnego rewersu w tabeli `miniatury`. */
export const kluczMiniaturyRewersu = (projektId: string, rewersId: string): string =>
  `rewers:${projektId}:${rewersId}`;

/** Stabilny klucz miniatury SVG pojedynczego szablonu awersu w tabeli `miniatury`. */
export const kluczMiniaturySzablonu = (projektId: string, szablonId: string): string =>
  `szablon:${projektId}:${szablonId}`;

/**
 * Rozpoznaje samodzielny projekt rewersowy utworzony przez „Nowy szablon → Rewers”
 * (bez pakietu, z pustym szablonem awersu i co najmniej jednym rewersem).
 */
export function czyProjektRewersowy(projekt: Projekt): boolean {
  return (
    (!projekt.pakiet || projekt.pakiet === 'wlasne') &&
    (projekt.rewersy?.length ?? 0) > 0 &&
    projekt.szablony.length === 1 &&
    projekt.szablony[0]!.korzen.dzieci.length === 0 &&
    projekt.talie.every((t) => t.karty.length === 0)
  );
}

/** Kopia wpisów projektów z bazy (`BazaProjektow.migawka`) – nieprzezroczysta dla UI. */
export type MigawkaProjektow = {
  id: string;
  projekt: WpisProjektu;
  zasoby: WpisZasobu[];
  miniatury: WpisMiniatury[];
}[];

/** Miniatura należy do projektu: sam projekt albo jego szablon/rewers (`szablon:<id>:…`). */
function czyMiniaturaProjektu(klucz: string, projektId: string): boolean {
  return (
    klucz === projektId ||
    klucz.startsWith(`rewers:${projektId}:`) ||
    klucz.startsWith(`szablon:${projektId}:`)
  );
}

interface WpisMiniatury {
  id: string;
  /** SVG pierwszej strony (bez obrazów rastrowych – adresy blob: nie przeżywają sesji). */
  svg: string;
}

export interface WpisBibliotekiGlobalnej {
  id: string;
  rodzaj: 'szablon' | 'ozdobnik' | 'czcionka' | 'obraz' | 'rewers';
  nazwa: string;
}

export interface WpisRewersuZProjektu {
  projektId: string;
  projektNazwa?: string;
  zmieniono?: string;
  rewersId: string;
  nazwa: string;
  /** Klucz treści (`kluczTresciSzablonu`) – identyczne kopie mają ten sam. */
  kluczTresci: string;
  projektRewersowy?: boolean;
}

export interface WpisAwersuZProjektu {
  projektId: string;
  projektNazwa: string;
  zmieniono?: string;
  szablonId: string;
  szablonNazwa: string;
  /** Klucz treści (`kluczTresciSzablonu`) – identyczne kopie mają ten sam. */
  kluczTresci: string;
}

/** Szablon (przód albo tył) z wymiarami – do „Rozmiar jak w szablonie” w kreatorze. */
export interface WpisWymiarowSzablonu {
  strona: 'przod' | 'tyl';
  projektId: string;
  /** Id szablonu przodu albo rewersu w projekcie. */
  id: string;
  nazwa: string;
  szer: number;
  wys: number;
  /** Brak – tył bez własnych rogów (dopasowuje je do przodu). */
  promien?: number;
}

export interface WpisCzcionkiZProjektu {
  projektId: string;
  zasobId: string;
  nazwa: string;
  rodzina: string;
  wariant: WariantCzcionki;
  zrodlo: ZrodloCzcionki;
}

/** Przemapowania odwołań po zapisie (zasób lub element trafił na istniejący wpis biblioteki). */
export interface MapyZapisu {
  obrazy: Map<string, string>;
  elementy: Map<string, string>;
}

/** Rodzaje biblioteki globalnej obsługiwane przez jedną bibliotekę użytkownika (N8). */
const RODZAJE_BIBLIOTEKI = new Set<string>(['ozdobnik', 'obraz', 'czcionka']);

export class BazaDexie extends Dexie {
  biblioteka!: EntityTable<WpisBiblioteki, 'id'>;
  bajtyBiblioteki!: EntityTable<{ id: string; dane: BajtyWBazie }, 'id'>;
  szablony!: EntityTable<WpisSzablonu, 'id'>;
  meta!: EntityTable<{ klucz: string; wartosc: string }, 'klucz'>;
  kopiaMigracji!: EntityTable<WpisProjektu, 'id'>;
  bibliotekaGlobalna!: EntityTable<WpisBibliotekiGlobalnej, 'id'>;
  paczkiBiblioteki!: EntityTable<{ id: string; dane: BajtyWBazie }, 'id'>;
  projekty!: EntityTable<WpisProjektu, 'id'>;
  zasoby!: Dexie.Table<WpisZasobu, [string, string]>;
  miniatury!: EntityTable<WpisMiniatury, 'id'>;
  uklady!: EntityTable<PresetUkladu, 'id'>;

  constructor(nazwa: string) {
    super(nazwa);
    // Wersja Dexie dotyczy struktury tabel; wersja schematu projektu jest w `projekt.wersja`
    // i migrowana przy odczycie.
    this.version(1).stores({
      projekty: 'id, zmieniono',
      zasoby: '[projektId+id], projektId',
    });
    // Wersja 2: miniatury pierwszej strony na liście projektów.
    this.version(2).stores({
      projekty: 'id, zmieniono',
      zasoby: '[projektId+id], projektId',
      miniatury: 'id',
    });
    // Wersja 3: „Moje układy” arkuszy (presety użytkownika, wspólne dla projektów w przeglądarce).
    this.version(3).stores({
      projekty: 'id, zmieniono',
      zasoby: '[projektId+id], projektId',
      miniatury: 'id',
      uklady: 'id, nazwa',
    });
    // Metadane są odczytywane bez ładowania bajtów wszystkich paczek.
    this.version(4).stores({ bibliotekaGlobalna: 'id, rodzaj', paczkiBiblioteki: 'id' });
    // Wersja 5 (N8): jedna biblioteka zasobów użytkownika. Dane przenosi `migrujDoBiblioteki`
    // po otwarciu bazy (skróty i rozpakowanie nie mieszczą się w transakcji `upgrade`).
    this.version(5).stores({
      biblioteka: 'id, rodzaj, hash',
      bajtyBiblioteki: 'id',
      meta: 'klucz',
      kopiaMigracji: 'id',
    });
    // Wersja 6 (Plan S, S1): biblioteka szablonów i tyłów osobno od projektów.
    // Dane przenosi `migrujSzablonyDoBiblioteki` po otwarciu bazy.
    this.version(6).stores({
      szablony: 'id, rodzaj, zmieniono, hash',
    });
  }
}

export type { WpisProjektu, WpisSzablonu };

/** Projekty z zasobami i globalne paczki zapisane lokalnie w IndexedDB. */
export class BazaProjektow {
  private readonly db: BazaDexie;

  /** Bajty obrazów i czcionek biblioteki już odczytane (wspólne dla otwieranych projektów). */
  private readonly pamiecBajtow = new Map<string, Uint8Array>();

  /** Wpisy usunięte w tej sesji (z bajtami) – „Cofnij” przywraca je w tej samej postaci. */
  private readonly kosz = new Map<string, { wpis: WpisBiblioteki; dane?: Uint8Array }[]>();

  /** Skróty elementów z widoku (ten sam obiekt = ta sama treść) – zapis nie liczy ich na nowo. */
  private readonly skrotyElementow = new WeakMap<ElementOzdobny, string>();

  constructor(nazwa = 'karty-rpg', opcje: { bezMigracji?: boolean } = {}) {
    this.db = new BazaDexie(nazwa);
    if (opcje.bezMigracji) return;
    // Jednorazowe przeniesienie danych do biblioteki użytkownika (N8) i biblioteki szablonów (S1) –
    // operacje tego połączenia czekają na koniec. Migracja idzie przez osobne połączenie:
    // w `on('ready')` operacje po `await` na obietnice spoza Dexie straciłyby pierwszeństwo
    // i czekały na samo otwarcie. Błąd migracji nie blokuje aplikacji.
    this.db.on('ready', async () => {
      const pomocnicza = new BazaProjektow(nazwa, { bezMigracji: true });
      try {
        if ((await pomocnicza.db.meta.get('migracjaN8'))?.wartosc !== 'gotowa') {
          const { migrujDoBiblioteki } = await import('./migracjaBiblioteki');
          await migrujDoBiblioteki(pomocnicza.db, pomocnicza);
        }
        if ((await pomocnicza.db.meta.get('migracjaS1'))?.wartosc !== 'gotowa') {
          const { migrujSzablonyDoBiblioteki } = await import('./migracjaSzablonow');
          await migrujSzablonyDoBiblioteki(pomocnicza.db, pomocnicza);
        }
      } catch (e) {
        console.error('Migracja bazy danych nie powiodła się', e);
      } finally {
        pomocnicza.zamknij();
      }
    });
  }

  // -------------------------------------------------------------------------------------------
  // Biblioteka zasobów użytkownika (N8)

  /** Wpisy biblioteki (bez bajtów), opcjonalnie jednego rodzaju, alfabetycznie. */
  async wpisyBiblioteki(rodzaj?: RodzajWpisuBiblioteki): Promise<WpisBiblioteki[]> {
    const lista = rodzaj
      ? await this.db.biblioteka.where('rodzaj').equals(rodzaj).toArray()
      : await this.db.biblioteka.toArray();
    return lista.sort((a, b) => a.nazwa.localeCompare(b.nazwa));
  }

  /**
   * Projekty (bez wpisów „tylko szablony”, z nazwą) używające wpisu biblioteki: obraz – w dokumencie
   * albo jako obraz ramki 9-slice użytego ozdobnika; ozdobnik – w szablonie lub rewersie;
   * czcionka – rodzina w rolach albo w stylach szablonów. Do ostrzeżenia przy usuwaniu.
   */
  async projektyUzywajace(
    id: string,
  ): Promise<
    { id: string; nazwa: string; /** Szablony z elementem jako wzorem tła. */ tla?: number }[]
  > {
    const wpis = await this.db.biblioteka.get(id);
    if (!wpis) return [];
    const { czcionkiSzablonu } = await import('./archiwum');
    const ozdobniki =
      wpis.rodzaj === 'obraz'
        ? (await this.db.biblioteka.where('rodzaj').equals('ozdobnik').toArray()).filter(
            (w) => w.element && obrazyRamek([w.element]).has(id),
          )
        : [];
    const wynik: { id: string; nazwa: string; tla?: number }[] = [];
    for (const w of await this.db.projekty.toArray()) {
      if (w.tylkoSzablony) continue;
      const p = w.projekt;
      let uzywa = false;
      if (wpis.rodzaj === 'obraz') {
        const elementy = elementyUzyteWDokumencie(p);
        uzywa = obrazyUzyteWDokumencie(p).has(id) || ozdobniki.some((o) => elementy.has(o.id));
      } else if (wpis.rodzaj === 'ozdobnik') uzywa = elementyUzyteWDokumencie(p).has(id);
      else if (wpis.opis?.rodzaj === 'czcionka') {
        const rodzina = wpis.opis.rodzina;
        const nazwy = [...p.szablony, ...(p.rewersy ?? [])].flatMap(czcionkiSzablonu);
        uzywa =
          Object.values(p.role).includes(rodzina) ||
          nazwy.some((n) => (p.role[n] ?? n) === rodzina);
      }
      const tla = wpis.rodzaj === 'ozdobnik' ? liczbaTelZElementem(p, id) : 0;
      if (uzywa)
        wynik.push({
          id: w.id,
          nazwa: p.rewersy?.[0]?.nazwa && czyProjektRewersowy(p) ? p.rewersy[0].nazwa : p.nazwa,
          ...(tla ? { tla } : {}),
        });
    }
    return wynik;
  }

  /** Wpisy biblioteki o podanych id (brakujące pominięte). */
  async wpisyBibliotekiPoId(ids: readonly string[]): Promise<WpisBiblioteki[]> {
    return (await this.db.biblioteka.bulkGet([...ids])).filter(
      (w): w is WpisBiblioteki => w !== undefined,
    );
  }

  /** Bajty wpisu biblioteki (obraz, czcionka) albo undefined. */
  async bajtyBiblioteki(id: string): Promise<Uint8Array | undefined> {
    const z = this.pamiecBajtow.get(id);
    if (z) return z;
    const w = await this.db.bajtyBiblioteki.get(id);
    if (!w) return undefined;
    const dane = await migrujBajtyBazy(w.dane);
    this.pamiecBajtow.set(id, dane);
    return dane;
  }

  private async bajtyWielu(ids: readonly string[]): Promise<Map<string, Uint8Array>> {
    const wynik = new Map<string, Uint8Array>();
    const brak = ids.filter((id) => {
      const z = this.pamiecBajtow.get(id);
      if (z) wynik.set(id, z);
      return !z;
    });
    if (brak.length > 0) {
      const wpisy = await this.db.bajtyBiblioteki.bulkGet(brak);
      for (const w of wpisy) {
        if (!w) continue;
        const dane = await migrujBajtyBazy(w.dane);
        this.pamiecBajtow.set(w.id, dane);
        wynik.set(w.id, dane);
      }
    }
    return wynik;
  }

  private async sprawdzLimit(): Promise<void> {
    if ((await this.db.biblioteka.count()) >= MAKS_WPISOW_BIBLIOTEKI)
      throw new BladDanych(t('dane.zaDuzoWpisowBiblioteki', { limit: MAKS_WPISOW_BIBLIOTEKI }));
  }

  /**
   * Dodaje obraz lub czcionkę do biblioteki. Ten sam plik (skrót) – zwraca id istniejącego wpisu;
   * czcionka o tej samej rodzinie i wariancie – też istniejący wpis. Id zajęte przez inny wpis –
   * nowe unikalne id. Sprawdzenie i zapis w jednej transakcji (skrót liczony przed nią, bo
   * `crypto.subtle` zamyka transakcję Dexie). Zwraca id wpisu.
   */
  async dodajZasobDoBiblioteki(
    opis: OpisZasobu,
    dane: Uint8Array,
    opcje: { wewnetrzny?: boolean } = {},
  ): Promise<string> {
    const hash = await skrotBajtow(dane);
    const rodzaj = opis.rodzaj;
    const { biblioteka, bajtyBiblioteki } = this.db;
    const id = await this.db.transaction('rw', biblioteka, bajtyBiblioteki, async () => {
      // Czcionka: ten sam plik pod inną rodziną lub wariantem (np. nazwa z katalogu Google Fonts)
      // to osobny wpis – szablony odwołują się do czcionek po rodzinie i wariancie.
      const istniejacy = (await biblioteka.where('hash').equals(hash).toArray()).find(
        (w) =>
          w.rodzaj === rodzaj &&
          (opis.rodzaj !== 'czcionka' ||
            (w.opis?.rodzaj === 'czcionka' && kluczCzcionki(w.opis) === kluczCzcionki(opis))),
      );
      if (istniejacy) {
        if (istniejacy.wewnetrzny && !opcje.wewnetrzny)
          await biblioteka.update(istniejacy.id, { wewnetrzny: undefined });
        return istniejacy.id;
      }
      if (opis.rodzaj === 'czcionka') {
        const klucz = kluczCzcionki(opis);
        const ta = (await biblioteka.where('rodzaj').equals('czcionka').toArray()).find(
          (w) => w.opis?.rodzaj === 'czcionka' && kluczCzcionki(w.opis) === klucz,
        );
        if (ta) {
          console.info(
            `Biblioteka: czcionka ${opis.rodzina} (${opis.wariant}) już jest – bez zmian`,
          );
          return ta.id;
        }
      }
      await this.sprawdzLimit();
      const zajete = new Set((await biblioteka.toCollection().primaryKeys()) as string[]);
      const noweId = unikalneId(opis.id, zajete);
      await biblioteka.put({
        id: noweId,
        rodzaj,
        nazwa: opis.nazwa,
        hash,
        rozmiar: dane.length,
        dodano: new Date().toISOString(),
        opis: { ...opis, id: noweId },
        ...(opcje.wewnetrzny ? { wewnetrzny: true } : {}),
      });
      await bajtyBiblioteki.put({ id: noweId, dane });
      return noweId;
    });
    this.pamiecBajtow.set(id, dane);
    return id;
  }

  /**
   * Dodaje element ozdobny (obraz ramki 9-slice musi już być w bibliotece pod kanonicznym id).
   * Ta sama treść – id istniejącego wpisu; zajęte id – nowe unikalne. Zwraca id wpisu.
   */
  async dodajElementDoBibliotekiUzytkownika(e: ElementOzdobny): Promise<string> {
    const hash = await skrotElementu(e);
    const { biblioteka } = this.db;
    return this.db.transaction('rw', biblioteka, async () => {
      const istniejacy = (await biblioteka.where('hash').equals(hash).toArray()).find(
        (w) => w.rodzaj === 'ozdobnik',
      );
      if (istniejacy) return istniejacy.id;
      await this.sprawdzLimit();
      const zajete = new Set((await biblioteka.toCollection().primaryKeys()) as string[]);
      const id = unikalneIdElementu(e.id, zajete);
      const nazwa = e.nazwa ?? id;
      await biblioteka.put({
        id,
        rodzaj: 'ozdobnik',
        nazwa,
        hash,
        rozmiar: 0,
        dodano: new Date().toISOString(),
        element: { ...e, id, nazwa },
      });
      return id;
    });
  }

  /**
   * Przywraca usunięty wpis biblioteki dokładnie w tej samej postaci (to samo id), np. „Cofnij”.
   * Wpis o tym id już jest – bez zmian.
   */
  async przywrocWpisBiblioteki(wpis: WpisBiblioteki, dane?: Uint8Array): Promise<void> {
    const { biblioteka, bajtyBiblioteki } = this.db;
    await this.db.transaction('rw', biblioteka, bajtyBiblioteki, async () => {
      if (await biblioteka.get(wpis.id)) return;
      await biblioteka.put(wpis);
      if (dane) await bajtyBiblioteki.put({ id: wpis.id, dane });
    });
    if (dane) this.pamiecBajtow.set(wpis.id, dane);
  }

  /** Zmienia element ozdobny biblioteki (rodzaj, kolorowanie, ramka 9-slice, nazwa…). */
  async zmienElementBibliotekiUzytkownika(e: ElementOzdobny): Promise<void> {
    const wpis = await this.db.biblioteka.get(e.id);
    if (wpis?.rodzaj !== 'ozdobnik') throw new BladDanych(t('globalna.brakWpisu'));
    const nazwa = e.nazwa ?? wpis.nazwa;
    await this.db.biblioteka.put({
      ...wpis,
      nazwa,
      hash: await skrotElementu(e),
      element: { ...e, nazwa },
    });
  }

  /** Zmienia nazwę wpisu biblioteki. */
  async zmienNazweWBibliotece(id: string, nazwa: string): Promise<void> {
    const wpis = await this.db.biblioteka.get(id);
    if (!wpis) throw new BladDanych(t('globalna.brakWpisu'));
    await this.db.biblioteka.put({
      ...wpis,
      nazwa,
      ...(wpis.opis ? { opis: { ...wpis.opis, nazwa } } : {}),
      ...(wpis.element ? { element: { ...wpis.element, nazwa } } : {}),
    });
  }

  /** Usuwa wpis biblioteki (ozdobnik razem z obrazem swojej ramki 9-slice). */
  async usunZBibliotekiUzytkownika(id: string): Promise<void> {
    const wpis = await this.db.biblioteka.get(id);
    if (!wpis) return;
    const ids = [id];
    const ramka = wpis.element ? [...obrazyRamek([wpis.element])][0] : undefined;
    if (ramka !== undefined) {
      const inne = (await this.db.biblioteka.where('rodzaj').equals('ozdobnik').toArray()).some(
        (w) => w.id !== id && w.element && obrazyRamek([w.element]).has(ramka),
      );
      if (!inne && (await this.db.biblioteka.get(ramka))?.wewnetrzny) ids.push(ramka);
    }
    const usuniete = await this.wpisyBibliotekiPoId(ids);
    const doKosza = await Promise.all(
      usuniete.map(async (w) => {
        const dane = await this.bajtyBiblioteki(w.id);
        return { wpis: w, ...(dane ? { dane } : {}) };
      }),
    );
    await this.db.transaction('rw', this.db.biblioteka, this.db.bajtyBiblioteki, async () => {
      await this.db.biblioteka.bulkDelete(ids);
      await this.db.bajtyBiblioteki.bulkDelete(ids);
    });
    for (const x of ids) this.pamiecBajtow.delete(x);
    this.kosz.set(id, doKosza);
    // „Cofnij” dotyczy ostatnich usunięć – starsze wpisy kosza (z bajtami) nie zajmują pamięci.
    while (this.kosz.size > 20) this.kosz.delete(this.kosz.keys().next().value!);
  }

  /**
   * Przenosi zasoby i elementy z widoku projektu do biblioteki (z deduplikacją) i zwraca dokument
   * do zapisu: tylko czcionki wbudowane w `zasoby`, bez `biblioteka`, z przepisanymi odwołaniami.
   * `bajty` – bajty zasobów (np. wszystkie z pamięci edytora). Zasobu, którego nie ma
   * w bibliotece (np. usuniętego w innej karcie), nie przywraca, jeśli dokument go nie używa
   * i `nowe` nie jest ustawione (`nowe` – zapis po zmianie zasobów: wgrane pliki trafiają do
   * biblioteki, zanim zostaną użyte).
   */
  async przeniesDoBiblioteki(
    projekt: Projekt,
    bajty: (id: string) => Uint8Array | undefined,
    opcje: { nowe?: boolean } = {},
  ): Promise<{ projekt: Projekt; mapy: MapyZapisu }> {
    const mapy: MapyZapisu = { obrazy: new Map(), elementy: new Map() };
    const wBibliotece = new Map((await this.db.biblioteka.toArray()).map((w) => [w.id, w]));
    const elementy = elementyProjektu(projekt);
    const uzyteObrazy = obrazyUzyteWDokumencie(projekt);
    const uzyteElementy = elementyUzyteWDokumencie(projekt);
    const ramki = obrazyRamek(elementy.filter((e) => opcje.nowe || uzyteElementy.has(e.id)));
    for (const opis of projekt.zasoby) {
      if (czyZasobProjektu(opis)) continue;
      const w = wBibliotece.get(opis.id);
      const dane = bajty(opis.id);
      // To samo id i ta sama treść (bajty z pamięci biblioteki albo ten sam skrót) – bez zmian.
      if (w && w.rodzaj === opis.rodzaj) {
        if (!dane || dane === this.pamiecBajtow.get(opis.id)) continue;
        if ((await skrotBajtow(dane)) === w.hash) continue;
      }
      const potrzebny =
        opcje.nowe || uzyteObrazy.has(opis.id) || ramki.has(opis.id) || opis.rodzaj === 'czcionka';
      if (!w && !potrzebny) continue;
      if (!dane) {
        if (!w && !uzyteObrazy.has(opis.id) && !ramki.has(opis.id)) continue;
        throw new BladDanych(t('dane.brakZasobu', { id: opis.id }));
      }
      const id = await this.dodajZasobDoBiblioteki(opis, dane, {
        wewnetrzny: opis.rodzaj === 'obraz' && ramki.has(opis.id) && !uzyteObrazy.has(opis.id),
      });
      if (id !== opis.id && opis.rodzaj === 'obraz') mapy.obrazy.set(opis.id, id);
    }
    // Elementy: to samo id i ta sama treść – bez zmian; inna treść (np. z importu) – nowy wpis
    // (albo istniejący o tej treści). Edycje elementów idą wprost do biblioteki. Element, którego
    // nie ma w bibliotece, a dokument go nie używa (usunięty w innej karcie), nie wraca.
    for (const e0 of elementy) {
      const e = przepiszObrazElementu(e0, mapy.obrazy);
      const w = wBibliotece.get(e.id);
      if (!w && !opcje.nowe && !uzyteElementy.has(e.id)) continue;
      if (w?.rodzaj === 'ozdobnik') {
        let skrot = this.skrotyElementow.get(e);
        if (skrot === undefined) {
          skrot = await skrotElementu(e);
          this.skrotyElementow.set(e, skrot);
        }
        if (skrot === w.hash) continue;
      }
      const id = await this.dodajElementDoBibliotekiUzytkownika(e);
      if (id !== e.id) mapy.elementy.set(e.id, id);
    }
    const przepisany = przepiszZasobyProjektu(projekt, mapy.obrazy, mapy.elementy);
    const { biblioteka: _b, ...bez } = przepisany;
    void _b;
    return { projekt: { ...bez, zasoby: bez.zasoby.filter(czyZasobProjektu) }, mapy };
  }

  /**
   * Widok projektu do edycji: zasoby projektu (czcionki wbudowane) + obrazy i czcionki biblioteki,
   * ozdobniki biblioteki jako `biblioteka.ozdobniki`. Wpisy kolidujące z zasobami projektu
   * (to samo id albo ta sama rodzina i wariant czcionki) są pomijane.
   */
  private async widokProjektu(
    zapisany: Projekt,
    dane: DaneZasobow,
  ): Promise<{ projekt: Projekt; zasoby: DaneZasobow }> {
    const wpisy = await this.db.biblioteka.toArray();
    const ids = new Set(zapisany.zasoby.map((z) => z.id));
    const czcionki = new Set(
      zapisany.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [kluczCzcionki(z)] : [])),
    );
    const opisy: OpisZasobu[] = [];
    for (const w of wpisy) {
      const opis = opisZWpisu(w);
      if (!opis || ids.has(opis.id)) continue;
      if (opis.rodzaj === 'czcionka' && czcionki.has(kluczCzcionki(opis))) continue;
      opisy.push(opis);
    }
    const bajty = await this.bajtyWielu(opisy.map((o) => o.id));
    const zasoby: DaneZasobow = new Map(dane);
    const dostepne = opisy.filter((o) => bajty.has(o.id));
    for (const o of dostepne) zasoby.set(o.id, bajty.get(o.id)!);
    const wlasne = elementyProjektu(zapisany);
    const idWlasnych = new Set(wlasne.map((e) => e.id));
    const elementy = [
      ...wlasne,
      ...wpisy.flatMap((w) => {
        const e = elementZWpisu(w);
        if (!e || idWlasnych.has(e.id)) return [];
        this.skrotyElementow.set(e, w.hash);
        return [e];
      }),
    ];
    const { biblioteka: _b, ...bez } = zapisany;
    void _b;
    const projekt: Projekt = {
      ...bez,
      zasoby: [...zapisany.zasoby, ...dostepne],
      ...(elementy.length > 0 ? { biblioteka: { ozdobniki: elementy } } : {}),
    };
    return { projekt, zasoby };
  }

  async lista(): Promise<PodsumowanieProjektu[]> {
    const wpisy = (await this.db.projekty.orderBy('zmieniono').reverse().toArray()).filter(
      (w) => !w.tylkoSzablony,
    );
    return wpisy.map((w) => {
      const rewersowy = czyProjektRewersowy(w.projekt);
      const pierwszyRewers = rewersowy ? w.projekt.rewersy?.[0] : undefined;
      const rewersyIds = new Set((w.projekt.rewersy ?? []).map((r) => r.id));
      const pierwszaKarta = w.projekt.talie.flatMap((tl) => tl.karty)[0];
      const niepustySzablon =
        (pierwszaKarta
          ? w.projekt.szablony.find(
              (s) => s.id === pierwszaKarta.szablonId && s.korzen.dzieci.length > 0,
            )
          : undefined) ?? w.projekt.szablony.find((s) => s.korzen.dzieci.length > 0);
      const znajdzAktywnyRewers = (): string | undefined => {
        if (pierwszyRewers) return pierwszyRewers.id;
        for (const tl of w.projekt.talie) {
          if (typeof tl.rewersId === 'string' && rewersyIds.has(tl.rewersId)) return tl.rewersId;
        }
        for (const s of w.projekt.szablony) {
          if (typeof s.rewersId === 'string' && rewersyIds.has(s.rewersId)) return s.rewersId;
        }
        for (const tl of w.projekt.talie) {
          for (const k of tl.karty) {
            if (typeof k.rewersId === 'string' && rewersyIds.has(k.rewersId)) return k.rewersId;
          }
        }
        return undefined;
      };
      const aktywnyRewersId = znajdzAktywnyRewers();
      const zrodloWymiaru = pierwszyRewers ?? niepustySzablon ?? w.projekt.szablony[0];
      const r = zrodloWymiaru?.rozmiar;
      const wymiary = r
        ? r.tryb === 'sloty'
          ? {
              szer: Math.round(r.slot.szerokosc * r.kolumny),
              wys: Math.round(r.slot.wysokosc * r.rzedy),
            }
          : {
              szer: Math.round(r.szerokosc),
              wys: Math.round(r.wysokosc),
            }
        : undefined;
      return {
        id: w.id,
        nazwa: pierwszyRewers?.nazwa || w.projekt.nazwa,
        zmieniono: w.zmieniono,
        liczbaKart: w.projekt.talie.reduce(
          (s, t) => s + t.karty.reduce((a, k) => a + k.ilosc, 0),
          0,
        ),
        liczbaStron: w.projekt.arkusze.reduce(
          (s, a) =>
            s +
            // Mieszane rozmiary: liczba stron wychodzi z układu pasów (wymaga czcionek) – tu minimum 1.
            (a.ustawienia.rozmiary === 'mieszane'
              ? 1
              : Math.max(
                  1,
                  a.liczbaStron ?? 1,
                  ...(a.przypiete ?? []).map((x) => (x.strona ?? 0) + 1),
                )),
          0,
        ),
        ...(pierwszyRewers ? { typStrony: 'rewers' as const, rewersId: pierwszyRewers.id } : {}),
        ...(w.projekt.pakiet === 'wlasne' && !rewersowy && w.projekt.szablony[0]
          ? { szablonId: w.projekt.szablony[0].id }
          : {}),
        ...(niepustySzablon ? { aktywnySzablonId: niepustySzablon.id } : {}),
        ...(aktywnyRewersId ? { aktywnyRewersId } : {}),
        ...(w.projekt.pakiet ? { pakiet: w.projekt.pakiet } : {}),
        ...(wymiary ? { wymiary } : {}),
      };
    });
  }

  async zapiszMiniature(id: string, svg: string): Promise<void> {
    await this.db.miniatury.put({ id, svg });
  }

  async usunMiniature(id: string): Promise<void> {
    await this.db.miniatury.delete(id);
  }

  async miniatury(): Promise<Map<string, string>> {
    return new Map((await this.db.miniatury.toArray()).map((m) => [m.id, m.svg]));
  }

  /**
   * „Moje układy” arkuszy, alfabetycznie. Rekordy niezgodne ze schematem (uszkodzone, z nowszej
   * wersji aplikacji) są pomijane – preset trafia potem wprost do ustawień kartki.
   */
  async uklady(): Promise<PresetUkladu[]> {
    return (await this.db.uklady.toArray())
      .filter((u) => presetUkladu.safeParse(u).success)
      .sort((a, b) => a.nazwa.localeCompare(b.nazwa));
  }

  async zapiszUklad(u: PresetUkladu): Promise<void> {
    await this.db.uklady.put(u);
  }

  async usunUklad(id: string): Promise<void> {
    await this.db.uklady.delete(id);
  }

  /**
   * Wpisy biblioteki globalnej. Ozdobniki, obrazy i czcionki pochodzą z biblioteki użytkownika
   * (N8; do czasu nowego UI ta sama postać co dawne paczki), szablony i rewersy – z paczek.
   */
  async bibliotekaGlobalna(
    rodzaj: WpisBibliotekiGlobalnej['rodzaj'],
  ): Promise<WpisBibliotekiGlobalnej[]> {
    if (RODZAJE_BIBLIOTEKI.has(rodzaj))
      return (await this.wpisyBiblioteki(rodzaj as RodzajWpisuBiblioteki))
        .filter((w) => !w.wewnetrzny)
        .map((w) => ({ id: w.id, rodzaj, nazwa: w.nazwa }));
    return this.db.bibliotekaGlobalna.where('rodzaj').equals(rodzaj).sortBy('nazwa');
  }

  async zapiszWBibliotece(
    rodzaj: WpisBibliotekiGlobalnej['rodzaj'],
    nazwa: string,
    bajty: Uint8Array,
    id: string = crypto.randomUUID(),
  ): Promise<string> {
    if (RODZAJE_BIBLIOTEKI.has(rodzaj)) {
      // „Cofnij” po usunięciu: ten sam wpis (to samo id, opis, bajty) wraca z kosza.
      const zKosza = this.kosz.get(id);
      if (!zKosza && bajty.length === 0) throw new BladDanych(t('globalna.brakWpisu'));
      if (zKosza) {
        for (const { wpis, dane } of zKosza) await this.przywrocWpisBiblioteki(wpis, dane);
        this.kosz.delete(id);
        return id;
      }
      const { dodajPaczkeDoBiblioteki } = await import('./migracjaBiblioteki');
      return dodajPaczkeDoBiblioteki(this, rodzaj as RodzajWpisuBiblioteki, nazwa, bajty);
    }
    const { bibliotekaGlobalna, paczkiBiblioteki } = this.db;
    await this.db.transaction('rw', bibliotekaGlobalna, paczkiBiblioteki, async () => {
      await bibliotekaGlobalna.put({ id, rodzaj, nazwa });
      await paczkiBiblioteki.put({ id, dane: bajty });
    });
    return id;
  }

  /** Lista rewersów zapisanych w innych projektach w tej przeglądarce (także starszych sprzed biblioteki). */
  async rewersyZProjektow(pomijajProjektId?: string): Promise<WpisRewersuZProjektu[]> {
    const wpisy = await this.db.projekty.orderBy('zmieniono').reverse().toArray();
    const wynik: WpisRewersuZProjektu[] = [];
    for (const w of wpisy) {
      if (pomijajProjektId && w.id === pomijajProjektId) continue;
      const projektRewersowy = czyProjektRewersowy(w.projekt);
      for (const r of w.projekt.rewersy ?? []) {
        wynik.push({
          projektId: w.id,
          projektNazwa: w.projekt.nazwa,
          zmieniono: w.zmieniono,
          rewersId: r.id,
          nazwa: r.nazwa,
          kluczTresci: kluczTresciSzablonu(r),
          projektRewersowy,
        });
      }
    }
    return wynik;
  }

  /**
   * Lista szablonów awersów z projektów własnych w tej przeglądarce. Pomija tylko identyczne kopie
   * (ten sam klucz treści) – szablony o tej samej nazwie, ale innej treści, zostają.
   */
  async szablonyAwersowZProjektow(
    pomijajProjektId?: string,
    pominTresci?: ReadonlySet<string>,
  ): Promise<WpisAwersuZProjektu[]> {
    const wpisy = await this.db.projekty.orderBy('zmieniono').reverse().toArray();
    const wynik: WpisAwersuZProjektu[] = [];
    const widzianeTresci = new Set<string>();
    for (const w of wpisy) {
      if (pomijajProjektId && w.id === pomijajProjektId) continue;
      if (w.projekt.pakiet && w.projekt.pakiet !== 'wlasne') continue;
      if (czyProjektRewersowy(w.projekt)) continue;
      for (const s of w.projekt.szablony) {
        if (s.korzen.dzieci.length === 0) continue;
        const kluczTresci = kluczTresciSzablonu(s);
        if (pominTresci?.has(kluczTresci) || widzianeTresci.has(kluczTresci)) continue;
        widzianeTresci.add(kluczTresci);
        wynik.push({
          projektId: w.id,
          projektNazwa: w.projekt.nazwa,
          zmieniono: w.zmieniono,
          szablonId: s.id,
          szablonNazwa: s.nazwa,
          kluczTresci,
        });
      }
    }
    return wynik;
  }

  /**
   * Wszystkie szablony przodów (w mm, z projektów własnych) i tyłów w przeglądarce z wymiarami –
   * także puste przody; bez pustego przodu projektu samego tyłu i bez identycznych kopii tyłów.
   * Przód kopiuje tylko wymiary i rogi, więc kopie przodu w wielu projektach (ta sama nazwa,
   * wymiary i rogi) są pokazywane raz – najnowsza.
   */
  async wymiarySzablonow(): Promise<WpisWymiarowSzablonu[]> {
    const wpisy = await this.db.projekty.orderBy('zmieniono').reverse().toArray();
    const przody: WpisWymiarowSzablonu[] = [];
    const tyly: WpisWymiarowSzablonu[] = [];
    const widzianePrzody = new Set<string>();
    const widzianeTyly = new Set<string>();
    for (const w of wpisy) {
      if (w.projekt.pakiet && w.projekt.pakiet !== 'wlasne') continue;
      if (!czyProjektRewersowy(w.projekt))
        for (const s of w.projekt.szablony) {
          if (s.rozmiar.tryb !== 'mm') continue;
          const promien = s.promienRogow ?? 0;
          const klucz = JSON.stringify([s.nazwa, s.rozmiar.szerokosc, s.rozmiar.wysokosc, promien]);
          if (widzianePrzody.has(klucz)) continue;
          widzianePrzody.add(klucz);
          przody.push({
            strona: 'przod',
            projektId: w.id,
            id: s.id,
            nazwa: s.nazwa,
            szer: s.rozmiar.szerokosc,
            wys: s.rozmiar.wysokosc,
            promien,
          });
        }
      for (const r of w.projekt.rewersy ?? []) {
        const klucz = kluczTresciSzablonu(r);
        if (widzianeTyly.has(klucz)) continue;
        widzianeTyly.add(klucz);
        tyly.push({
          strona: 'tyl',
          projektId: w.id,
          id: r.id,
          nazwa: r.nazwa,
          szer: r.rozmiar.szerokosc,
          wys: r.rozmiar.wysokosc,
          ...(r.promienRogow !== undefined ? { promien: r.promienRogow } : {}),
        });
      }
    }
    return [...przody, ...tyly];
  }

  /** Lista własnych i pobranych z Google Fonts czcionek zapisanych w innych projektach w przeglądarce. */
  async czcionkiZProjektow(pomijajProjektId?: string): Promise<WpisCzcionkiZProjektu[]> {
    const wpisy = await this.db.projekty.orderBy('zmieniono').reverse().toArray();
    const wynik: WpisCzcionkiZProjektu[] = [];
    for (const w of wpisy) {
      if (pomijajProjektId && w.id === pomijajProjektId) continue;
      for (const z of w.projekt.zasoby) {
        if (z.rodzaj !== 'czcionka' || z.zrodlo === 'wbudowana') continue;
        wynik.push({
          projektId: w.id,
          zasobId: z.id,
          nazwa: z.nazwa,
          rodzina: z.rodzina,
          wariant: z.wariant,
          zrodlo: z.zrodlo,
        });
      }
    }
    return wynik;
  }

  async odczytajZBiblioteki(id: string): Promise<Uint8Array> {
    const wpis = await this.db.biblioteka.get(id);
    if (wpis) {
      const { paczkaZWpisu } = await import('./migracjaBiblioteki');
      return paczkaZWpisu(this, wpis);
    }
    const paczka = await this.db.paczkiBiblioteki.get(id);
    if (!paczka) throw new BladDanych(t('globalna.brakWpisu'));
    return migrujBajtyBazy(paczka.dane);
  }

  async usunZBiblioteki(id: string): Promise<void> {
    if (await this.db.biblioteka.get(id)) return this.usunZBibliotekiUzytkownika(id);
    const { bibliotekaGlobalna, paczkiBiblioteki } = this.db;
    await this.db.transaction('rw', bibliotekaGlobalna, paczkiBiblioteki, async () => {
      await bibliotekaGlobalna.delete(id);
      await paczkiBiblioteki.delete(id);
    });
  }

  async istnieje(id: string): Promise<boolean> {
    return (await this.db.projekty.where('id').equals(id).count()) > 0;
  }

  /** Czy wpis to usunięty projekt, który przechowuje już tylko szablony i rewersy. */
  async czyTylkoSzablony(id: string): Promise<boolean> {
    return (await this.db.projekty.get(id))?.tylkoSzablony === true;
  }

  // -------------------------------------------------------------------------------------------
  // Biblioteka szablonów (Plan S, S1)

  /** Wpisy biblioteki szablonów (przody i/lub tyły), od ostatnio zmienianych. */
  async szablonyBiblioteki(rodzaj?: RodzajSzablonu): Promise<WpisSzablonu[]> {
    const lista = rodzaj
      ? await this.db.szablony.where('rodzaj').equals(rodzaj).toArray()
      : await this.db.szablony.toArray();
    return lista.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
  }

  /** Pojedynczy wpis biblioteki szablonów albo `undefined`. */
  async szablonBiblioteki(id: string): Promise<WpisSzablonu | undefined> {
    return this.db.szablony.get(id);
  }

  private async sprawdzLimitSzablonow(): Promise<void> {
    if ((await this.db.szablony.count()) >= MAKS_SZABLONOW_BIBLIOTEKI)
      throw new BladDanych(t('dane.zaDuzoSzablonow', { limit: MAKS_SZABLONOW_BIBLIOTEKI }));
  }

  /**
   * Dodaje szablon przodu do biblioteki szablonów. Przy identycznej treści (`hash`) zwraca
   * istniejący rekord (chyba że `bezDeduplikacji: true`, np. przy ręcznym duplikowaniu).
   * Powtórzona nazwa innego szablonu dostaje sufiks „(2)”, „(3)”…
   */
  async dodajSzablonDoBiblioteki(
    szablon: Szablon,
    roleProjektu: Record<string, string>,
    opcje: { zmieniono?: string; domyslnyRewersId?: string; bezDeduplikacji?: boolean } = {},
  ): Promise<{ id: string; hash: string; nowy: boolean }> {
    const hash = await skrotSzablonu(szablon);
    const role = roleSzablonu(szablon, roleProjektu);
    return this.db.transaction('rw', this.db.szablony, async () => {
      if (!opcje.bezDeduplikacji) {
        const istniejacy = (await this.db.szablony.where('hash').equals(hash).toArray()).find(
          (w) => w.rodzaj === 'awers',
        );
        if (istniejacy) {
          if (!istniejacy.domyslnyRewersId && opcje.domyslnyRewersId) {
            await this.db.szablony.put({
              ...istniejacy,
              domyslnyRewersId: opcje.domyslnyRewersId,
            });
          }
          return { id: istniejacy.id, hash: istniejacy.hash, nowy: false };
        }
      }
      await this.sprawdzLimitSzablonow();
      const obecne = await this.db.szablony.where('rodzaj').equals('awers').toArray();
      const nazwa = unikalnaNazwaSzablonu(szablon.nazwa, new Set(obecne.map((w) => w.nazwa)));
      const id = crypto.randomUUID();
      const zmieniono = opcje.zmieniono ?? new Date().toISOString();
      await this.db.szablony.put({
        id,
        rodzaj: 'awers',
        nazwa,
        zmieniono,
        hash,
        role,
        szablon: oczyscSzablonDoBiblioteki(szablon, id, nazwa),
        ...(opcje.domyslnyRewersId ? { domyslnyRewersId: opcje.domyslnyRewersId } : {}),
      });
      return { id, hash, nowy: true };
    });
  }

  /**
   * Dodaje tył (rewers) do biblioteki szablonów. Przy identycznej treści (`hash`) zwraca
   * istniejący rekord (chyba że `bezDeduplikacji: true`). Powtórzona nazwa dostaje sufiks „(2)”…
   */
  async dodajRewersDoBiblioteki(
    rewers: Rewers,
    roleProjektu: Record<string, string>,
    opcje: { zmieniono?: string; bezDeduplikacji?: boolean } = {},
  ): Promise<{ id: string; hash: string; nowy: boolean }> {
    const hash = await skrotSzablonu(rewers);
    const role = roleSzablonu(rewers, roleProjektu);
    return this.db.transaction('rw', this.db.szablony, async () => {
      if (!opcje.bezDeduplikacji) {
        const istniejacy = (await this.db.szablony.where('hash').equals(hash).toArray()).find(
          (w) => w.rodzaj === 'rewers',
        );
        if (istniejacy) return { id: istniejacy.id, hash: istniejacy.hash, nowy: false };
      }
      await this.sprawdzLimitSzablonow();
      const obecne = await this.db.szablony.where('rodzaj').equals('rewers').toArray();
      const nazwa = unikalnaNazwaSzablonu(rewers.nazwa, new Set(obecne.map((w) => w.nazwa)));
      const id = crypto.randomUUID();
      const zmieniono = opcje.zmieniono ?? new Date().toISOString();
      await this.db.szablony.put({
        id,
        rodzaj: 'rewers',
        nazwa,
        zmieniono,
        hash,
        role,
        rewers: oczyscRewersDoBiblioteki(rewers, id, nazwa),
      });
      return { id, hash, nowy: true };
    });
  }

  /** Zapisuje zmiany istniejącego wpisu biblioteki szablonów i przelicza jego `hash` oraz datę. */
  async zapiszSzablonWBibliotece(wpis: WpisSzablonu): Promise<WpisSzablonu> {
    const dokument = wpis.rodzaj === 'awers' ? wpis.szablon : wpis.rewers;
    if (!dokument) throw new BladDanych(t('dane.brakSzablonu', { id: wpis.id }));
    const nazwa = wpis.nazwa.trim() || dokument.nazwa.trim() || 'Szablon';
    const hash = await skrotSzablonu(dokument);
    const zmieniono = new Date().toISOString();
    const zapisany: WpisSzablonu =
      wpis.rodzaj === 'awers'
        ? {
            id: wpis.id,
            rodzaj: 'awers',
            nazwa,
            zmieniono,
            hash,
            role: roleSzablonu(wpis.szablon!, wpis.role),
            szablon: oczyscSzablonDoBiblioteki(wpis.szablon!, wpis.id, nazwa),
            ...(wpis.domyslnyRewersId ? { domyslnyRewersId: wpis.domyslnyRewersId } : {}),
          }
        : {
            id: wpis.id,
            rodzaj: 'rewers',
            nazwa,
            zmieniono,
            hash,
            role: roleSzablonu(wpis.rewers!, wpis.role),
            rewers: oczyscRewersDoBiblioteki(wpis.rewers!, wpis.id, nazwa),
          };
    await this.db.szablony.put(zapisany);
    return zapisany;
  }

  /** Usuwa wpis z biblioteki szablonów (zwraca usunięty rekord do „Cofnij”). */
  async usunSzablonZBiblioteki(id: string): Promise<WpisSzablonu | undefined> {
    const wpis = await this.db.szablony.get(id);
    if (!wpis) return undefined;
    await this.db.transaction('rw', [this.db.szablony, this.db.miniatury], async () => {
      await this.db.szablony.delete(id);
      await this.db.miniatury.delete(`bib-szablon:${id}`);
    });
    return wpis;
  }

  /** Przywraca usunięty wpis biblioteki szablonów (np. po kliknięciu „Cofnij”). */
  async przywrocSzablonWBibliotece(wpis: WpisSzablonu): Promise<void> {
    await this.db.szablony.put(wpis);
  }

  /** Projekty, które mają kopię danego szablonu lub tyłu (`zrodlo.id === id`). */
  async projektyZKopiaSzablonu(id: string): Promise<{ id: string; nazwa: string }[]> {
    const wynik: { id: string; nazwa: string }[] = [];
    for (const w of await this.db.projekty.toArray()) {
      if (w.tylkoSzablony) continue;
      const p = w.projekt;
      const ma =
        p.szablony.some((s) => s.zrodlo?.id === id) ||
        (p.rewersy ?? []).some((r) => r.zrodlo?.id === id);
      if (ma) wynik.push({ id: w.id, nazwa: p.nazwa });
    }
    return wynik;
  }

  /**
   * Rejestruje szablony i tyły projektu własnego w bibliotece szablonów (łączenie po `hash`,
   * sufiks przy zajętej nazwie) i wpisuje `zrodlo` w kopie w projekcie. Pakiety gier bez zmian.
   */
  async rejestrujSzablonyProjektuWBibliotece(projekt: Projekt): Promise<Projekt> {
    const { czyProjektWlasny } = await import('./wlasneKarty');
    if (!czyProjektWlasny(projekt)) return projekt;
    const rewersowy = czyProjektRewersowy(projekt);
    const mapaRewersow = new Map<string, { id: string; hash: string }>();
    const rewersy: Rewers[] = [];
    for (const r of projekt.rewersy ?? []) {
      const wynik = await this.dodajRewersDoBiblioteki(r, projekt.role, {
        zmieniono: projekt.zmieniono,
      });
      mapaRewersow.set(r.id, { id: wynik.id, hash: wynik.hash });
      rewersy.push({ ...r, zrodlo: { id: wynik.id, hash: wynik.hash } });
    }
    const szablony: Szablon[] = [];
    for (const s of projekt.szablony) {
      if (rewersowy) {
        szablony.push(s);
        continue;
      }
      const domyslnyRewersId =
        typeof s.rewersId === 'string' ? mapaRewersow.get(s.rewersId)?.id : undefined;
      const wynik = await this.dodajSzablonDoBiblioteki(s, projekt.role, {
        zmieniono: projekt.zmieniono,
        ...(domyslnyRewersId ? { domyslnyRewersId } : {}),
      });
      szablony.push({ ...s, zrodlo: { id: wynik.id, hash: wynik.hash } });
    }
    const { rewersy: _r, ...bez } = projekt;
    void _r;
    return {
      ...bez,
      szablony,
      ...(rewersy.length > 0 ? { rewersy } : {}),
    };
  }

  /**
   * Eksportuje pojedynczy szablon lub tył wprost z biblioteki szablonów do pliku `.kartyrpg-szablon`
   * (z użytymi obrazami, czcionkami i ozdobnikami z biblioteki użytkownika).
   */
  async eksportujSzablonZBiblioteki(id: string): Promise<{
    bajty: Uint8Array;
    ostrzezenia: string[];
  }> {
    const wpis = await this.db.szablony.get(id);
    if (!wpis) throw new BladDanych(t('dane.brakSzablonu', { id }));
    const { czcionkiSzablonu, eksportujRewers, eksportujSzablon } = await import('./archiwum');
    const wpisRewersu =
      wpis.rodzaj === 'awers' && wpis.domyslnyRewersId
        ? await this.db.szablony.get(wpis.domyslnyRewersId)
        : undefined;
    const domyslnyRewers = wpisRewersu?.rewers;
    const szablon =
      wpis.rodzaj === 'awers' && wpis.szablon
        ? {
            ...wpis.szablon,
            ...(domyslnyRewers ? { rewersId: domyslnyRewers.id } : {}),
          }
        : undefined;
    const rewers = wpis.rodzaj === 'rewers' ? wpis.rewers : domyslnyRewers;
    const teraz = wpis.zmieniono;
    const syntetyczny: Projekt = {
      wersja: WERSJA_SCHEMATU,
      id: `eksport-${wpis.id}`,
      nazwa: wpis.nazwa,
      utworzono: teraz,
      zmieniono: teraz,
      role: { ...(wpisRewersu?.role ?? {}), ...wpis.role },
      zasoby: [],
      szablony: szablon ? [szablon] : [],
      ...(rewers ? { rewersy: [rewers] } : {}),
      talie: [],
      arkusze: [],
    };
    const { projekt, zasoby } = await this.widokProjektu(syntetyczny, new Map());
    if (wpis.rodzaj === 'awers' && szablon) {
      return eksportujSzablon(projekt, zasoby, szablon.id);
    }
    if (wpis.rodzaj === 'rewers' && rewers) {
      const bajty = eksportujRewers(projekt, zasoby, rewers.id);
      const rodziny = new Set(czcionkiSzablonu(rewers).map((n) => projekt.role[n] ?? n));
      const ostrzezenia = [
        ...new Set(
          projekt.zasoby.flatMap((o) =>
            o.rodzaj === 'czcionka' && o.zrodlo === 'wlasna' && rodziny.has(o.rodzina)
              ? [t('dane.licencjaCzcionki', { rodzina: o.rodzina })]
              : [],
          ),
        ),
      ];
      return { bajty, ostrzezenia };
    }
    throw new BladDanych(t('dane.brakSzablonu', { id }));
  }

  /**
   * Importuje plik `.kartyrpg-szablon` (albo dawny `.kartyrpg-rewers`) bezpośrednio do biblioteki
   * szablonów; jego zasoby (obrazy, czcionki, ozdobniki) trafiają do biblioteki użytkownika.
   */
  async importujSzablonDoBiblioteki(
    bajty: Uint8Array,
    opcje: { jako?: RodzajSzablonu } = {},
  ): Promise<{
    id: string;
    rodzaj: RodzajSzablonu;
    hash: string;
    nowy: boolean;
    rewersId?: string;
  }> {
    const { odczytajPlikSzablonu, rewersZSzablonu, szablonZRewersu } = await import('./archiwum');
    const paczka = odczytajPlikSzablonu(bajty);
    const teraz = new Date().toISOString();
    let szablon = paczka.szablon;
    let rewers = paczka.rewers;
    if (opcje.jako === 'awers' && !szablon && rewers) {
      szablon = szablonZRewersu(rewers);
      rewers = undefined;
    } else if (opcje.jako === 'rewers') {
      if (!rewers && szablon) rewers = rewersZSzablonu(szablon);
      szablon = undefined;
    }
    // Przeniesienie zasobów i ozdobników paczki do biblioteki użytkownika z przepisaniem odwołań.
    const syntetyczny: Projekt = {
      wersja: WERSJA_SCHEMATU,
      id: `import-${crypto.randomUUID()}`,
      nazwa: szablon?.nazwa ?? rewers?.nazwa ?? 'Szablon',
      utworzono: teraz,
      zmieniono: teraz,
      role: paczka.role,
      zasoby: paczka.zasoby,
      szablony: szablon ? [szablon] : [],
      ...(rewers ? { rewersy: [rewers] } : {}),
      talie: [],
      arkusze: [],
      ...(paczka.biblioteka && paczka.biblioteka.length > 0
        ? { biblioteka: { ozdobniki: paczka.biblioteka } }
        : {}),
    };
    const { projekt: przepisany } = await this.przeniesDoBiblioteki(
      syntetyczny,
      (id) => paczka.dane.get(id),
      { nowe: true },
    );
    const nowySzablon = przepisany.szablony[0];
    const nowyRewers = przepisany.rewersy?.[0];
    let zapisanyRewers: { id: string; hash: string; nowy: boolean } | undefined;
    if (nowyRewers) {
      zapisanyRewers = await this.dodajRewersDoBiblioteki(nowyRewers, przepisany.role);
    }
    if (nowySzablon) {
      const wynik = await this.dodajSzablonDoBiblioteki(nowySzablon, przepisany.role, {
        ...(zapisanyRewers ? { domyslnyRewersId: zapisanyRewers.id } : {}),
      });
      return {
        ...wynik,
        rodzaj: 'awers',
        ...(zapisanyRewers ? { rewersId: zapisanyRewers.id } : {}),
      };
    }
    if (zapisanyRewers) {
      return { ...zapisanyRewers, rodzaj: 'rewers' };
    }
    throw new BladDanych(t('dane.pustyPlikSzablonu'));
  }

  /**
   * Zapisuje projekt (po walidacji – do bazy nie trafi projekt, którego nie da się otworzyć).
   * Obrazy, czcionki (poza wbudowanymi) i ozdobniki trafiają do biblioteki użytkownika.
   * Z `zasoby` – zmiana zasobów: zastępuje bajty zasobów projektu, a wszystkie zasoby widoku
   * (także jeszcze nieużyte) trafiają do biblioteki; bez – zmienia tylko dokument, a do biblioteki
   * wraca tylko to, czego dokument używa (`opcje.dane` – bajty z pamięci edytora).
   * Z `rejestrujSzablony` – szablony i tyły trafiają też do biblioteki szablonów (import `.kartyrpg`).
   * Wpis „tylko szablony” (po usunięciu projektu) zachowuje ten stan, dopóki projekt nie dostanie
   * znowu kart – wtedy wraca do „Moich projektów”. Zwraca przemapowania odwołań.
   */
  async zapisz(
    projekt: Projekt,
    zasoby?: DaneZasobow,
    opcje: { tylkoSzablony?: boolean; dane?: DaneZasobow; rejestrujSzablony?: boolean } = {},
  ): Promise<MapyZapisu> {
    przygotujProjekt(projekt);
    // Obrazy, czcionki (poza wbudowanymi) i ozdobniki należą do biblioteki użytkownika (N8).
    const przeniesiony = await this.przeniesDoBiblioteki(
      projekt,
      (id) => zasoby?.get(id) ?? opcje.dane?.get(id),
      { nowe: zasoby !== undefined },
    );
    const dokument = opcje.rejestrujSzablony
      ? await this.rejestrujSzablonyProjektuWBibliotece(przeniesiony.projekt)
      : przeniesiony.projekt;
    const opisane = new Set(dokument.zasoby.map((z) => z.id));
    if (zasoby) {
      for (const id of opisane) {
        if (!zasoby.has(id)) throw new BladDanych(t('dane.brakZasobu', { id }));
      }
    }
    const tabele = [this.db.projekty, this.db.zasoby];
    await this.db.transaction('rw', tabele, async () => {
      const wProjekcie = this.db.zasoby.where('projektId').equals(dokument.id);
      if (zasoby) {
        await wProjekcie.delete();
        await this.db.zasoby.bulkPut(
          [...opisane].map((id) => ({
            projektId: dokument.id,
            id,
            dane: zasoby.get(id)!,
          })),
        );
      } else {
        const wBazie = new Set((await wProjekcie.primaryKeys()).map(([, id]) => id));
        for (const id of opisane) {
          if (!wBazie.has(id)) throw new BladDanych(t('dane.brakZasobu', { id }));
        }
        const osierocone = [...wBazie].filter((id) => !opisane.has(id));
        await this.db.zasoby.bulkDelete(
          osierocone.map((id) => [dokument.id, id] as [string, string]),
        );
      }
      const poprzedni = await this.db.projekty.get(dokument.id);
      const maKarty = dokument.talie.some((tl) => tl.karty.length > 0);
      const tylkoSzablony = opcje.tylkoSzablony ?? (poprzedni?.tylkoSzablony === true && !maKarty);
      await this.db.projekty.put({
        id: dokument.id,
        zmieniono: dokument.zmieniono,
        projekt: dokument,
        ...(tylkoSzablony ? { tylkoSzablony } : {}),
      });
    });
    return przeniesiony.mapy;
  }

  /**
   * Wczytuje projekt z migracją i walidacją (dane w bazie mogą pochodzić ze starszej wersji).
   * Dokument i zasoby czytane w jednej transakcji (spójny stan przy zapisie z innej karty).
   * Wynik to widok z biblioteką użytkownika: obrazy, czcionki i ozdobniki biblioteki są
   * w `zasoby` i `biblioteka.ozdobniki` każdego projektu.
   */
  async wczytaj(id: string): Promise<{ projekt: Projekt; zasoby: DaneZasobow }> {
    const [wpis, wpisy] = await this.db.transaction('r', [this.db.projekty, this.db.zasoby], () =>
      Promise.all([
        this.db.projekty.get(id),
        this.db.zasoby.where('projektId').equals(id).toArray(),
      ]),
    );
    if (!wpis) throw new BladDanych(t('dane.brakProjektuWBazie', { id }));
    const projekt = przygotujProjekt(wpis.projekt);
    // Odczyt Blobów poza transakcją (await na nie-IDB zamknąłby transakcję Dexie).
    const zasoby: DaneZasobow = new Map();
    for (const w of wpisy) zasoby.set(w.id, await migrujBajtyBazy(w.dane));
    for (const opis of projekt.zasoby) {
      if (!zasoby.has(opis.id)) throw new BladDanych(t('dane.brakZasobu', { id: opis.id }));
    }
    return this.widokProjektu(projekt, zasoby);
  }

  /**
   * Usuwa projekt z „Moich projektów” bez usuwania jego szablonów awersów i rewersów (także tych,
   * które w nim powstały) – zostają w „Moich szablonach”. Znikają karty, ich rozmieszczenie
   * i miniatura projektu; projekt bez szablonów do zachowania jest usuwany w całości.
   */
  async usunProjekt(id: string): Promise<void> {
    const { projekt } = await this.wczytaj(id);
    if (!maSzablonyDoZachowania(projekt)) {
      await this.usun(id);
      return;
    }
    const bez = bezKart(projekt);
    try {
      await this.zapisz(bezNieuzywanychObrazow(bez), undefined, { tylkoSzablony: true });
    } catch {
      // Obraz jest jeszcze gdzieś używany (walidacja odrzuciła zapis) – zostawiamy wszystkie.
      await this.zapisz(bez, undefined, { tylkoSzablony: true });
    }
    await this.db.miniatury.delete(id);
  }

  /** Usuwa wpis „tylko szablony”, z którego usunięto już ostatni szablon i rewers. */
  async usunPustySchowek(id: string): Promise<void> {
    const wpis = await this.db.projekty.get(id);
    if (!wpis?.tylkoSzablony) return;
    const { projekt } = await this.wczytaj(id);
    if (!maSzablonyDoZachowania(projekt)) await this.usun(id);
  }

  /** Usuwa projekt w całości (z szablonami, zasobami i miniaturami). */
  async usun(id: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.projekty, this.db.zasoby, this.db.miniatury],
      async () => {
        await this.db.zasoby.where('projektId').equals(id).delete();
        await this.db.projekty.delete(id);
        await this.db.miniatury.delete(id);
        await this.db.miniatury.where('id').startsWith(`rewers:${id}:`).delete();
        await this.db.miniatury.where('id').startsWith(`szablon:${id}:`).delete();
      },
    );
  }

  /**
   * Surowa kopia wpisów projektów (dokument, bajty zasobów, miniatury projektu, szablonów
   * i rewersów) – do „Cofnij” po usunięciu. Projekty, których nie ma w bazie, są pomijane.
   */
  async migawka(ids: Iterable<string>): Promise<MigawkaProjektow> {
    const lista = [...new Set(ids)];
    return this.db.transaction(
      'r',
      [this.db.projekty, this.db.zasoby, this.db.miniatury],
      async () => {
        const wynik: MigawkaProjektow = [];
        for (const id of lista) {
          const projekt = await this.db.projekty.get(id);
          if (!projekt) continue;
          wynik.push({
            id,
            projekt,
            zasoby: await this.db.zasoby.where('projektId').equals(id).toArray(),
            miniatury: await this.db.miniatury
              .filter((m) => czyMiniaturaProjektu(m.id, id))
              .toArray(),
          });
        }
        return wynik;
      },
    );
  }

  /** Przywraca projekty z migawki dokładnie w stanie z chwili jej zrobienia. */
  async przywroc(migawka: MigawkaProjektow): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.projekty, this.db.zasoby, this.db.miniatury],
      async () => {
        for (const m of migawka) {
          await this.db.zasoby.where('projektId').equals(m.id).delete();
          await this.db.miniatury.filter((x) => czyMiniaturaProjektu(x.id, m.id)).delete();
          await this.db.projekty.put(m.projekt);
          await this.db.zasoby.bulkPut(m.zasoby);
          await this.db.miniatury.bulkPut(m.miniatury);
        }
      },
    );
  }

  zamknij(): void {
    this.db.close();
  }
}
