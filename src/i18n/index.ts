import { pl, type KluczTekstu, type Slownik } from './pl';

export type { KluczTekstu, Slownik };

export type Jezyk = 'pl';

const slowniki: Record<Jezyk, Slownik> = { pl };

let aktywnyJezyk: Jezyk = 'pl';

export function ustawJezyk(jezyk: Jezyk): void {
  aktywnyJezyk = jezyk;
}

export function jezyk(): Jezyk {
  return aktywnyJezyk;
}

/**
 * Zwraca przetłumaczony tekst. Parametry `{nazwa}` są zastępowane wartościami z `parametry`;
 * parametr bez wartości zostaje w tekście bez zmian, żeby błąd był widoczny.
 */
export function t(klucz: KluczTekstu, parametry?: Record<string, string | number>): string {
  const tekst = slowniki[aktywnyJezyk][klucz];
  if (!parametry) return tekst;
  return tekst.replace(/\{(\w+)\}/g, (calosc, nazwa: string) =>
    nazwa in parametry ? String(parametry[nazwa]) : calosc,
  );
}
