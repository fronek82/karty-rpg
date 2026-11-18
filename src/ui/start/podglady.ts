import { projektZPakietu } from '../../dane/pakiet';
import { lokalizujNazwy, pustaKartkaPakietu } from '../../dane/nowyProjekt';
import { zbudujArkusz } from '../../druk/arkusz';
import type { Mm } from '../../model/jednostki';
import type { Arkusz } from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import type { Karta, Talia } from '../../model/szablon';
import type { Pakiet } from '../../pakiety/typy';
import type { Ostrzezenie } from '../../silnik/karta';
import type { Scena } from '../../silnik/scena';
import { scenaDoSvg } from '../../silnik/svg';
import { ID_PUSTEJ } from './idPodgladow';
import { zasobyProjektu, type ZasobyProjektu } from '../zasobyProjektu';

/**
 * Podglądy ekranu gry: pusta kartka i gotowe układy pakietu liczone TYM SAMYM silnikiem co
 * edytor i PDF (`zbudujArkusz` → `scenaDoSvg`) na danych pakietu – bez kopii „na sztywno”.
 * Ten plik ładuje się leniwie (silnik, fontkit); harmonogram i pamięć są w `ladujPodglady.ts`.
 */

/** Siatka slotów pustej kartki – geometria z wyniku układu (mm od rogu strony). */
export interface SiatkaPodgladu {
  poczatek: { x: Mm; y: Mm };
  slot: { szerokosc: Mm; wysokosc: Mm };
  kolumny: number;
  rzedy: number;
}

export interface StronaPodgladu {
  svg: string;
  szerokosc: Mm;
  wysokosc: Mm;
  siatka?: SiatkaPodgladu;
}

export interface Podglad {
  id: string;
  /** Pierwsza strona każdej kartki układu; pierwsza na liście jest „na wierzchu” stosu. */
  strony: StronaPodgladu[];
  ostrzezenia: string[];
}

export interface KrokPodgladu {
  id: string;
  licz: () => Podglad;
}

/** Projekt pakietu z nazwami w bieżącym języku (nagłówki grup drukowane na kartce też). */
export function lokalizowanyProjekt(projekt: Projekt, pakiet: Pakiet): Projekt {
  return lokalizujNazwy(projekt, pakiet.nazwa);
}

/** Czcionki i obrazy pakietu → projekt i zasoby jak przy tworzeniu projektu gry. */
export async function wczytajZasobyPakietu(
  pakiet: Pakiet,
  adresCzcionki: (plik: string) => string,
  pobierz: (adres: string) => Promise<Uint8Array>,
): Promise<{ projekt: Projekt; zasoby: ZasobyProjektu }> {
  // Wszystkie pliki startują naraz; `projektZPakietu` odbiera je po kolei z gotowych obietnic.
  const wCzasie = new Map<string, Promise<Uint8Array>>();
  const pobierzRaz = (adres: string) => {
    let p = wCzasie.get(adres);
    if (!p) {
      p = pobierz(adres);
      // Pliki startują naraz; błąd zgłosi dopiero odbiór – bez ostrzeżenia o nieobsłużonej obietnicy.
      p.catch(() => undefined);
      wCzasie.set(adres, p);
    }
    return p;
  };
  for (const c of pakiet.czcionki)
    for (const plik of Object.values(c.warianty)) if (plik) void pobierzRaz(adresCzcionki(plik));
  for (const z of pakiet.zasoby) void pobierzRaz(z.plik);
  const { projekt, zasoby } = await projektZPakietu(
    pakiet,
    (plik) => pobierzRaz(adresCzcionki(plik)),
    pobierzRaz,
    'podglad',
  );
  return { projekt, zasoby: zasobyProjektu(projekt, zasoby) };
}

/**
 * Kroki liczenia podglądów w kolejności pokazywania: pusta kartka, potem każdy układ pakietu.
 * Każdy krok jest osobną, krótką pracą – wołający oddaje wątek między nimi. Sceny kartek
 * współdzielone przez układy (np. „Wszystkie trzy”) liczą się raz.
 */
