import Dexie, { type EntityTable } from 'dexie';
import { t } from '../i18n';
import type { PresetUkladu } from '../model/arkusz';
import type { DaneZasobow, Projekt, ZrodloCzcionki } from '../model/projekt';
import type { WariantCzcionki } from '../model/szablon';
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
}

export interface PodsumowanieProjektu {
  id: string;
  nazwa: string;
  zmieniono: string;
  liczbaKart: number;
  liczbaStron: number;
  pakiet?: string;
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
  rewersId: string;
  nazwa: string;
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
    const wpisy = await this.db.projekty.orderBy('zmieniono').reverse().toArray();
    return wpisy.map((w) => ({
      id: w.id,
      nazwa: w.projekt.nazwa,
      zmieniono: w.zmieniono,
      liczbaKart: w.projekt.talie.reduce((s, t) => s + t.karty.reduce((a, k) => a + k.ilosc, 0), 0),
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
      ...(w.projekt.pakiet ? { pakiet: w.projekt.pakiet } : {}),
    }));
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
      for (const r of w.projekt.rewersy ?? []) {
        wynik.push({ projektId: w.id, rewersId: r.id, nazwa: r.nazwa });
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

  /**
   * Zapisuje projekt (po walidacji – do bazy nie trafi projekt, którego nie da się otworzyć).
   * Z `zasoby` – zastępuje wszystkie zasoby projektu (każdy opisany zasób musi mieć bajty);
   * bez – zmienia tylko dokument projektu (np. edycja karty), a każdy opisany zasób musi już
   * być w bazie. Nieużywane zasoby są usuwane.
   */
  async zapisz(projekt: Projekt, zasoby?: DaneZasobow): Promise<void> {
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
      await this.db.projekty.put({ id: projekt.id, zmieniono: projekt.zmieniono, projekt });
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

  async usun(id: string): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.projekty, this.db.zasoby, this.db.miniatury],
      async () => {
        await this.db.zasoby.where('projektId').equals(id).delete();
        await this.db.projekty.delete(id);
        await this.db.miniatury.delete(id);
      },
    );
  }

  zamknij(): void {
    this.db.close();
  }
}
