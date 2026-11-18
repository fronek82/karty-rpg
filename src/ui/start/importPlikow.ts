import { unzipSync } from 'fflate';
import {
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

/**
 * Rodzaj archiwum ZIP po układzie wpisów (jak w importach): `szablon.json` → szablon,
 * `projekt.json` → projekt. Zawartości nie rozpakowuje (filtr odrzuca każdy wpis).
 */
export function rodzajPoZawartosci(bajty: Uint8Array): RodzajPliku | undefined {
  const nazwy: string[] = [];
  try {
    unzipSync(bajty, {
      filter: (plik) => {
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

/** Rodzaj pliku: po rozszerzeniu, a dla `.zip` po zawartości; `undefined` – nieobsługiwany. */
export function rozpoznajRodzaj(nazwa: string, bajty: Uint8Array): RodzajPliku | undefined {
  const poNazwie = rodzajPoNazwie(nazwa);
  return poNazwie === 'zip' ? rodzajPoZawartosci(bajty) : poNazwie;
}
