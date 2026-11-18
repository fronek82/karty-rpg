import { pakietWlasny } from '../../dane/wlasneKarty';
import type { Przyklad } from '../../przyklady/typy';
import { renderujKarte } from '../../silnik/karta';
import { scenaDoSvg } from '../../silnik/svg';
import type { ZasobyProjektu } from '../zasobyProjektu';
import { wczytajZasobyPakietu, type KrokPodgladu } from './podglady';

/**
 * Podglądy przykładowych szablonów: karta z danymi przykładowymi liczona TYM SAMYM silnikiem co
 * edytor i PDF (`renderujKarte` → `scenaDoSvg`). Ten plik ładuje się leniwie (silnik, fontkit);
 * harmonogram i pamięć są wspólne z ekranem gry (`pamiecPodgladow.ts`).
 */

/** Czcionki projektów własnych kart (EB Garamond; obie role – tytuł i treść – wskazują ją). */
export async function wczytajCzcionkiPrzykladow(
  adresCzcionki: (plik: string) => string,
  pobierz: (adres: string) => Promise<Uint8Array>,
): Promise<ZasobyProjektu> {
  const { zasoby } = await wczytajZasobyPakietu(pakietWlasny([]), adresCzcionki, pobierz);
  return zasoby;
}

/** Kroki liczenia: jeden podgląd (jedna karta) na przykład, w kolejności listy. */
export function krokiPrzykladow(
  przyklady: readonly { id: string; przyklad: Przyklad }[],
  zasobyBazowe: ZasobyProjektu,
): KrokPodgladu[] {
  const rodzina = zasobyBazowe.zasoby.czcionki.nazwyRodzin[0] ?? 'EB Garamond';
  const zasoby = zasobyBazowe.zRolami({ tytul: rodzina, tresc: rodzina }, []).zasoby;
  return przyklady.map(({ id, przyklad }, indeks) => ({
    id,
    licz: () => {
      const r = renderujKarte(
        przyklad.szablon,
        { dane: przyklad.dane },
        {
          czcionki: zasoby.czcionki,
        },
      );
      return {
        id,
        strony: [
          {
            // Przedrostek z indeksu: identyfikatory SVG (glify, przycięcia) są wspólne dla strony.
            svg: scenaDoSvg(r.scena, {
              przedrostekId: `pr${indeks}-`,
              atrybuty: { 'aria-hidden': 'true', focusable: 'false' },
            }),
            szerokosc: r.scena.szer,
            wysokosc: r.scena.wys,
          },
        ],
        ostrzezenia: r.ostrzezenia.map((o) => o.komunikat),
      };
    },
  }));
}
