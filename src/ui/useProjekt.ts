import { useEffect, useState } from 'react';
import { BladDanych, ostrzezeniaProjektu } from '../dane/schemat';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { baza } from './baza';
import { zasobyProjektu, type ZasobyProjektu } from './zasobyProjektu';

export type StanProjektu =
  | { stan: 'wczytywanie' }
  | { stan: 'blad'; komunikat: string }
  | {
      stan: 'gotowy';
      projekt: Projekt;
      dane: DaneZasobow;
      zasoby: ZasobyProjektu;
      ostrzezenia: string[];
    };

/** Wczytuje projekt z bazy i przygotowuje zasoby; adresy `blob:` zwalnia przy zmianie/odmontowaniu. */
export function useProjekt(id: string): StanProjektu {
  const [stan, ustawStan] = useState<StanProjektu & { id?: string }>({ stan: 'wczytywanie' });
  useEffect(() => {
    let aktywny = true;
    let zasoby: ZasobyProjektu | undefined;
    baza()
      .wczytaj(id)
      .then(
        ({ projekt, zasoby: dane }) => {
          if (!aktywny) return;
          zasoby = zasobyProjektu(projekt, dane);
          ustawStan({
            id,
            stan: 'gotowy',
            projekt,
            dane,
            zasoby,
            ostrzezenia: [...ostrzezeniaProjektu(projekt), ...zasoby.ostrzezenia],
          });
        },
        (e: unknown) =>
          aktywny &&
          ustawStan({
            id,
            stan: 'blad',
            komunikat:
              e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e),
          }),
      );
    return () => {
      aktywny = false;
      zasoby?.zwolnij();
    };
  }, [id]);
  return stan.id === id ? stan : { stan: 'wczytywanie' };
}
