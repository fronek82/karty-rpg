import {
  czyFormatZdjeciowy,
  MARGINES_BEZPIECZENSTWA_FOTO,
  wymiaryStrony,
  type Papier,
  type UstawieniaArkusza,
} from '../model/arkusz';
import { pt, type Mm } from '../model/jednostki';
import type { DaneZasobow, Projekt } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import type { Pakiet, TypKarty } from '../pakiety/typy';
import { projektZPakietu } from './pakiet';
import { dodajSzablon, type PaczkaSzablonu } from './archiwum';
import { dodajKartke } from './kartka';

/**
 * Projekty „własnych kart” (bez pakietu gry): typy kart w menu kartki pochodzą z szablonów
 * projektu, a kartka ma slot równy wymiarowi karty (karty w mm) albo slot szablonu (sloty).
 */

/** Identyfikator projektu własnych kart w `Projekt.pakiet` (nie ma go w rejestrze gier). */
export const PAKIET_WLASNY = 'wlasne';

/** Pseudo-pakiet: tylko czcionka domyślna (EB Garamond, OFL); rola tytułu – ta sama rodzina. */
const CZCIONKI_WLASNE: Pakiet['czcionki'] = [
  {
    rola: 'tresc',
    rodzina: 'EB Garamond',
    warianty: {
      normalny: 'EBGaramond-Regular.ttf',
      pogrubiony: 'EBGaramond-Bold.ttf',
      kursywa: 'EBGaramond-Italic.ttf',
      'pogrubiona-kursywa': 'EBGaramond-BoldItalic.ttf',
    },
  },
];

const KOLOR = '#000000';
const MARGINES: Mm = 10;

/** Slot kartki dla szablonu: slot (tryb slotów) albo wymiar karty (mm). */
export function slotSzablonu(s: Szablon): { szerokosc: Mm; wysokosc: Mm } {
  return s.rozmiar.tryb === 'sloty'
    ? { ...s.rozmiar.slot }
    : { szerokosc: s.rozmiar.szerokosc, wysokosc: s.rozmiar.wysokosc };
}

/** Ile slotów zmieści się na stronie (bez tytułu i nagłówków). */
export function slotyNaStronie(u: UstawieniaArkusza, slot: { szerokosc: Mm; wysokosc: Mm }) {
  const s = wymiaryStrony(u);
  const m = u.marginesy;
  const kolumny = Math.floor((s.szer - m.lewo - m.prawo) / slot.szerokosc + 1e-6);
  const rzedy = Math.floor((s.wys - m.gora - m.dol) / slot.wysokosc + 1e-6);
  return { kolumny, rzedy, razem: Math.max(0, kolumny) * Math.max(0, rzedy) };
}

/**
 * Ustawienia nowej kartki dla szablonu: bez tytułu i nożyczek, linie cięcia, marginesy 10 mm
 * (na formatach zdjęciowych co najmniej strefa bezpieczeństwa), orientacja z większą liczbą kart.
 */
export function ustawieniaKartkiDla(
  szablon: Szablon,
  papier: Papier = 'A4',
  wymiaryPapieru?: { szer: Mm; wys: Mm },
): UstawieniaArkusza {
  const foto = czyFormatZdjeciowy(papier);
  const m = foto ? MARGINES_BEZPIECZENSTWA_FOTO : MARGINES;
  const baza: UstawieniaArkusza = {
    papier,
    ...(papier === 'wlasny' && wymiaryPapieru ? { wymiaryPapieru } : {}),
    orientacja: 'pionowa',
    marginesy: { gora: m, prawo: m, dol: m, lewo: m },
    ...(foto ? { marginesBezpieczenstwa: MARGINES_BEZPIECZENSTWA_FOTO } : {}),
    linie: { grubosc: pt(0.5), kolor: KOLOR, kreska: 2, przerwa: 1.5 },
    tytul: {
      tekst: '',
      polozenie: 'gora',
      styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(18), kolor: KOLOR },
      odstep: 2,
    },
    grupy: {
      styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(11), kolor: KOLOR },
      stylOpisu: { czcionka: 'tresc', rozmiar: pt(8), kolor: KOLOR },
      odstep: 2.9,
      odstepOdKart: 2,
    },
    slot: slotSzablonu(szablon),
  };
  const pozioma: UstawieniaArkusza = { ...baza, orientacja: 'pozioma' };
  return slotyNaStronie(pozioma, baza.slot!).razem > slotyNaStronie(baza, baza.slot!).razem
    ? pozioma
    : baza;
}

