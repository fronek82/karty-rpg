import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cofnij, ponow, pustaHistoria, zapamietaj, type Historia } from '../dane/historia';
import { BladDanych, ostrzezeniaProjektu } from '../dane/schemat';
import { rejestrZProjektu } from '../dane/pakiet';
import { czyKartkaZnormalizowana, normalizujKartki } from '../druk/normalizacja';
import { t } from '../i18n';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { baza } from './baza';
import { zasobyProjektu, type ZasobyProjektu } from './zasobyProjektu';

export type StanZapisu =
  { stan: 'zapisano' } | { stan: 'zapisywanie' } | { stan: 'blad'; komunikat: string };

export interface ProjektWEdycji {
  projekt: Projekt;
  dane: DaneZasobow;
  zasoby: ZasobyProjektu;
  ostrzezenia: string[];
  zapis: StanZapisu;
  /**
   * Zmiana samego dokumentu (dane kart, układ) – zapis do bazy z opóźnieniem. `klucz` scala
   * serię zmian (np. pisanie w jednym polu) w jeden krok „Cofnij”.
   */
  zmien(f: (p: Projekt) => Projekt, opcje?: { klucz?: string }): void;
  cofnij(): void;
  ponow(): void;
  mozeCofnac: boolean;
  mozePonowic: boolean;
  /** Licznik zmian dokumentu (edycja, cofnięcie, ponowienie) – np. ważność „Cofnij” w komunikacie. */
  wersja: number;
  /**
   * Zmiana biblioteki zasobów (czcionki, obrazy). `f` dostaje NAJNOWSZY projekt i dane (nie te
   * z renderu), wynik od razu trafia do stanu, a zapis z bajtami rusza natychmiast. Obietnica
   * odrzucona, gdy `f` rzuci (stan bez zmian) albo zapis się nie uda (zmiany czekają na ponowienie).
   */
  zmienZZasobami(
    f: (p: Projekt, dane: DaneZasobow) => { projekt: Projekt; dane: DaneZasobow },
  ): Promise<void>;
}

export type StanProjektu =
  | { stan: 'wczytywanie' }
  | { stan: 'blad'; komunikat: string }
  | ({ stan: 'gotowy' } & ProjektWEdycji);

const OPOZNIENIE_ZAPISU = 500;

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/** Normalizacja do modelu kartki z czcionkami z biblioteki projektu (zapasowa jak w podglądzie). */
function normalizujWczytany(p: Projekt, dane: DaneZasobow): Projekt {
  const { rejestr } = rejestrZProjektu(p, dane);
  const rodziny = rejestr.nazwyRodzin;
  rejestr.ustawZapasowa(p.role.tresc && rodziny.includes(p.role.tresc) ? p.role.tresc : rodziny[0]);
  const obrazy = new Map(
    p.zasoby.flatMap((z) => (z.rodzaj === 'obraz' ? [[z.id, z] as const] : [])),
  );
  return normalizujKartki(p, { czcionki: rejestr, obraz: (id) => obrazy.get(id) }).projekt;
}

/** Ostatni zaplanowany zapis dowolnego projektu – lista projektów czeka na niego przed odczytem. */
let ostatniZapis: Promise<void> = Promise.resolve();
export const poOstatnimZapisie = (): Promise<void> => ostatniZapis.catch(() => undefined);

interface Biezacy {
  id: string;
  projekt: Projekt;
  dane: DaneZasobow;
  /** Dokument zmieniony od ostatniego udanego zapisu. */
  brudny: boolean;
  /** Biblioteka zasobów zmieniona – następny zapis musi zawierać bajty. */
  zasobyBrudne: boolean;
}

/**
 * Projekt otwarty do edycji. Źródłem prawdy jest ref `biezacy` (zmiany liczone synchronicznie,
 * bez efektów ubocznych w updaterach stanu); stan Reacta tylko go odzwierciedla. Zapisy idą
 * po kolei (łańcuch obietnic); błąd zapisu zostawia flagi „brudny”, więc kolejna zmiana albo
 * zamknięcie projektu ponawia zapis, a przeglądarka ostrzega przy zamykaniu karty.
 */
