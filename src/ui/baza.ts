import { BazaProjektow } from '../dane/baza';
import { BladDanych } from '../dane/schemat';
import { t } from '../i18n';
import type { Pakiet } from '../pakiety/typy';

let instancja: BazaProjektow | undefined;

/** Wspólna baza projektów aplikacji (IndexedDB), tworzona przy pierwszym użyciu. */
export function baza(): BazaProjektow {
  instancja ??= new BazaProjektow();
  return instancja;
}

/** Sprawdza dekodowanie obrazu ramki przed zapisaniem pliku w katalogu globalnym. */
export async function zapiszOzdobnikWBibliotece(bajty: Uint8Array) {
  const { importujOzdobnik } = await import('../dane/archiwum');
  const { element, zasoby, dane } = importujOzdobnik(bajty);
  const opis = zasoby[0];
  if (opis?.rodzaj === 'obraz') {
    const { przygotujObraz } = await import('./obrazy');
    const wynik = await przygotujObraz(dane.get(opis.id)!);
    if (wynik.szerokosc !== opis.szerokosc || wynik.wysokosc !== opis.wysokosc)
      throw new BladDanych(t('globalna.zlyObraz', { id: opis.id }));
  }
  const nazwa = element.nazwa ?? element.id;
  await baza().zapiszWBibliotece('ozdobnik', nazwa, bajty);
  return nazwa;
}

async function pobierz(adres: string): Promise<Uint8Array> {
  const odp = await fetch(adres);
  if (!odp.ok) throw new Error(`${adres}: HTTP ${odp.status}`);
  return new Uint8Array(await odp.arrayBuffer());
}

async function zapiszNowyProjekt(
  projekt: import('../model/projekt').Projekt,
  zasoby: import('../model/projekt').DaneZasobow,
): Promise<string> {
  const { dolaczZasobyGlobalne } = await import('./zasobyGlobalne');
  const zGlobalnymi = await dolaczZasobyGlobalne(projekt, zasoby);
  await baza().zapisz(zGlobalnymi.projekt, zGlobalnymi.dane);
  return zGlobalnymi.projekt.id;
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
  return zapiszNowyProjekt(projekt, zasoby);
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
  return zapiszNowyProjekt(projekt, zasoby);
}

/** Nowy projekt własnych kart z szablonu z kreatora – zapisany w bazie; zwraca id. */
export async function nowyProjektZSzablonuKreatora(
  szablon: import('../model/szablon').Szablon,
  bazaUrl: string = import.meta.env.BASE_URL,
  dodatkowe?: {
    zasoby: import('../model/projekt').OpisZasobu[];
    dane: Map<string, Uint8Array>;
  },
): Promise<string> {
  const { nowyProjektWlasny } = await import('../dane/wlasneKarty');
  const { projekt, zasoby } = await nowyProjektWlasny(
    {
      szablon,
      role: {},
      zasoby: dodatkowe?.zasoby ?? [],
      dane: dodatkowe?.dane ?? new Map(),
    },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  return zapiszNowyProjekt(projekt, zasoby);
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
  return zapiszNowyProjekt(projekt, zasoby);
}

/** Nowy projekt własnych kart otwierany od razu w edytorze rewersu – zapisany w bazie. */
export async function nowyProjektZRewersem(
  bazaUrl: string = import.meta.env.BASE_URL,
): Promise<{ id: string; rewersId: string }> {
  const [
    { nowyProjektWlasny },
    { nowyRewers, przypiszRewers },
    { DOMYSLNE_TLO_KARTY },
    { szablonZKreatora },
  ] = await Promise.all([
    import('../dane/wlasneKarty'),
    import('../dane/rewers'),
    import('../model/szablon'),
    import('./szablon/nowySzablonUI'),
  ]);
  const szablon = szablonZKreatora({
    nazwa: t('kreator.nazwaDomyslna'),
    szer: 63,
    wys: 88,
    promien: 3,
    tlo: DOMYSLNE_TLO_KARTY,
    uklad: 'swobodny',
  });
  const { projekt: bazowy, zasoby } = await nowyProjektWlasny(
    { szablon, role: {}, zasoby: [], dane: new Map() },
    (plik) => pobierz(`${bazaUrl}czcionki/${plik}`),
  );
  const nazwaRewersu = t('wlasne.rewersNazwa');
  const { projekt: zRewersem, id: rewersId } = nowyRewers(
    { ...bazowy, nazwa: nazwaRewersu },
    {
      nazwa: nazwaRewersu,
      nazwaKorzenia: nazwaRewersu,
    },
  );
  const taliaId = zRewersem.talie[0]?.id;
  const projekt = taliaId
    ? przypiszRewers(zRewersem, { rodzaj: 'talia', id: taliaId }, rewersId)
    : zRewersem;
  const id = await zapiszNowyProjekt(projekt, zasoby);
  return { id, rewersId };
}
