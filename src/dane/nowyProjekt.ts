import { normalizujKartki } from '../druk/normalizacja';
import type { DaneZasobow, Projekt } from '../model/projekt';
import type { Pakiet } from '../pakiety/typy';
import { projektZPakietu, rejestrZProjektu } from './pakiet';

type Pobieranie = (plik: string) => Promise<Uint8Array>;

/**
 * Nowy projekt gry z pakietu: biblioteka (czcionki, obrazy) i szablony z pakietu, a na kartkach –
 * pusta kartka albo wybrany gotowy układ (jego karty jako zwykłe, przypięte karty).
 */
export async function nowyProjektGry(
  pakiet: Pakiet,
  pobierzCzcionke: Pobieranie,
  pobierzObraz: Pobieranie,
  opcje: { uklad?: string; id?: string } = {},
): Promise<{ projekt: Projekt; zasoby: DaneZasobow }> {
  const { projekt, zasoby } = await projektZPakietu(
    pakiet,
    pobierzCzcionke,
    pobierzObraz,
    opcje.id ?? crypto.randomUUID(),
  );
  const uklad = opcje.uklad ? pakiet.gotoweUklady.find((u) => u.id === opcje.uklad) : undefined;
  if (opcje.uklad && !uklad) throw new Error(`Nieznany układ „${opcje.uklad}”.`);
  if (!uklad) {
    const id = 'kartka-1';
    return {
      projekt: {
        ...projekt,
        nazwa: `${pakiet.nowaKartka.nazwa}`,
        pakiet: pakiet.id,
        talie: [{ id, nazwa: pakiet.nowaKartka.nazwa, karty: [] }],
        arkusze: [
          {
            id,
            nazwa: pakiet.nowaKartka.nazwa,
            taliaId: id,
            liczbaStron: 1,
            ustawienia: structuredClone(pakiet.nowaKartka.ustawienia),
          },
        ],
      },
      zasoby,
    };
  }
  const arkusze = projekt.arkusze.filter((a) => uklad.arkusze.includes(a.id));
  const talie = projekt.talie.filter((t) => arkusze.some((a) => a.taliaId === t.id));
  const wybrany: Projekt = { ...projekt, nazwa: uklad.nazwa, pakiet: pakiet.id, arkusze, talie };
  const { rejestr } = rejestrZProjektu(wybrany, zasoby);
  const obrazy = new Map(pakiet.zasoby.map((z) => [z.id, z]));
  return {
    projekt: normalizujKartki(wybrany, { czcionki: rejestr, obraz: (id) => obrazy.get(id) })
      .projekt,
    zasoby,
  };
}
