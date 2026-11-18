import { unzipSync } from 'fflate';
import {
  LIMITY_ARCHIWUM,
  PLIK_PROJEKTU,
  PLIK_SZABLONU,
  ROZSZERZENIE_PROJEKTU,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';

/** Rodzaj pliku obsługiwanego przez „Importuj pliki…”. */
export type RodzajPliku = 'projekt' | 'szablon';

/** Wartość atrybutu `accept` pola plików: oba rozszerzenia i ogólny ZIP. */
export const ACCEPT_IMPORTU = `${ROZSZERZENIE_PROJEKTU},${ROZSZERZENIE_SZABLONU},.zip`;

/**
 * Rodzaj pliku po rozszerzeniu (bez względu na wielkość liter): `.kartyrpg` → projekt,
 * `.kartyrpg-szablon` → szablon, `.zip` → 'zip' (rodzaj wynika dopiero z zawartości).
 */
export function rodzajPoNazwie(nazwa: string): RodzajPliku | 'zip' | undefined {
  const n = nazwa.trim().toLowerCase();
  if (n.endsWith(ROZSZERZENIE_SZABLONU)) return 'szablon';
  if (n.endsWith(ROZSZERZENIE_PROJEKTU)) return 'projekt';
  if (n.endsWith('.zip')) return 'zip';
  return undefined;
}

/** Czy bajty zaczynają się od nagłówka lokalnego wpisu ZIP (PK\x03\x04). */
export function jestZip(bajty: Uint8Array): boolean {
  return (
    bajty.length >= 4 && bajty[0] === 0x50 && bajty[1] === 0x4b && bajty[2] === 3 && bajty[3] === 4
  );
}

/**
 * Rodzaj archiwum ZIP po układzie wpisów (jak w importach): `szablon.json` → szablon,
 * `projekt.json` → projekt. Zawartości nie rozpakowuje (filtr odrzuca każdy wpis); przy
 * zbyt wielu wpisach (limit jak przy imporcie) przerywa i zwraca `undefined`.
 */
export function rodzajPoZawartosci(bajty: Uint8Array): RodzajPliku | undefined {
  const nazwy: string[] = [];
  try {
    unzipSync(bajty, {
      filter: (plik) => {
        if (nazwy.length >= LIMITY_ARCHIWUM.wpisy) throw new Error('za dużo wpisów');
        nazwy.push(plik.name);
        return false;
      },
    });
  } catch {
    return undefined;
  }
  if (nazwy.includes(PLIK_SZABLONU)) return 'szablon';
  if (nazwy.includes(PLIK_PROJEKTU)) return 'projekt';
  return undefined;
}

/**
 * Rodzaj pliku. Gdy bajty to ZIP z `szablon.json` lub `projekt.json`, decyduje zawartość
 * (także gdy rozszerzenie mówi co innego – np. szablon zapisany jako `.kartyrpg` i tak się
 * wczyta jako szablon). W pozostałych przypadkach: rozszerzenie `.kartyrpg` / `.kartyrpg-szablon`
 * (importer zgłosi wtedy błąd zawartości); `.zip` bez rozpoznanej zawartości i inne – `undefined`.
 */
export function rozpoznajRodzaj(nazwa: string, bajty: Uint8Array): RodzajPliku | undefined {
  const poZawartosci = jestZip(bajty) ? rodzajPoZawartosci(bajty) : undefined;
  if (poZawartosci) return poZawartosci;
  const poNazwie = rodzajPoNazwie(nazwa);
  return poNazwie === 'zip' ? undefined : poNazwie;
}
