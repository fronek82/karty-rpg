import { BladDanych } from '../../dane/schemat';
import { t } from '../../i18n';
import { nowyProjektZSzablonu } from '../baza';

/** Komunikat błędu importu dla użytkownika (błąd danych ma własne zdanie). */
export const opisBleduImportu = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: e instanceof Error ? e.message : String(e) });

/** Adres edytora kartki projektu. */
export const adresProjektu = (id: string) => `#/projekt/${encodeURIComponent(id)}`;

/**
 * Wspólny import pliku szablonu (`.kartyrpg-szablon`): nowy projekt własnych kart z kartką
 * dopasowaną do karty, zapisany w bazie. Zwraca id projektu albo gotowy komunikat błędu.
 * Przejście do edytora robi wołający (przy wielu plikach import nie przechodzi nigdzie).
 */
export async function importujPlikSzablonu(
  bajty: Uint8Array,
): Promise<{ id: string } | { blad: string }> {
  try {
    return { id: await nowyProjektZSzablonu(bajty) };
  } catch (e) {
    return { blad: t('szablony.bladImportu', { szczegoly: opisBleduImportu(e) }) };
  }
}
