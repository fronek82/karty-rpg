import Dexie, { type EntityTable } from 'dexie';
import { t } from '../i18n';
import type { PresetUkladu } from '../model/arkusz';
import type { DaneZasobow, Projekt, ZrodloCzcionki } from '../model/projekt';
import { kluczTresciSzablonu, type WariantCzcionki } from '../model/szablon';
import { elementyProjektu, zasobyElementow, zasobyObrazowSzablonu } from './biblioteka';
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

class BazaDexie extends Dexie {
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
  }
}

/** Projekty z zasobami i globalne paczki zapisane lokalnie w IndexedDB. */
export class BazaProjektow {
  private readonly db: BazaDexie;

  constructor(nazwa = 'karty-rpg') {
    this.db = new BazaDexie(nazwa);
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

  async bibliotekaGlobalna(
    rodzaj: WpisBibliotekiGlobalnej['rodzaj'],
  ): Promise<WpisBibliotekiGlobalnej[]> {
    return this.db.bibliotekaGlobalna.where('rodzaj').equals(rodzaj).sortBy('nazwa');
  }

  async zapiszWBibliotece(
    rodzaj: WpisBibliotekiGlobalnej['rodzaj'],
    nazwa: string,
    bajty: Uint8Array,
    id: string = crypto.randomUUID(),
  ): Promise<void> {
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
    const paczka = await this.db.paczkiBiblioteki.get(id);
    if (!paczka) throw new BladDanych(t('globalna.brakWpisu'));
    return migrujBajtyBazy(paczka.dane);
  }

  async usunZBiblioteki(id: string): Promise<void> {
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
  ): Promise<void> {
    przygotujProjekt(projekt);
    const opisane = new Set(projekt.zasoby.map((z) => z.id));
    if (zasoby) {
      for (const id of opisane) {
        if (!zasoby.has(id)) throw new BladDanych(t('dane.brakZasobu', { id }));
      }
    }
    const tabele = [this.db.projekty, this.db.zasoby];
    await this.db.transaction('rw', tabele, async () => {
      const wProjekcie = this.db.zasoby.where('projektId').equals(projekt.id);
      if (zasoby) {
        await wProjekcie.delete();
        await this.db.zasoby.bulkPut(
          [...opisane].map((id) => ({
            projektId: projekt.id,
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
          osierocone.map((id) => [projekt.id, id] as [string, string]),
        );
      }
      const poprzedni = await this.db.projekty.get(projekt.id);
      const maKarty = projekt.talie.some((tl) => tl.karty.length > 0);
      const tylkoSzablony = opcje.tylkoSzablony ?? (poprzedni?.tylkoSzablony === true && !maKarty);
      await this.db.projekty.put({
        id: projekt.id,
        zmieniono: projekt.zmieniono,
        projekt,
        ...(tylkoSzablony ? { tylkoSzablony } : {}),
      });
    });
  }

  /**
   * Wczytuje projekt z migracją i walidacją (dane w bazie mogą pochodzić ze starszej wersji).
   * Dokument i zasoby czytane w jednej transakcji (spójny stan przy zapisie z innej karty).
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
    return { projekt, zasoby };
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

  zamknij(): void {
    this.db.close();
  }
}
