import { BazaProjektow } from '../dane/baza';
import { projektZPakietu } from '../dane/pakiet';
import type { Pakiet } from '../pakiety/typy';

let instancja: BazaProjektow | undefined;

/** Wspólna baza projektów aplikacji (IndexedDB), tworzona przy pierwszym użyciu. */
export function baza(): BazaProjektow {
  instancja ??= new BazaProjektow();
  return instancja;
}

async function pobierz(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

/** Nowy projekt z pakietu wbudowanego – zapisany w bazie; zwraca id. */
export async function nowyProjektZPakietu(
  pakiet: Pakiet,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const { projekt, zasoby } = await projektZPakietu(
    pakiet,
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
    pobierz,
  );
  await baza().zapisz(projekt, zasoby);
  return projekt.id;
}
