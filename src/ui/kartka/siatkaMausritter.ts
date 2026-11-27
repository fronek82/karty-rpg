/**
 * Czyste obliczenia dopasowania kart do siatki kafelków arkusza (Mausritter A4, 7×10 = 70 kafelków).
 * Używane do licznika zajętości, sprawdzania czy rozmiar (1×1, 1×2, 2×1, 2×2) mieści się
 * w docelowym kafelku oraz szukania pierwszego wolnego miejsca przy kliknięciu typu w lewym pasku.
 */

export interface RozmiarKafelkow {
  kolumny: number;
  rzedy: number;
}

export interface PozycjaKafelka {
  kolumna: number;
  rzad: number;
}

export interface ZajetyObszar extends PozycjaKafelka, RozmiarKafelkow {}

export const kluczKafelka = (kolumna: number, rzad: number): string => `${kolumna},${rzad}`;

/** Zwraca zbiór zajętych kafelków (`"kolumna,rzad"`) z listy umieszczonych obszarów na stronie. */
export function zajeteKafelki(obszary: readonly ZajetyObszar[]): Set<string> {
  const zbior = new Set<string>();
  for (const o of obszary) {
    for (let dk = 0; dk < o.kolumny; dk++) {
      for (let dr = 0; dr < o.rzedy; dr++) {
        zbior.add(kluczKafelka(o.kolumna + dk, o.rzad + dr));
      }
    }
  }
  return zbior;
}

/** Sprawdza, czy karta o rozmiarze `rozmiar` mieści się na siatce `siatka` od kafelka `(kolumna, rzad)` bez kolizji. */
export function miesciSieWSiatce(
  siatka: RozmiarKafelkow,
  pozycja: PozycjaKafelka,
  rozmiar: RozmiarKafelkow,
  zajete: ReadonlySet<string>,
): boolean {
  if (pozycja.kolumna < 0 || pozycja.rzad < 0) return false;
  if (pozycja.kolumna + rozmiar.kolumny > siatka.kolumny) return false;
  if (pozycja.rzad + rozmiar.rzedy > siatka.rzedy) return false;
  for (let dk = 0; dk < rozmiar.kolumny; dk++) {
    for (let dr = 0; dr < rozmiar.rzedy; dr++) {
      if (zajete.has(kluczKafelka(pozycja.kolumna + dk, pozycja.rzad + dr))) return false;
    }
  }
  return true;
}

/** Znajduje pierwsze wolne miejsce (rzędami, od lewej do prawej) dla karty o zadanym rozmiarze. */
export function pierwszeWolneMiejsce(
  siatka: RozmiarKafelkow,
  rozmiar: RozmiarKafelkow,
  zajete: ReadonlySet<string>,
): PozycjaKafelka | undefined {
  for (let r = 0; r <= siatka.rzedy - rozmiar.rzedy; r++) {
    for (let k = 0; k <= siatka.kolumny - rozmiar.kolumny; k++) {
      if (miesciSieWSiatce(siatka, { kolumna: k, rzad: r }, rozmiar, zajete)) {
        return { kolumna: k, rzad: r };
      }
    }
  }
  return undefined;
}
