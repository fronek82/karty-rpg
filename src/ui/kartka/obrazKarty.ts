import { dodajZasoby, ustawDane, ustawObrazKarty } from '../../dane/edycja';
import { MAKS_BAJTOW_OBRAZU, opisObrazu } from '../../dane/obrazy';
import { BladDanych } from '../../dane/schemat';
import { formatujLiczbe, t } from '../../i18n';
import type { Projekt } from '../../model/projekt';
import type { UstawieniaObrazu } from '../../model/szablon';
import { normalizujUstawieniaObrazu } from '../../silnik/karta';
import { przygotujObraz } from '../obrazyUI';
import type { ProjektWEdycji } from '../useProjekt';
import { zaokraglij } from '../../model/geometria';

export const SKALA_MIN = 0.05;
export const SKALA_MAX = 20;

/** Usuwa wartości domyślne (skala 1, przesunięcie 0, obrót 0) – zapis tylko zmian. */
export function uprosc(u: UstawieniaObrazu): UstawieniaObrazu {
  const w: UstawieniaObrazu = {};
  if (u.skala !== undefined && u.skala !== 1) w.skala = u.skala;
  if (u.przesuniecie && (u.przesuniecie.x !== 0 || u.przesuniecie.y !== 0))
    w.przesuniecie = u.przesuniecie;
  if (u.obrot) w.obrot = u.obrot;
  if (u.dopasowanie) w.dopasowanie = u.dopasowanie;
  return w;
}

/** Zmiana ustawień ilustracji karty liczona z najnowszego projektu; `undefined` – reset. */
export function zmienObrazKarty(
  p: Projekt,
  taliaId: string,
  kartaId: string,
  poleId: string,
  f: (u: UstawieniaObrazu) => UstawieniaObrazu | undefined,
): Projekt {
  const k = p.talie.find((x) => x.id === taliaId)?.karty.find((x) => x.id === kartaId);
  const nowe = f(normalizujUstawieniaObrazu(k?.obrazy?.[poleId]));
  return ustawObrazKarty(p, taliaId, kartaId, poleId, nowe && uprosc(nowe));
}

/** Skalowanie kółkiem: krok zależny od siły obrotu, w granicach pola liczbowego. */
export const skalaZKolka = (skala: number, deltaY: number) =>
  zaokraglij(
    Math.min(
      SKALA_MAX,
      Math.max(SKALA_MIN, skala * Math.exp(-Math.max(-200, Math.min(200, deltaY)) * 0.00095)),
    ),
    3,
  );

/**
 * Wgrywa obraz do biblioteki (zdjęcia z telefonu – obrót z EXIF) i przypisuje go kartom
 * (polu `klucz`). Zmiana liczona z najnowszego projektu.
 */
export async function wgrajObrazDoKart(
  edycja: ProjektWEdycji,
  plik: File,
  taliaId: string,
  kartyIds: string[],
  klucz: string | undefined,
): Promise<void> {
  if (plik.size > MAKS_BAJTOW_OBRAZU) {
    throw new BladDanych(
      t('dane.zaDuzy', { plik: plik.name, mb: formatujLiczbe(plik.size / 1024 / 1024, 1) }),
    );
  }
  const { dane: bajty, ...wymiary } = await przygotujObraz(
    new Uint8Array(await plik.arrayBuffer()),
  );
  await edycja.zmienZZasobami((p, d) => {
    const opis = opisObrazu(plik.name, bajty, wymiary, new Set(p.zasoby.map((z) => z.id)));
    const w = dodajZasoby(p, d, [{ opis, dane: bajty }]);
    let projekt = w.projekt;
    if (klucz) for (const id of kartyIds) projekt = ustawDane(projekt, taliaId, id, klucz, opis.id);
    return { projekt, dane: w.dane };
  });
}