/** Typy kart w menu kartki z szablonów projektu (jeden szablon = jedna pozycja). */
export function typyZSzablonow(szablony: readonly Szablon[]): TypKarty[] {
  return szablony.map((s) => ({
    id: s.id,
    nazwa: s.nazwa,
    ikona: '▤',
    warianty: [{ szablonId: s.id, nazwa: s.nazwa }],
    opisRozmiaru: opisRozmiaruSzablonu(s),
    rozmiary:
      s.rozmiar.tryb === 'sloty'
        ? [
            { kolumny: s.rozmiar.kolumny, rzedy: s.rozmiar.rzedy },
            ...(s.warianty ?? [])
              .filter(
                (w) =>
                  s.rozmiar.tryb === 'sloty' &&
                  (w.kolumny !== s.rozmiar.kolumny || w.rzedy !== s.rozmiar.rzedy),
              )
              .map((w) => ({ kolumny: w.kolumny, rzedy: w.rzedy })),
          ]
        : [{ kolumny: 1, rzedy: 1 }],
  }));
}

/** Czy szablon pasuje do slotu kartki (karta w mm – ten sam wymiar ±0,5 mm; sloty – ten sam slot). */
export function pasujeDoKartki(s: Szablon, u: UstawieniaArkusza): boolean {
  if (!u.slot) return true;
  const slot = slotSzablonu(s);
  return (
    Math.abs(slot.szerokosc - u.slot.szerokosc) <= 0.5 &&
    Math.abs(slot.wysokosc - u.slot.wysokosc) <= 0.5
  );
}

/** Opis rozmiaru szablonu dla użytkownika, np. „63×88 mm”. */
export function opisRozmiaruSzablonu(s: Szablon): string {
  const z = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');
  const slot = slotSzablonu(s);
  return `${z(slot.szerokosc)}×${z(slot.wysokosc)} mm`;
}

/**
 * Dodaje szablon z paczki do projektu; gdy żadna kartka nie ma jego rozmiaru – dokłada kartkę
 * dla niego (nazwa = nazwa szablonu).
 */
export function dodajSzablonZKartka(
  projekt: Projekt,
  zasoby: DaneZasobow,
  paczka: PaczkaSzablonu,
): { projekt: Projekt; zasoby: DaneZasobow; szablonId: string; ostrzezenia: string[] } {
  const w = dodajSzablon(projekt, zasoby, paczka);
  const s = w.projekt.szablony.find((x) => x.id === w.szablonId)!;
  if (w.projekt.arkusze.some((a) => pasujeDoKartki(s, a.ustawienia))) return w;
  const { projekt: zKartka } = dodajKartke(
    w.projekt,
    { nazwa: s.nazwa, ustawienia: ustawieniaKartkiDla(s) },
    s.nazwa,
    false,
  );
  return { ...w, projekt: zKartka };
}

/**
 * Nowy projekt własnych kart z zaimportowanego szablonu: czcionki domyślne, szablon (z jego
 * czcionkami i obrazami) i pusta kartka dopasowana do rozmiaru karty.
 */
export async function nowyProjektWlasny(
  paczka: PaczkaSzablonu,
  pobierzCzcionke: (plik: string) => Promise<Uint8Array>,
  id: string = crypto.randomUUID(),
): Promise<{ projekt: Projekt; zasoby: DaneZasobow }> {
  const pakiet: Pakiet = {
    id: PAKIET_WLASNY,
    nazwa: '',
    opis: '',
    atrybucja: '',
    czcionki: CZCIONKI_WLASNE,
    szablony: [],
    talie: [],
    arkusze: [],
    zasoby: [],
    typyKart: [],
    gotoweUklady: [],
    nowaKartka: { nazwa: '', ustawienia: ustawieniaKartkiDla(paczka.szablon) },
  };
  const pusty = await projektZPakietu(
    pakiet,
    pobierzCzcionke,
    () => Promise.reject(new Error('brak obrazów')),
    id,
  );
  const w = dodajSzablonZKartka(
    {
      ...pusty.projekt,
      nazwa: paczka.szablon.nazwa,
      pakiet: PAKIET_WLASNY,
      role: { tytul: 'EB Garamond', tresc: 'EB Garamond' },
    },
    pusty.zasoby,
    paczka,
  );
  return { projekt: w.projekt, zasoby: w.zasoby };
}

/**
 * Pakiet „w locie” dla projektu własnych kart (edytor kartki traktuje go jak pakiet gry): typy kart
 * z szablonów projektu, nowa kartka – z ustawieniami pierwszej kartki (ten sam rozmiar kart).
 */
export function pakietWlasny(projekt: Projekt): Pakiet {
  const pierwszy = projekt.szablony[0];
  const ustawienia =
    projekt.arkusze[0]?.ustawienia ??
    (pierwszy ? ustawieniaKartkiDla(pierwszy) : undefined) ??
    ustawieniaKartkiDla({
      id: '',
      nazwa: '',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      korzen: { id: 'k', typ: 'kolumna', dzieci: [] },
    });
  return {
    id: PAKIET_WLASNY,
    nazwa: '',
    opis: '',
    atrybucja: '',
    czcionki: CZCIONKI_WLASNE,
    szablony: [],
    talie: [],
    arkusze: [],
    zasoby: [],
    typyKart: typyZSzablonow(projekt.szablony),
    gotoweUklady: [],
    nowaKartka: { nazwa: '', ustawienia },
  };
}
