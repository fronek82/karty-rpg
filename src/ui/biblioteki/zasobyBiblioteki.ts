import { useEffect, useState } from 'react';
import { opisZWpisu, type WpisBiblioteki } from '../../dane/bibliotekaUzytkownika';
import { zasobyElementow } from '../../dane/biblioteka';
import type { DaneZasobow, OpisZasobu, Projekt } from '../../model/projekt';
import type { ElementOzdobny } from '../../ozdobniki';
import { baza } from '../bazaUI';
import type { ZasobyPakietu } from '../zasoby';
import { zasobyProjektu } from '../zasobyProjektu';

const PLIK_DOMYSLNY = 'EBGaramond-Regular.ttf';
const ID_DOMYSLNEJ = 'podglad:czcionka-domyslna';

/**
 * Zasoby do podglądów na stronie Biblioteki (bez otwartego projektu): rejestr czcionek biblioteki
 * (próbki tekstu w kształtach wartości) i obrazy ramek 9-slice z adresami `blob:`.
 */
export function useZasobyBiblioteki(
  elementy: readonly ElementOzdobny[],
  czcionki: readonly WpisBiblioteki[] | undefined,
): ZasobyPakietu | undefined {
  const [zasoby, ustawZasoby] = useState<ZasobyPakietu>();
  const kluczObrazow = zasobyElementow(elementy).join('\0');
  const kluczCzcionek = (czcionki ?? []).map((w) => w.id).join('\0');
  useEffect(() => {
    let aktywny = true;
    let zwolnij: (() => void) | undefined;
    void (async () => {
      const ids = kluczObrazow ? kluczObrazow.split('\0') : [];
      const wpisy = [
        ...(await baza().wpisyBibliotekiPoId(ids)),
        ...(await baza().wpisyBiblioteki('czcionka')),
      ];
      const opisy: OpisZasobu[] = [];
      const dane: DaneZasobow = new Map();
      for (const w of wpisy) {
        const opis = opisZWpisu(w);
        const bajty = opis && (await baza().bajtyBiblioteki(w.id));
        if (!opis || !bajty) continue;
        opisy.push(opis);
        dane.set(opis.id, bajty);
      }
      // Czcionka domyślna aplikacji (jak w nowych projektach) – napisy w podglądach kształtów.
      try {
        const odp = await fetch(`${import.meta.env.BASE_URL}czcionki/${PLIK_DOMYSLNY}`);
        if (odp.ok) {
          opisy.push({
            rodzaj: 'czcionka',
            id: ID_DOMYSLNEJ,
            nazwa: PLIK_DOMYSLNY,
            rodzina: 'EB Garamond',
            wariant: 'normalny',
            format: 'ttf',
            zrodlo: 'wbudowana',
          });
          dane.set(ID_DOMYSLNEJ, new Uint8Array(await odp.arrayBuffer()));
        }
      } catch {
        // Bez czcionki podgląd kształtu pokaże samą miniaturę.
      }
      if (!aktywny) return;
      const pseudo = {
        zasoby: opisy,
        role: { tresc: 'EB Garamond' },
        szablony: [],
      } as unknown as Projekt;
      const z = zasobyProjektu(pseudo, dane);
      zwolnij = z.zwolnij;
      ustawZasoby(z.zasoby);
    })().catch((e: unknown) => console.warn('Biblioteka: zasoby podglądu', e));
    return () => {
      aktywny = false;
      zwolnij?.();
    };
  }, [kluczObrazow, kluczCzcionek]);
  return zasoby && { ...zasoby, elementy };
}
