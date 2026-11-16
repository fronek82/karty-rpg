/**
 * Historia zmian do „Cofnij / Ponów”: stany sprzed zmian (przeszłe) i cofnięte (przyszłe).
 * Kolejne zmiany z tym samym kluczem w krótkim czasie (np. pisanie w polu nazwy) scalają się
 * w jeden krok – cofnięcie przywraca stan sprzed całej serii.
 */
export interface Historia<T> {
  przeszle: T[];
  przyszle: T[];
  /** Ostatnia zapamiętana zmiana (do scalania serii). */
  ostatnia?: { klucz: string; czas: number };
}

export const LIMIT_HISTORII = 100;
export const OKNO_SCALANIA_MS = 1500;

export const pustaHistoria = <T>(): Historia<T> => ({ przeszle: [], przyszle: [] });

/** Zapamiętuje stan sprzed zmiany; `klucz` scala serię zmian tego samego rodzaju. */
export function zapamietaj<T>(
  h: Historia<T>,
  przed: T,
  opcje: { klucz?: string; czas?: number } = {},
): Historia<T> {
  const czas = opcje.czas ?? Date.now();
  const scal =
    opcje.klucz !== undefined &&
    h.ostatnia?.klucz === opcje.klucz &&
    czas - h.ostatnia.czas < OKNO_SCALANIA_MS &&
    h.przeszle.length > 0;
  return {
    przeszle: scal ? h.przeszle : [...h.przeszle, przed].slice(-LIMIT_HISTORII),
    przyszle: [],
    ...(opcje.klucz !== undefined ? { ostatnia: { klucz: opcje.klucz, czas } } : {}),
  };
}

export function cofnij<T>(
  h: Historia<T>,
  biezacy: T,
): { historia: Historia<T>; stan: T } | undefined {
  const stan = h.przeszle.at(-1);
  if (stan === undefined) return undefined;
  return {
    historia: { przeszle: h.przeszle.slice(0, -1), przyszle: [...h.przyszle, biezacy] },
    stan,
  };
}

export function ponow<T>(
  h: Historia<T>,
  biezacy: T,
): { historia: Historia<T>; stan: T } | undefined {
  const stan = h.przyszle.at(-1);
  if (stan === undefined) return undefined;
  return {
    historia: { przeszle: [...h.przeszle, biezacy], przyszle: h.przyszle.slice(0, -1) },
    stan,
  };
}
