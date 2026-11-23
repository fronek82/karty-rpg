import Dexie, { type EntityTable } from 'dexie';
import { t } from '../i18n';
import type { PresetUkladu } from '../model/arkusz';
import type { DaneZasobow, OpisZasobu, Projekt, ZrodloCzcionki } from '../model/projekt';
import { kluczTresciSzablonu, type WariantCzcionki } from '../model/szablon';
import type { ElementOzdobny } from '../ozdobniki/typy';
import {
  elementyProjektu,
  unikalneIdElementu,
  zasobyElementow,
  zasobyObrazowSzablonu,
} from './biblioteka';
import {
  czyZasobProjektu,
  elementZWpisu,
  kluczCzcionki,
  MAKS_WPISOW_BIBLIOTEKI,
  obrazyRamek,
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
  }
}

export type { WpisProjektu };

/** Projekty z zasobami i globalne paczki zapisane lokalnie w IndexedDB. */
export class BazaProjektow {
  private readonly db: BazaDexie;

  /** Bajty obrazów i czcionek biblioteki już odczytane (wspólne dla otwieranych projektów). */
  private readonly pamiecBajtow = new Map<string, Uint8Array>();

  constructor(nazwa = 'karty-rpg', opcje: { bezMigracji?: boolean } = {}) {
    this.db = new BazaDexie(nazwa);
    if (opcje.bezMigracji) return;
    // Jednorazowe przeniesienie danych do biblioteki użytkownika – operacje tego połączenia
    // czekają na koniec. Migracja idzie przez osobne połączenie: w `on('ready')` operacje po
    // `await` na obietnice spoza Dexie straciłyby pierwszeństwo i czekały na samo otwarcie.
    this.db.on('ready', async () => {
      const pomocnicza = new BazaProjektow(nazwa, { bezMigracji: true });
      try {
        if ((await pomocnicza.db.meta.get('migracjaN8'))?.wartosc === 'gotowa') return;
        const { migrujDoBiblioteki } = await import('./migracjaBiblioteki');
        await migrujDoBiblioteki(pomocnicza.db, pomocnicza);
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
   * nowe unikalne id. Zwraca id wpisu.
   */
  async dodajZasobDoBiblioteki(
    opis: OpisZasobu,
    dane: Uint8Array,
    opcje: { wewnetrzny?: boolean } = {},
  ): Promise<string> {
    const hash = await skrotBajtow(dane);
    const rodzaj = opis.rodzaj;
    const takie = await this.db.biblioteka.where('hash').equals(hash).toArray();
    const istniejacy = takie.find((w) => w.rodzaj === rodzaj);
    if (istniejacy) {
      if (istniejacy.wewnetrzny && !opcje.wewnetrzny)
        await this.db.biblioteka.update(istniejacy.id, { wewnetrzny: undefined });
      return istniejacy.id;
    }
    if (opis.rodzaj === 'czcionka') {
      const klucz = kluczCzcionki(opis);
      const ta = (await this.db.biblioteka.where('rodzaj').equals('czcionka').toArray()).find(
        (w) => w.opis?.rodzaj === 'czcionka' && kluczCzcionki(w.opis) === klucz,
      );
      if (ta) return ta.id;
    }
    await this.sprawdzLimit();
    const zajete = new Set((await this.db.biblioteka.toCollection().primaryKeys()) as string[]);
    const id = unikalneId(opis.id, zajete);
    const wpis: WpisBiblioteki = {
      id,
      rodzaj,
      nazwa: opis.nazwa,
      hash,
      rozmiar: dane.length,
      dodano: new Date().toISOString(),
      opis: { ...opis, id },
      ...(opcje.wewnetrzny ? { wewnetrzny: true } : {}),
    };
    await this.db.transaction('rw', this.db.biblioteka, this.db.bajtyBiblioteki, async () => {
      await this.db.biblioteka.put(wpis);
      await this.db.bajtyBiblioteki.put({ id, dane });
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
    const takie = await this.db.biblioteka.where('hash').equals(hash).toArray();
    const istniejacy = takie.find((w) => w.rodzaj === 'ozdobnik');
    if (istniejacy) return istniejacy.id;
    await this.sprawdzLimit();
    const zajete = new Set((await this.db.biblioteka.toCollection().primaryKeys()) as string[]);
    const id = unikalneIdElementu(e.id, zajete);
    const nazwa = e.nazwa ?? id;
    await this.db.biblioteka.put({
      id,
      rodzaj: 'ozdobnik',
      nazwa,
      hash,
      rozmiar: 0,
      dodano: new Date().toISOString(),
      element: { ...e, id, nazwa },
    });
    return id;
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
    await this.db.transaction('rw', this.db.biblioteka, this.db.bajtyBiblioteki, async () => {
      await this.db.biblioteka.bulkDelete(ids);
      await this.db.bajtyBiblioteki.bulkDelete(ids);
    });
    for (const x of ids) this.pamiecBajtow.delete(x);
  }

  /**
   * Przenosi zasoby i elementy z widoku projektu do biblioteki (z deduplikacją) i zwraca dokument
   * do zapisu: tylko czcionki wbudowane w `zasoby`, bez `biblioteka`, z przepisanymi odwołaniami.
   * `bajty` – bajty zasobów, których jeszcze nie ma w bibliotece.
   */
  async przeniesDoBiblioteki(
    projekt: Projekt,
    bajty: (id: string) => Uint8Array | undefined,
  ): Promise<{ projekt: Projekt; mapy: MapyZapisu }> {
    const mapy: MapyZapisu = { obrazy: new Map(), elementy: new Map() };
    const wBibliotece = new Map((await this.db.biblioteka.toArray()).map((w) => [w.id, w]));
    const elementy = elementyProjektu(projekt);
    const ramki = obrazyRamek(elementy);
    for (const opis of projekt.zasoby) {
      if (czyZasobProjektu(opis)) continue;
      const w = wBibliotece.get(opis.id);
      const dane = bajty(opis.id);
      // To samo id i ta sama treść (bajty z pamięci biblioteki albo ten sam skrót) – bez zmian.
      if (w && w.rodzaj === opis.rodzaj) {
        if (!dane || dane === this.pamiecBajtow.get(opis.id)) continue;
        if ((await skrotBajtow(dane)) === w.hash) continue;
      }
      if (!dane) throw new BladDanych(t('dane.brakZasobu', { id: opis.id }));
      const id = await this.dodajZasobDoBiblioteki(opis, dane, {
        wewnetrzny: opis.rodzaj === 'obraz' && ramki.has(opis.id),
      });
      if (id !== opis.id && opis.rodzaj === 'obraz') mapy.obrazy.set(opis.id, id);
    }
    // Elementy: to samo id i ta sama treść – bez zmian; inna treść (np. z importu) – nowy wpis
    // (albo istniejący o tej treści). Edycje elementów idą wprost do biblioteki.
    for (const e0 of elementy) {
      const e = przepiszObrazElementu(e0, mapy.obrazy);
      const w = wBibliotece.get(e.id);
      if (w?.rodzaj === 'ozdobnik' && (await skrotElementu(e)) === w.hash) continue;
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
    const elementy = [
      ...elementyProjektu(zapisany),
      ...wpisy.flatMap((w) => {
        const e = elementZWpisu(w);
        return e && !elementyProjektu(zapisany).some((x) => x.id === e.id) ? [e] : [];
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
  ): Promise<void> {
    if (RODZAJE_BIBLIOTEKI.has(rodzaj)) {
      const { dodajPaczkeDoBiblioteki } = await import('./migracjaBiblioteki');
      await dodajPaczkeDoBiblioteki(this, rodzaj as RodzajWpisuBiblioteki, nazwa, bajty);
      return;
    }
    const { bibliotekaGlobalna, paczkiBiblioteki } = this.db;
    await this.db.transaction('rw', bibliotekaGlobalna, paczkiBiblioteki, async () => {
      await bibliotekaGlobalna.put({ id, rodzaj, nazwa });
      await paczkiBiblioteki.put({ id, dane: bajty });
    });
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

  /**
   * Zapisuje projekt (po walidacji – do bazy nie trafi projekt, którego nie da się otworzyć).
   * Z `zasoby` – zastępuje wszystkie zasoby projektu (każdy opisany zasób musi mieć bajty);
   * bez – zmienia tylko dokument projektu (np. edycja karty), a każdy opisany zasób musi już
   * być w bazie. Nieużywane zasoby są usuwane.
   */
  /**
   * Zapis projektu. Wpis „tylko szablony” (po usunięciu projektu) zachowuje ten stan, dopóki
   * projekt nie dostanie znowu kart – wtedy wraca do „Moich projektów”.
   */
  async zapisz(
    projekt: Projekt,
    zasoby?: DaneZasobow,
    opcje: { tylkoSzablony?: boolean } = {},
  ): Promise<MapyZapisu> {
    przygotujProjekt(projekt);
    // Obrazy, czcionki (poza wbudowanymi) i ozdobniki należą do biblioteki użytkownika (N8).
    const przeniesiony = await this.przeniesDoBiblioteki(projekt, (id) => zasoby?.get(id));
    const dokument = przeniesiony.projekt;
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
