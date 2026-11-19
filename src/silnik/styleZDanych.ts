import {
  czyKontener,
  maStylTekstu,
  type KolorZDanych,
  type Kontener,
  type Szablon,
  type StylTekstu,
  type Wezel,
} from '../model/szablon';

export function kolorZDanych(regula: KolorZDanych, dane: Record<string, string>): string {
  const wartosc = Object.hasOwn(dane, regula.klucz) ? dane[regula.klucz]?.trim() : undefined;
  if (!wartosc) return regula.domyslny;
  return regula.mapa.find((w) => w.wartosc.trim() === wartosc)?.kolor ?? regula.domyslny;
}

/** Rozwiązuje wygląd dla konkretnej karty przed pomiarem, bez zmiany zapisanego szablonu. */
export function styleZDanych(
  szablon: Szablon,
  korzen: Kontener,
  dane: Record<string, string>,
): Kontener {
  const grupy = new Map(szablon.grupyStylow?.map((g) => [g.id, g.styl]));
  const ustawEtykiete = <E extends { styl?: Partial<StylTekstu>; kolorZDanych?: KolorZDanych }>(
    e: E,
  ): E => {
    if (!e.kolorZDanych) return e;
    return { ...e, styl: { ...e.styl, kolor: kolorZDanych(e.kolorZDanych, dane) } };
  };
  const ustaw = (w: Wezel): Wezel => {
    if (czyKontener(w)) {
      const dzieci = w.dzieci.map(ustaw);
      const tlo = w.tloZDanych ? kolorZDanych(w.tloZDanych, dane) : w.tlo;
      return tlo === w.tlo && dzieci.every((d, i) => d === w.dzieci[i])
        ? w
        : { ...w, dzieci, ...(tlo !== undefined ? { tlo } : {}) };
    }
    const styl = maStylTekstu(w) && w.grupaStyluId ? grupy.get(w.grupaStyluId) : undefined;
    const pole = styl ? { ...w, styl } : w;
    if (pole.typ === 'tekst' && pole.etykieta?.kolorZDanych)
      return { ...pole, etykieta: ustawEtykiete(pole.etykieta) };
    if (pole.typ === 'wartosc' && pole.etykieta?.kolorZDanych)
      return { ...pole, etykieta: ustawEtykiete(pole.etykieta) };
    return pole;
  };
  return ustaw(korzen) as Kontener;
}
