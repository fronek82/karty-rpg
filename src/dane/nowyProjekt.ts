import { tJesliJest } from '../i18n';
import { normalizujKartki } from '../druk/normalizacja';
import type { Arkusz } from '../model/arkusz';
import type { DaneZasobow, Projekt } from '../model/projekt';
import type { Talia } from '../model/szablon';
import type { Pakiet } from '../pakiety/typy';
import { projektZPakietu, rejestrZProjektu } from './pakiet';

type Pobieranie = (plik: string) => Promise<Uint8Array>;

/**
 * Nazwy zapisane w nowym projekcie (projekt, kartki, talie, szablony, tytuł kartki) w języku
 * z chwili utworzenia – tłumaczenia pod kluczami `pakiet.*`; brak klucza zostawia nazwę z danych.
 * Później nazwy są zwykłą treścią projektu i nie zmieniają się razem z językiem interfejsu.
 */
export function lokalizujNazwy(projekt: Projekt, nazwaProjektu: string): Projekt {
  const nazwaArkusza = new Map<string, string>();
  const arkusze = projekt.arkusze.map((a) => {
    const nazwa = tJesliJest(`pakiet.arkusz.${a.id}`) ?? a.nazwa;
    nazwaArkusza.set(a.taliaId, nazwa);
    const tytul = a.ustawienia.tytul;
    return {
      ...a,
      nazwa,
      ustawienia:
        tytul && tytul.tekst === a.nazwa
          ? { ...a.ustawienia, tytul: { ...tytul, tekst: nazwa } }
          : a.ustawienia,
    };
  });
  return {
    ...projekt,
    nazwa: nazwaProjektu,
    arkusze,
    talie: projekt.talie.map((x) => ({
      ...x,
      nazwa: nazwaArkusza.get(x.id) ?? x.nazwa,
      // Nagłówki i opisy grup są drukowane na kartce – też w języku z chwili utworzenia.
      ...(x.grupy
        ? {
            grupy: x.grupy.map((g) => {
              const opis = tJesliJest(`pakiet.grupa.${g.id}.opis`) ?? g.opis;
              return {
                ...g,
                naglowek: tJesliJest(`pakiet.grupa.${g.id}.naglowek`) ?? g.naglowek,
                ...(opis !== undefined ? { opis } : {}),
              };
            }),
          }
        : {}),
    })),
    szablony: projekt.szablony.map((s) => ({
      ...s,
      nazwa: tJesliJest(`pakiet.wariant.${s.id}`) ?? s.nazwa,
      // Domyślne teksty parametrów (np. etykieta „Usunięcie:”) są drukowane na kartach.
      ...(s.parametry
        ? {
            parametry: s.parametry.map((p) => ({
              ...p,
              domyslnie: tJesliJest(`pakiet.param.${p.klucz}`) ?? p.domyslnie,
            })),
          }
        : {}),
    })),
  };
}

/** Pusta kartka pakietu (talia bez kart i arkusz) z nazwą w bieżącym języku – jak w nowym projekcie. */
export function pustaKartkaPakietu(pakiet: Pakiet): {
  talia: Talia;
  arkusz: Arkusz;
  nazwa: string;
} {
  const id = 'kartka-1';
  const nazwa = tJesliJest('pakiet.nowaKartka') ?? pakiet.nowaKartka.nazwa;
  const ustawienia = structuredClone(pakiet.nowaKartka.ustawienia);
  if (ustawienia.tytul?.tekst === pakiet.nowaKartka.nazwa) ustawienia.tytul.tekst = nazwa;
  return {
    talia: { id, nazwa, karty: [] },
    arkusz: { id, nazwa, taliaId: id, liczbaStron: 1, ustawienia },
    nazwa,
  };
}

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
    const { talia, arkusz, nazwa } = pustaKartkaPakietu(pakiet);
    return {
      projekt: {
        ...lokalizujNazwy(projekt, nazwa),
        pakiet: pakiet.id,
        talie: [talia],
        arkusze: [arkusz],
      },
      zasoby,
    };
  }
  const arkusze = projekt.arkusze.filter((a) => uklad.arkusze.includes(a.id));
  const talie = projekt.talie.filter((t) => arkusze.some((a) => a.taliaId === t.id));
  const wybrany: Projekt = lokalizujNazwy(
    { ...projekt, pakiet: pakiet.id, arkusze, talie },
    tJesliJest(`pakiet.uklad.${uklad.id}`) ?? uklad.nazwa,
  );
  const { rejestr } = rejestrZProjektu(wybrany, zasoby);
  const obrazy = new Map(pakiet.zasoby.map((z) => [z.id, z]));
  return {
    projekt: normalizujKartki(wybrany, { czcionki: rejestr, obraz: (id) => obrazy.get(id) })
      .projekt,
    zasoby,
  };
}
