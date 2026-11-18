import { BazaProjektow } from '../dane/baza';
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

/** Nowy projekt gry (pusta kartka albo gotowy układ) – zapisany w bazie; zwraca id. */
export async function nowyProjektZPakietu(
  pakiet: Pakiet,
  uklad?: string,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  // Silnik (fontkit) potrzebny do ułożenia gotowego układu – ładowany dopiero tutaj.
  const { nowyProjektGry } = await import('../dane/nowyProjekt');
  const { projekt, zasoby } = await nowyProjektGry(
    pakiet,
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
    pobierz,
    uklad ? { uklad } : {},
  );
  await baza().zapisz(projekt, zasoby);
  return projekt.id;
}

/** Nowy projekt własnych kart z pliku szablonu (`.kartyrpg-szablon`) – zapisany w bazie; zwraca id. */
export async function nowyProjektZSzablonu(
  bajty: Uint8Array,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const [{ importujSzablon }, { nowyProjektWlasny }] = await Promise.all([
    import('../dane/archiwum'),
    import('../dane/wlasneKarty'),
  ]);
  const { projekt, zasoby } = await nowyProjektWlasny(importujSzablon(bajty), (plik) =>
    pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  await baza().zapisz(projekt, zasoby);
  return projekt.id;
}

/** Nowy projekt własnych kart z szablonu z kreatora – zapisany w bazie; zwraca id. */
export async function nowyProjektZSzablonuKreatora(
  szablon: import('../model/szablon').Szablon,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const { nowyProjektWlasny } = await import('../dane/wlasneKarty');
  const { projekt, zasoby } = await nowyProjektWlasny(
    { szablon, role: {}, zasoby: [], dane: new Map() },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  await baza().zapisz(projekt, zasoby);
  return projekt.id;
}

/** Nowy projekt własnych kart z przykładowego szablonu (z jedną kartą z danymi) – zapisany w bazie; zwraca id. */
export async function nowyProjektZPrzykladu(
  przyklad: import('../przyklady/typy').Przyklad,
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<string> {
  const { nowyProjektZPrzykladu: utworz } = await import('../dane/wlasneKarty');
  const { projekt, zasoby } = await utworz(przyklad, (plik) =>
    pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  await baza().zapisz(projekt, zasoby);
  return projekt.id;
}