export function useProjekt(id: string): StanProjektu {
  const [widok, ustawWidok] = useState<
    { id: string; projekt: Projekt; dane: DaneZasobow } | { id: string; blad: string }
  >();
  const [zasoby, ustawZasoby] = useState<ZasobyProjektu>();
  const [zapis, ustawZapis] = useState<StanZapisu>({ stan: 'zapisano' });
  const biezacy = useRef<Biezacy | undefined>(undefined);
  const historia = useRef<Historia<Projekt>>(pustaHistoria());
  const [wersja, ustawWersje] = useState(0);
  const [stanHistorii, ustawStanHistorii] = useState({ cofnij: false, ponow: false });
  const odswiezHistorie = () =>
    ustawStanHistorii({
      cofnij: historia.current.przeszle.length > 0,
      ponow: historia.current.przyszle.length > 0,
    });
  const zegar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const kolejka = useRef<Promise<void>>(Promise.resolve());

  const odswiez = () => {
    const b = biezacy.current;
    if (b) ustawWidok({ id: b.id, projekt: b.projekt, dane: b.dane });
  };

  /** Zapisuje bieżący stan (jeśli brudny). Obietnica odrzucona przy błędzie zapisu. */
  const zapiszTeraz = useCallback((): Promise<void> => {
    clearTimeout(zegar.current);
    const zadanie = kolejka.current.then(async () => {
      const b = biezacy.current;
      if (!b || !b.brudny) return;
      const { projekt, dane } = b;
      const zZasobami = b.zasobyBrudne;
      b.brudny = false;
      b.zasobyBrudne = false;
      try {
        await baza().zapisz(projekt, zZasobami ? dane : undefined);
        if (!biezacy.current?.brudny) ustawZapis({ stan: 'zapisano' });
      } catch (e) {
        // Zmiany czekają na ponowienie (kolejna edycja, zamknięcie projektu).
        b.brudny = true;
        b.zasobyBrudne ||= zZasobami;
        ustawZapis({ stan: 'blad', komunikat: komunikat(e) });
        throw e;
      }
    });
    kolejka.current = zadanie.catch(() => undefined);
    ostatniZapis = kolejka.current;
    return zadanie;
  }, []);

  useEffect(() => {
    let aktywny = true;
    baza()
      .wczytaj(id)
      .then(
        ({ projekt: wczytany, zasoby: dane }) => {
          if (!aktywny) return;
          // Projekt sprzed edytora kartki – normalizacja (wydruk bez zmian) i zapis.
          let projekt: Projekt;
          try {
            projekt = czyKartkaZnormalizowana(wczytany)
              ? wczytany
              : normalizujWczytany(wczytany, dane);
          } catch (e) {
            ustawWidok({ id, blad: t('kartka.bladNormalizacji', { szczegoly: komunikat(e) }) });
            return;
          }
          const brudny = projekt !== wczytany;
          biezacy.current = { id, projekt, dane, brudny, zasobyBrudne: false };
          ustawWidok({ id, projekt, dane });
          if (brudny) void zapiszTeraz().catch(() => undefined);
        },
        (e: unknown) => aktywny && ustawWidok({ id, blad: komunikat(e) }),
      );
    return () => {
      aktywny = false;
    };
  }, [id, zapiszTeraz]);

  // Zapis przy zamknięciu projektu; ostrzeżenie przeglądarki przy zamykaniu karty z niezapisanymi zmianami.
  useEffect(() => {
    const przedZamknieciem = (e: BeforeUnloadEvent) => {
      if (biezacy.current?.brudny) {
        void zapiszTeraz().catch(() => undefined);
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', przedZamknieciem);
    return () => {
      window.removeEventListener('beforeunload', przedZamknieciem);
      void zapiszTeraz().catch(() => undefined);
    };
  }, [zapiszTeraz]);

  /** Ustawia nowy dokument (z edycji, cofnięcia albo normalizacji) i planuje zapis. */
  const ustawDokument = useCallback(
    (nowy: Projekt) => {
      const b = biezacy.current;
      if (!b) return;
      ustawWersje((w) => w + 1);
      b.projekt = nowy;
      b.brudny = true;
      odswiez();
      ustawZapis({ stan: 'zapisywanie' });
      clearTimeout(zegar.current);
      zegar.current = setTimeout(
        () => void zapiszTeraz().catch(() => undefined),
        OPOZNIENIE_ZAPISU,
      );
    },
    [zapiszTeraz],
  );

  const zmien = useCallback(
    (f: (p: Projekt) => Projekt, opcje: { klucz?: string } = {}) => {
      const b = biezacy.current;
      if (!b) return;
      const nowy = f(b.projekt);
      if (nowy === b.projekt) return;
      historia.current = zapamietaj(historia.current, b.projekt, opcje);
      odswiezHistorie();
      ustawDokument(nowy);
    },
    [ustawDokument],
  );

  const cofnijZmiane = useCallback(() => {
    const b = biezacy.current;
    const w = b && cofnij(historia.current, b.projekt);
    if (!w || !b) return;
    historia.current = w.historia;
    // Zmiana biblioteki – zapis razem z bajtami (trzymanymi w pamięci).
    if (w.stan.zasoby !== b.projekt.zasoby) b.zasobyBrudne = true;
    odswiezHistorie();
    ustawDokument(w.stan);
  }, [ustawDokument]);

  const ponowZmiane = useCallback(() => {
    const b = biezacy.current;
    const w = b && ponow(historia.current, b.projekt);
    if (!w || !b) return;
    historia.current = w.historia;
    // Zmiana biblioteki – zapis razem z bajtami (trzymanymi w pamięci).
    if (w.stan.zasoby !== b.projekt.zasoby) b.zasobyBrudne = true;
    odswiezHistorie();
    ustawDokument(w.stan);
  }, [ustawDokument]);

  const zmienZZasobami = useCallback<ProjektWEdycji['zmienZZasobami']>(
    async (f) => {
      const b = biezacy.current;
      if (!b) return;
      const wynik = f(b.projekt, b.dane); // błąd z `f` – stan bez zmian
      // Historia zostaje: bajty usuniętych zasobów zostają w pamięci (zapis bierze tylko opisane),
      // więc „Cofnij” może przywrócić zasób razem z jego bajtami.
      historia.current = zapamietaj(historia.current, b.projekt);
      odswiezHistorie();
      ustawWersje((w) => w + 1);
      b.projekt = wynik.projekt;
      b.dane = new Map([...b.dane, ...wynik.dane]);
      b.brudny = true;
      b.zasobyBrudne = true;
      odswiez();
      ustawZapis({ stan: 'zapisywanie' });
      await zapiszTeraz();
    },
    [zapiszTeraz],
  );

  const gotowy = widok && widok.id === id && 'projekt' in widok ? widok : undefined;
  const projekt = gotowy?.projekt;
  const dane = gotowy?.dane;

  // Zasoby silnika (parsowanie czcionek, adresy blob:) tylko przy zmianie biblioteki lub szablonów;
  // role czcionek przypisywane do istniejącego rejestru (bez ponownego parsowania).
  const bibl = projekt?.zasoby;
  const biblioteka = projekt?.biblioteka;
  const szablony = projekt?.szablony;
  const projektRef = useRef(projekt);
  useEffect(() => {
    projektRef.current = projekt;
  });
  useEffect(() => {
    const p = projektRef.current;
    if (!bibl || !p || !dane) return;
    const z = zasobyProjektu(p, dane);
    ustawZasoby(z);
    return () => z.zwolnij();
    // Zależy od zasobów, bajtów i biblioteki ozdobników (własne SVG) – nie od szablonów (te
    // podmienia zRolami).
  }, [bibl, dane, biblioteka]);

  const role = projekt?.role;
  const zasobyZRolami = useMemo(
    () => (zasoby && role && szablony ? zasoby.zRolami(role, szablony) : undefined),
    [zasoby, role, szablony],
  );
  const talie = projekt?.talie;
  const ostrzezenia = useMemo(
    () => (projekt ? ostrzezeniaProjektu(projekt) : []),
    // Ostrzeżenia zależą od talii, szablonów, biblioteki i ról – nie od nazwy czy arkuszy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [talie, szablony, bibl, role],
  );

  if (!widok || widok.id !== id) return { stan: 'wczytywanie' };
  if ('blad' in widok) return { stan: 'blad', komunikat: widok.blad };
  if (!zasobyZRolami || !projekt || !dane) return { stan: 'wczytywanie' };
  return {
    stan: 'gotowy',
    projekt,
    dane,
    zasoby: zasobyZRolami,
    ostrzezenia: [...ostrzezenia, ...zasobyZRolami.ostrzezenia],
    zapis,
    zmien,
    zmienZZasobami,
    cofnij: cofnijZmiane,
    ponow: ponowZmiane,
    mozeCofnac: stanHistorii.cofnij,
    mozePonowic: stanHistorii.ponow,
    wersja,
  };
}

export const tekstZapisu = (z: StanZapisu): string =>
  z.stan === 'zapisano'
    ? t('projekt.zapisano')
    : z.stan === 'zapisywanie'
      ? t('projekt.zapisywanie')
      : t('projekt.bladZapisu', { komunikat: z.komunikat });
