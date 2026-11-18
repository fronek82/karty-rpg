import { slotKartki } from '../druk/arkusz';
import { pakietProjektu } from '../druk/normalizacja';
import { formatujLiczbe, t } from '../i18n';
import {
  czyFormatZdjeciowy,
  MARGINES_BEZPIECZENSTWA_FOTO,
  SLOT_DOMYSLNY,
  DOPASOWANIE_DOMYSLNE,
  pasujeDoSlotu as pasujeDoSlotuMm,
  type DopasowanieDoSlotu,
  wymiaryStrony,
  type Papier,
  type UstawieniaArkusza,
} from '../model/arkusz';
import { pt, type Mm } from '../model/jednostki';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { wymiaryKarty, type Szablon } from '../model/szablon';
import type { Pakiet, TypKarty } from '../pakiety/typy';
import { projektZPakietu } from './pakiet';
import { dodajSzablon, type PaczkaSzablonu } from './archiwum';
import { dodajKarteWSlocie, dodajKartke } from './kartka';

/**
 * Projekty „własnych kart” (bez pakietu gry): typy kart w menu kartki pochodzą z szablonów
 * projektu, a kartka ma slot równy wymiarowi karty (karty w mm) albo slot szablonu (sloty).
 */

/** Identyfikator projektu własnych kart w `Projekt.pakiet` (nie ma go w rejestrze gier). */
export const PAKIET_WLASNY = 'wlasne';

/** Pseudo-pakiet: tylko czcionka domyślna (EB Garamond, OFL); rola tytułu – ta sama rodzina. */
const RODZINA_DOMYSLNA = 'EB Garamond';
const CZCIONKI_WLASNE: Pakiet['czcionki'] = [
  {
    rola: 'tresc',
    rodzina: RODZINA_DOMYSLNA,
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
    dopasowanie: { ...DOPASOWANIE_DOMYSLNE },
  };
  const pozioma: UstawieniaArkusza = { ...baza, orientacja: 'pozioma' };
  return slotyNaStronie(pozioma, baza.slot!).razem > slotyNaStronie(baza, baza.slot!).razem
    ? pozioma
    : baza;
}

/** Typy kart w menu kartki z szablonów projektu (jeden szablon = jedna pozycja). */
export function typyZSzablonow(szablony: readonly Szablon[]): TypKarty[] {
  return szablony.map((s) => {
    const r = s.rozmiar;
    const rozmiary: TypKarty['rozmiary'] = [{ kolumny: 1, rzedy: 1 }];
    if (r.tryb === 'sloty') {
      // Rozmiar domyślny i rozmiary wariantów układu, bez powtórzeń.
      const klucze = new Set<string>();
      rozmiary.length = 0;
      for (const x of [r, ...(s.warianty ?? [])]) {
        const k = `${x.kolumny}×${x.rzedy}`;
        if (klucze.has(k)) continue;
        klucze.add(k);
        rozmiary.push({ kolumny: x.kolumny, rzedy: x.rzedy });
      }
    }
    return {
      id: s.id,
      nazwa: s.nazwa,
      ikona: '▤',
      warianty: [{ szablonId: s.id, nazwa: s.nazwa }],
      opisRozmiaru: opisRozmiaruSzablonu(s),
      rozmiary,
    };
  });
}

/** Czy szablon pasuje do slotu kartki (luz z jej `dopasowanie`, bez niego ±0,5 mm). */
export function pasujeDoSlotu(
  s: Szablon,
  slot: { szerokosc: Mm; wysokosc: Mm },
  dopasowanie?: Pick<DopasowanieDoSlotu, 'luz'>,
): boolean {
  return pasujeDoSlotuMm(slotSzablonu(s), slot, dopasowanie);
}

/** Opis rozmiaru karty szablonu dla użytkownika, np. „63×88 mm” (domyślny rozmiar karty). */
export function opisRozmiaruSzablonu(s: Szablon): string {
  const z = (x: number) => formatujLiczbe(x, 1);
  const { szer, wys } = wymiaryKarty(s);
  return t('rozmiar.mm', { szer: z(szer), wys: z(wys) });
}

/**
 * Dodaje szablon z paczki do projektu; gdy żadna kartka nie ma jego rozmiaru – dokłada kartkę
 * dla niego (nazwa = nazwa szablonu, papier jak pierwsza kartka). Projekt bez pakietu staje się
 * projektem własnych kart. Brakujące role czcionek dostają czcionkę domyślną.
 */
