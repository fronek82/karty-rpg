import type { DaneZasobow, OpisZasobu, Projekt } from '../model/projekt';
import { WERSJA_SCHEMATU } from '../model/projekt';
import type { Pakiet } from '../pakiety/typy';
import { RejestrCzcionek, wczytajCzcionke } from '../silnik/czcionki';
import { identyfikatorZNazwy } from './czcionki';
import { przygotujProjekt } from './schemat';

const FORMAT_CZCIONKI = (plik: string) =>
  plik.split('.').pop()?.toLowerCase() === 'otf' ? 'otf' : 'ttf';

/**
 * Zamienia pakiet (szablony, talie, arkusze) w nowy projekt z biblioteką zasobów.
 * `pobierz` dostarcza bajty pliku (fetch w aplikacji, odczyt z dysku w testach).
 */
export async function projektZPakietu(
  pakiet: Pakiet,
  pobierzCzcionke: (plik: string) => Promise<Uint8Array>,
  pobierzObraz: (adres: string) => Promise<Uint8Array>,
  id: string = crypto.randomUUID(),
): Promise<{ projekt: Projekt; zasoby: DaneZasobow }> {
  const zasoby: DaneZasobow = new Map();
  const opisy: OpisZasobu[] = [];
  const role: Record<string, string> = {};
  for (const c of pakiet.czcionki) {
    role[c.rola] = c.rodzina;
    for (const [wariant, plik] of Object.entries(c.warianty)) {
      if (!plik) continue;
      const zasobId = identyfikatorZNazwy(plik.replace(/\.[^.]+$/, ''), 'czcionka');
      zasoby.set(zasobId, await pobierzCzcionke(plik));
      opisy.push({
        rodzaj: 'czcionka',
        id: zasobId,
        nazwa: plik,
        rodzina: c.rodzina,
        wariant: wariant as 'normalny',
        format: FORMAT_CZCIONKI(plik),
        zrodlo: 'wbudowana',
      });
    }
  }
  for (const z of pakiet.zasoby) {
    zasoby.set(z.id, await pobierzObraz(z.plik));
    opisy.push({
      rodzaj: 'obraz',
      id: z.id,
      nazwa: z.id,
      format: z.format,
      szerokosc: z.szerokosc,
      wysokosc: z.wysokosc,
    });
  }
  const teraz = new Date().toISOString();
  const projekt = przygotujProjekt({
    wersja: WERSJA_SCHEMATU,
    id,
    nazwa: pakiet.nazwa,
    utworzono: teraz,
    zmieniono: teraz,
    role,
    zasoby: opisy,
    szablony: pakiet.szablony,
    talie: pakiet.talie,
    arkusze: pakiet.arkusze,
  });
  return { projekt, zasoby };
}

/**
 * Rejestr czcionek z biblioteki projektu. Id zasobu jest id czcionki w silniku, więc klucze
 * glifów w scenie i PDF nie mieszają glifów z różnych czcionek.
 */
export function rejestrZProjektu(projekt: Projekt, zasoby: DaneZasobow): RejestrCzcionek {
  const rejestr = new RejestrCzcionek();
  for (const opis of projekt.zasoby) {
    if (opis.rodzaj !== 'czcionka') continue;
    const dane = zasoby.get(opis.id);
    if (dane) rejestr.dodaj(opis.rodzina, opis.wariant, wczytajCzcionke(opis.id, dane));
  }
  for (const [rola, rodzina] of Object.entries(projekt.role)) rejestr.przypiszRole(rola, rodzina);
  return rejestr;
}