export function krokiPodgladow(
  pakiet: Pakiet,
  projekt: Projekt,
  zasobyBazowe: ZasobyProjektu,
): KrokPodgladu[] {
  const zasoby = zasobyBazowe.zRolami(projekt.role, projekt.szablony).zasoby;
  const pamiecKart = new WeakMap<Karta, { scena: Scena; ostrzezenia: Ostrzezenie[] }>();
  const kartki = new Map<
    string,
    { scena: Scena; ostrzezenia: string[]; siatka?: SiatkaPodgladu }
  >();

  const kartka = (arkusz: Arkusz, talia: Talia, przezSiatke: boolean) => {
    const klucz = `${arkusz.id}|${przezSiatke}`;
    let k = kartki.get(klucz);
    if (!k) {
      const w = zbudujArkusz(arkusz, talia, {
        czcionki: zasoby.czcionki,
        szablony: zasoby.szablony,
        obraz: (id) => zasoby.obrazy.get(id)?.info,
        pamiecKart,
      });
      k = {
        scena: w.strony[0]!,
        ostrzezenia: w.ostrzezenia.map((o) => o.komunikat),
        ...(przezSiatke
          ? {
              siatka: {
                poczatek: w.poczatekSiatki,
                slot: w.slot,
                kolumny: w.siatka.kolumny,
                rzedy: w.siatka.rzedy,
              },
            }
          : {}),
      };
      kartki.set(klucz, k);
    }
    return k;
  };

  // Identyfikatory SVG (glify, przycięcia) są wspólne dla całej strony HTML – każdy podgląd
  // ma własny przedrostek, inaczej `<use>` wskazałby glif z innej kartki.
  // Przedrostek z indeksów (kafelek, kartka), nie z identyfikatorów – id pakietu mogą zawierać
  // „-” i „+”, a wtedy `a-b` + `c` kolidowałoby z `a` + `b-c`.
  const strona = (
    indeksPodgladu: number,
    indeksKartki: number,
    k: ReturnType<typeof kartka>,
  ): StronaPodgladu => ({
    svg: scenaDoSvg(k.scena, {
      przedrostekId: `pg${indeksPodgladu}k${indeksKartki}-`,
      adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
      atrybuty: { 'aria-hidden': 'true', focusable: 'false' },
    }),
    szerokosc: k.scena.szer,
    wysokosc: k.scena.wys,
    ...(k.siatka ? { siatka: k.siatka } : {}),
  });

  const pusta: KrokPodgladu = {
    id: ID_PUSTEJ,
    licz: () => {
      const { arkusz, talia } = pustaKartkaPakietu(pakiet);
      const k = kartka(arkusz, talia, true);
      return {
        id: ID_PUSTEJ,
        strony: [strona(0, 0, k)],
        ostrzezenia: k.ostrzezenia,
      };
    },
  };
  const uklady = pakiet.gotoweUklady.map((u, indeks): KrokPodgladu => ({
    id: u.id,
    licz: () => {
      if (u.arkusze.length === 0) throw new Error(`Układ „${u.id}” nie ma żadnej kartki.`);
      const wyniki = u.arkusze.map((aid, j) => {
        const arkusz = projekt.arkusze.find((a) => a.id === aid);
        const talia = arkusz && projekt.talie.find((x) => x.id === arkusz.taliaId);
        if (!arkusz || !talia) throw new Error(`Układ „${u.id}”: brak kartki „${aid}”.`);
        const k = kartka(arkusz, talia, false);
        return { strona: strona(indeks + 1, j, k), ostrzezenia: k.ostrzezenia };
      });
      return {
        id: u.id,
        strony: wyniki.map((w) => w.strona),
        ostrzezenia: wyniki.flatMap((w) => w.ostrzezenia),
      };
    },
  }));
  return [pusta, ...uklady];
}
