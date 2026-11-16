import Dexie, { type EntityTable } from 'dexie';
import { t } from '../i18n';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { BladDanych, przygotujProjekt } from './schemat';

interface WpisZasobu {
  projektId: string;
  id: string;
  dane: Blob;
}

interface WpisProjektu {
  id: string;
  zmieniono: string;
  /** Projekt jako obiekt – bez bajtów zasobów (te są w osobnej tabeli jako Blob). */
  projekt: Projekt;
}

export interface PodsumowanieProjektu {
  id: string;
  nazwa: string;
  zmieniono: string;
}

class BazaDexie extends Dexie {
  projekty!: EntityTable<WpisProjektu, 'id'>;
  zasoby!: Dexie.Table<WpisZasobu, [string, string]>;

  constructor(nazwa: string) {
    super(nazwa);
    // Wersja Dexie dotyczy struktury tabel; wersja schematu projektu jest w `projekt.wersja`
    // i migrowana przy odczycie.
    this.version(1).stores({
      projekty: 'id, zmieniono',
      zasoby: '[projektId+id], projektId',
    });
  }
}

/** Projekty zapisane lokalnie w IndexedDB. Zasoby binarne trzymane jako Blob. */
export class BazaProjektow {
  private readonly db: BazaDexie;

  constructor(nazwa = 'karty-rpg') {
    this.db = new BazaDexie(nazwa);
  }

  async lista(): Promise<PodsumowanieProjektu[]> {
    const wpisy = await this.db.projekty.orderBy('zmieniono').reverse().toArray();
    return wpisy.map((w) => ({ id: w.id, nazwa: w.projekt.nazwa, zmieniono: w.zmieniono }));
  }

  async istnieje(id: string): Promise<boolean> {
    return (await this.db.projekty.where('id').equals(id).count()) > 0;
  }

  /**
   * Zapisuje projekt (po walidacji – do bazy nie trafi projekt, którego nie da się otworzyć).
   * Z `zasoby` – zastępuje wszystkie zasoby projektu (każdy opisany zasób musi mieć bajty);
   * bez – zmienia tylko dokument projektu (np. edycja karty), a każdy opisany zasób musi już
   * być w bazie. Nieużywane Bloby są usuwane.
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
            dane: new Blob([zasoby.get(id) as Uint8Array<ArrayBuffer>]),
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
    for (const w of wpisy) zasoby.set(w.id, new Uint8Array(await w.dane.arrayBuffer()));
    for (const opis of projekt.zasoby) {
      if (!zasoby.has(opis.id)) throw new BladDanych(t('dane.brakZasobu', { id: opis.id }));
    }
    return { projekt, zasoby };
  }

  async usun(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.projekty, this.db.zasoby], async () => {
      await this.db.zasoby.where('projektId').equals(id).delete();
      await this.db.projekty.delete(id);
    });
  }

  zamknij(): void {
    this.db.close();
  }
}
