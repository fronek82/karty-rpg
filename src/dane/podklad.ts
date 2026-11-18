import type { DaneZasobow, OpisObrazu, Projekt } from '../model/projekt';
import type { PodkladSzablonu, Szablon } from '../model/szablon';
import { dodajZasoby, usunZasob } from './edycja';
import { zasobyElementow } from './biblioteka';
import { zasobySzablonu } from './schemat';
import { zmienSzablon } from './szablon';

/** Domyślna przezroczystość nowego podkładu (%). */
export const PRZEZROCZYSTOSC_PODKLADU = 50;

const bezPodkladu = (s: Szablon): Szablon => {
  const { podklad: _p, ...reszta } = s;
  void _p;
  return reszta;
};

/**
 * Czy zasób jest gdzieś jeszcze użyty (stałe obrazy pól, ramki 9-slice, podkłady innych szablonów,
 * dane kart). Przechodzimy po strukturach modelu, bez serializowania całego projektu.
 */
function uzywanyPozaPodkladem(p: Projekt, id: string, szablonId: string): boolean {
  for (const s of p.szablony) {
    if (s.id !== szablonId && s.podklad?.zasob === id) return true;
    if (zasobySzablonu(s).includes(id)) return true;
  }
  if (zasobyElementow(p.biblioteka?.ozdobniki ?? []).includes(id)) return true;
  return p.talie.some((t) => t.karty.some((k) => Object.values(k.dane).includes(id)));
}

/** Zasób starego podkładu znika z biblioteki, gdy nic innego go nie używa. */
function posprzatajStary(
  w: { projekt: Projekt; dane: DaneZasobow },
  stary: PodkladSzablonu | undefined,
  szablonId: string,
): { projekt: Projekt; dane: DaneZasobow } {
  if (!stary || uzywanyPozaPodkladem(w.projekt, stary.zasob, szablonId)) return w;
  // Zasób zostaje, jeśli podkład wskazuje go jeszcze inny szablon (JSON wyżej to sprawdził).
  return usunZasob(w.projekt, w.dane, stary.zasob);
}

/**
 * Ustawia podkład szablonu: nowy obraz trafia do zasobów projektu (jedzie z eksportem projektu),
 * ustawienia (przezroczystość) poprzedniego podkładu zostają; poprzedni obraz znika, gdy nic go nie używa.
 */
export function ustawPodklad(
  p: Projekt,
  dane: DaneZasobow,
  szablonId: string,
  obraz: { opis: OpisObrazu; dane: Uint8Array },
): { projekt: Projekt; dane: DaneZasobow } {
  const stary = p.szablony.find((s) => s.id === szablonId)?.podklad;
  const w = dodajZasoby(p, dane, [obraz]);
  const projekt = zmienSzablon(w.projekt, szablonId, (s) => ({
    ...s,
    podklad: {
      zasob: obraz.opis.id,
      przezroczystosc: stary?.przezroczystosc ?? PRZEZROCZYSTOSC_PODKLADU,
      widoczny: true,
    },
  }));
  return posprzatajStary({ projekt, dane: w.dane }, stary, szablonId);
}

/** Usuwa podkład szablonu (i jego obraz z biblioteki, gdy nic innego go nie używa). */
export function usunPodklad(
  p: Projekt,
  dane: DaneZasobow,
  szablonId: string,
): { projekt: Projekt; dane: DaneZasobow } {
  const stary = p.szablony.find((s) => s.id === szablonId)?.podklad;
  const projekt = zmienSzablon(p, szablonId, bezPodkladu);
  return posprzatajStary({ projekt, dane }, stary, szablonId);
}
