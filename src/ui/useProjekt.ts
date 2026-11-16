import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BladDanych, ostrzezeniaProjektu } from '../dane/schemat';
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
  /** Zmiana samego dokumentu (dane kart, układ) – zapis do bazy z opóźnieniem. */
  zmien(f: (p: Projekt) => Projekt): void;
  /** Zmiana biblioteki zasobów (czcionki, obrazy) – zapis od razu, razem z bajtami. */
  zmienZZasobami(projekt: Projekt, dane: DaneZasobow): Promise<void>;
}

export type StanProjektu =
  | { stan: 'wczytywanie' }
  | { stan: 'blad'; komunikat: string }
  | ({ stan: 'gotowy' } & ProjektWEdycji);

const OPOZNIENIE_ZAPISU = 500;

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Projekt otwarty do edycji. Zmiany od razu w stanie (UI), zapis do IndexedDB po chwili
 * bezczynności i przy zamknięciu strony projektu. Zapisy idą po kolei (łańcuch obietnic).
 * Zasoby silnika (czcionki, obrazy `blob:`) odtwarzane tylko przy zmianie biblioteki.
 */
export function useProjekt(id: string): StanProjektu {
  const [wczytany, ustawWczytany] = useState<
    { id: string; projekt: Projekt; dane: DaneZasobow } | { id: string; blad: string }
  >();
  const [zasoby, ustawZasoby] = useState<{ klucz: object; z: ZasobyProjektu }>();
  const [zapis, ustawZapis] = useState<StanZapisu>({ stan: 'zapisano' });
  const doZapisu = useRef<Projekt | undefined>(undefined);
  const zegar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const kolejka = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let aktywny = true;
    baza()
      .wczytaj(id)
      .then(
        ({ projekt, zasoby: dane }) => aktywny && ustawWczytany({ id, projekt, dane }),
        (e: unknown) => aktywny && ustawWczytany({ id, blad: komunikat(e) }),
      );
    return () => {
      aktywny = false;
    };
  }, [id]);

  const zapiszTeraz = useCallback(() => {
    clearTimeout(zegar.current);
    const p = doZapisu.current;
    if (!p) return kolejka.current;
    doZapisu.current = undefined;
    kolejka.current = kolejka.current.then(() =>
      baza()
        .zapisz(p)
        .then(
          () => {
            if (!doZapisu.current) ustawZapis({ stan: 'zapisano' });
          },
          (e: unknown) => ustawZapis({ stan: 'blad', komunikat: komunikat(e) }),
        ),
    );
    return kolejka.current;
  }, []);

  // Zapis przy zamknięciu projektu; ostrzeżenie przeglądarki przy zamykaniu karty w trakcie.
  useEffect(() => {
    const przedZamknieciem = (e: BeforeUnloadEvent) => {
      if (doZapisu.current) {
        void zapiszTeraz();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', przedZamknieciem);
    return () => {
      window.removeEventListener('beforeunload', przedZamknieciem);
      void zapiszTeraz();
    };
  }, [zapiszTeraz]);

  const gotowy = wczytany && wczytany.id === id && 'projekt' in wczytany ? wczytany : undefined;
  const projekt = gotowy?.projekt;
  const dane = gotowy?.dane;

  // Zasoby silnika zależą tylko od biblioteki i szablonów – nie od danych kart (edycja kart
  // zachowuje referencje tych części projektu).
  const bibl = projekt?.zasoby;
  const role = projekt?.role;
  const szablony = projekt?.szablony;
  const kluczZasobow = useMemo(
    () => (bibl && role && szablony && dane ? {} : undefined),
    [bibl, role, szablony, dane],
  );
  const projektRef = useRef(projekt);
  useEffect(() => {
    projektRef.current = projekt;
  });
  useEffect(() => {
    const p = projektRef.current;
    if (!kluczZasobow || !p || !dane) return;
    const z = zasobyProjektu(p, dane);
    ustawZasoby({ klucz: kluczZasobow, z });
    return () => z.zwolnij();
  }, [kluczZasobow, dane]);

  const zmien = useCallback(
    (f: (p: Projekt) => Projekt) => {
      ustawWczytany((w) => {
        if (!w || !('projekt' in w)) return w;
        const nowy = f(w.projekt);
        doZapisu.current = nowy;
        return { ...w, projekt: nowy };
      });
      ustawZapis({ stan: 'zapisywanie' });
      clearTimeout(zegar.current);
      zegar.current = setTimeout(() => void zapiszTeraz(), OPOZNIENIE_ZAPISU);
    },
    [zapiszTeraz],
  );

  const zmienZZasobami = useCallback(async (nowy: Projekt, noweDane: DaneZasobow) => {
    doZapisu.current = undefined;
    clearTimeout(zegar.current);
    ustawZapis({ stan: 'zapisywanie' });
    const zadanie = kolejka.current.then(() => baza().zapisz(nowy, noweDane));
    kolejka.current = zadanie.catch(() => undefined);
    await zadanie; // błąd (np. walidacji) trafia do wołającego – stan projektu bez zmian
    ustawWczytany((w) => (w && w.id === nowy.id ? { id: w.id, projekt: nowy, dane: noweDane } : w));
    ustawZapis({ stan: 'zapisano' });
  }, []);

  if (!wczytany || wczytany.id !== id) return { stan: 'wczytywanie' };
  if ('blad' in wczytany) return { stan: 'blad', komunikat: wczytany.blad };
  // Przy zmianie biblioteki do czasu podmiany zostają poprzednie zasoby (bez migania strony).
  if (!zasoby || !projekt || !dane) return { stan: 'wczytywanie' };
  return {
    stan: 'gotowy',
    projekt,
    dane,
    zasoby: zasoby.z,
    ostrzezenia: [...ostrzezeniaProjektu(projekt), ...zasoby.z.ostrzezenia],
    zapis,
    zmien,
    zmienZZasobami,
  };
}

export const tekstZapisu = (z: StanZapisu): string =>
  z.stan === 'zapisano'
    ? t('projekt.zapisano')
    : z.stan === 'zapisywanie'
      ? t('projekt.zapisywanie')
      : t('projekt.bladZapisu', { komunikat: z.komunikat });