export function dodajSzablonZKartka(
  projekt: Projekt,
  zasoby: DaneZasobow,
  paczka: PaczkaSzablonu,
): {
  projekt: Projekt;
  zasoby: DaneZasobow;
  szablonId: string;
  ostrzezenia: string[];
  nowaKartka: boolean;
} {
  const w = dodajSzablon(projekt, zasoby, paczka);
  const s = w.projekt.szablony.find((x) => x.id === w.szablonId)!;
  const p: Projekt = {
    ...w.projekt,
    pakiet: w.projekt.pakiet ?? PAKIET_WLASNY,
    role: { tytul: RODZINA_DOMYSLNA, tresc: RODZINA_DOMYSLNA, ...w.projekt.role },
  };
  const szablony = new Map(p.szablony.map((x) => [x.id, x]));
  const talia = (a: Projekt['arkusze'][number]) => p.talie.find((x) => x.id === a.taliaId);
  if (
    p.arkusze.some((a) =>
      pasujeDoSlotu(s, slotKartki(a, talia(a), szablony), a.ustawienia.dopasowanie),
    )
  )
    return { ...w, projekt: p, nowaKartka: false };
  const wzor = p.arkusze[0]?.ustawienia;
  const { projekt: zKartka } = dodajKartke(
    p,
    { nazwa: s.nazwa, ustawienia: ustawieniaKartkiDla(s, wzor?.papier, wzor?.wymiaryPapieru) },
    s.nazwa,
    false,
  );
  return { ...w, projekt: zKartka, nowaKartka: true };
}

/**
 * Nowy projekt własnych kart z zaimportowanego szablonu: czcionki domyślne (role szablonu mają
 * pierwszeństwo), szablon (z jego czcionkami i obrazami) i pusta kartka dopasowana do karty.
 */
export async function nowyProjektWlasny(
  paczka: PaczkaSzablonu,
  pobierzCzcionke: (plik: string) => Promise<Uint8Array>,
  id: string = crypto.randomUUID(),
): Promise<{ projekt: Projekt; zasoby: DaneZasobow; ostrzezenia: string[] }> {
  const pusty = await projektZPakietu(
    pakietWlasny([]),
    pobierzCzcionke,
    () => Promise.reject(new Error('brak obrazów')),
    id,
  );
  // Bez ról – role z szablonu wchodzą bez konfliktu, brakujące uzupełnia dodajSzablonZKartka.
  const w = dodajSzablonZKartka(
    { ...pusty.projekt, nazwa: paczka.szablon.nazwa, pakiet: PAKIET_WLASNY, role: {} },
    pusty.zasoby,
    paczka,
  );
  return { projekt: w.projekt, zasoby: w.zasoby, ostrzezenia: w.ostrzezenia };
}

/**
 * Nowy projekt własnych kart z przykładowego szablonu: szablon, kartka dopasowana do rozmiaru
 * karty (jak przy imporcie szablonu) i jedna karta z danymi przykładowymi w pierwszym slocie.
 */
export async function nowyProjektZPrzykladu(
  przyklad: { szablon: Szablon; dane: Record<string, string> },
  pobierzCzcionke: (plik: string) => Promise<Uint8Array>,
  id: string = crypto.randomUUID(),
): Promise<{ projekt: Projekt; zasoby: DaneZasobow }> {
  const { projekt, zasoby } = await nowyProjektWlasny(
    { szablon: przyklad.szablon, role: {}, zasoby: [], dane: new Map() },
    pobierzCzcionke,
    id,
  );
  const szablon = projekt.szablony[0]!;
  const arkusz = projekt.arkusze[0]!;
  const { kolumny, rzedy } = slotyNaStronie(arkusz.ustawienia, slotSzablonu(szablon));
  const w = dodajKarteWSlocie(
    projekt,
    arkusz.id,
    { strona: 0, kolumna: 0, rzad: 0 },
    { szablonId: szablon.id, rozmiary: [{ kolumny: 1, rzedy: 1 }], dane: przyklad.dane },
    { szablony: new Map([[szablon.id, szablon]]), siatka: { kolumny, rzedy } },
  );
  if ('blad' in w) throw new Error(`Karta przykładowa nie mieści się na kartce (${w.blad}).`);
  return { projekt: w.projekt, zasoby };
}

/**
 * Pakiet „w locie” dla projektu własnych kart (edytor kartki traktuje go jak pakiet gry): typy kart
 * z szablonów projektu; nowa kartka – dla pierwszego szablonu (edytor bierze zwykle ustawienia
 * zaznaczonej kartki).
 */
export function pakietWlasny(szablony: readonly Szablon[]): Pakiet {
  const pierwszy = szablony[0] ?? {
    id: '',
    nazwa: '',
    rozmiar: { tryb: 'mm', szerokosc: SLOT_DOMYSLNY.szerokosc, wysokosc: SLOT_DOMYSLNY.wysokosc },
    korzen: { id: 'k', typ: 'kolumna', dzieci: [] },
  };
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
    typyKart: typyZSzablonow(szablony),
    gotoweUklady: [],
    nowaKartka: { nazwa: '', ustawienia: ustawieniaKartkiDla(pierwszy) },
  };
}

/**
 * Zmiana rozmiaru karty szablonu (mm). Kartki, na których są tylko karty tego szablonu (albo
 * żadne, a slot był równy staremu rozmiarowi), dostają slot nowego rozmiaru – karty dalej
 * pasują; reszta kartek zostaje (karta innego rozmiaru – ostrzeżenie).
 */
export function zmienRozmiarSzablonu(p: Projekt, szablonId: string, szer: Mm, wys: Mm): Projekt {
  const s = p.szablony.find((x) => x.id === szablonId);
  if (!s || s.rozmiar.tryb !== 'mm') return p;
  const nowy: Szablon = { ...s, rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys } };
  // Karta, która nie zmieści się na żadnej stronie kartki – zmiana odrzucona (wołający pokazuje komunikat).
  const slot = { szerokosc: szer, wysokosc: wys };
  if (
    p.arkusze.some(
      (a) =>
        pasujeDoSlotu(
          s,
          slotKartki(
            a,
            p.talie.find((x) => x.id === a.taliaId),
            new Map(p.szablony.map((x) => [x.id, x])),
          ),
          a.ustawienia.dopasowanie,
        ) &&
        slotyNaStronie(a.ustawienia, slot).razem === 0 &&
        slotyNaStronie(
          {
            ...a.ustawienia,
            orientacja: a.ustawienia.orientacja === 'pionowa' ? 'pozioma' : 'pionowa',
          },
          slot,
        ).razem === 0,
    )
  )
    return p;
  const szablony = new Map(p.szablony.map((x) => [x.id, x]));
  return {
    ...p,
    zmieniono: new Date().toISOString(),
    szablony: p.szablony.map((x) => (x.id === szablonId ? nowy : x)),
    arkusze: p.arkusze.map((a) => {
      const talia = p.talie.find((x) => x.id === a.taliaId);
      const karty = talia?.karty ?? [];
      const tylkoTen = karty.length > 0 && karty.every((k) => k.szablonId === szablonId);
      const pustaTegoRozmiaru =
        karty.length === 0 &&
        pasujeDoSlotu(s, slotKartki(a, talia, szablony), a.ustawienia.dopasowanie);
      if (!tylkoTen && !pustaTegoRozmiaru) return a;
      // Nowy slot; orientacja ta, w której mieści się więcej kart.
      const u = { ...a.ustawienia, slot };
      const druga = {
        ...u,
        orientacja: u.orientacja === 'pionowa' ? ('pozioma' as const) : ('pionowa' as const),
      };
      return {
        ...a,
        ustawienia: slotyNaStronie(druga, slot).razem > slotyNaStronie(u, slot).razem ? druga : u,
      };
    }),
  };
}

/**
 * Kartka dla szablonu: istniejąca o jego rozmiarze albo nowa (bez tytułu, papier jak pierwsza
 * kartka). Zwraca projekt i id kartki.
 */
export function kartkaDlaSzablonu(
  p: Projekt,
  szablonId: string,
): { projekt: Projekt; arkuszId: string } {
  const s = p.szablony.find((x) => x.id === szablonId);
  if (!s) throw new Error(`Brak szablonu „${szablonId}”.`);
  const szablony = new Map(p.szablony.map((x) => [x.id, x]));
  const jest = p.arkusze.find((a) =>
    pasujeDoSlotu(
      s,
      slotKartki(
        a,
        p.talie.find((x) => x.id === a.taliaId),
        szablony,
      ),
      a.ustawienia.dopasowanie,
    ),
  );
  if (jest) return { projekt: p, arkuszId: jest.id };
  const wzor = p.arkusze[0]?.ustawienia;
  return dodajKartke(
    p,
    { nazwa: s.nazwa, ustawienia: ustawieniaKartkiDla(s, wzor?.papier, wzor?.wymiaryPapieru) },
    s.nazwa,
    false,
  );
}

/** Projekt własnych kart (bez pakietu gry) – szablony edytuje się w edytorze od zera. */
export function czyProjektWlasny(p: Projekt): boolean {
  const id = pakietProjektu(p);
  return id === undefined || id === PAKIET_WLASNY;
}
