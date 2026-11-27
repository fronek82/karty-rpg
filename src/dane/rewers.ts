import type { Arkusz } from '../model/arkusz';
import type { DaneZasobow, Projekt } from '../model/projekt';
import {
  czyKontener,
  DOMYSLNE_TLO_KARTY,
  wszystkieWezly,
  type Karta,
  type PrzypisanieRewersu,
  type Rewers,
  type Szablon,
  type Talia,
  type Wezel,
} from '../model/szablon';
import { t } from '../i18n';
import { dodajZasoby } from './edycja';
import { unikalneId } from './czcionki';
import { opisObrazu } from './obrazy';
import type { Mm } from '../model/jednostki';
import { ZESTAWY_STYLOW } from '../ozdobniki/zestawyStylow';
import {
  duplikujSzablon,
  nazwaKopiiSzablonu,
  zastosujZestawStylu,
  zmienWezel,
  znajdzWezel,
} from './szablon';

export function rewersKarty(
  rewersy: ReadonlyMap<string, Rewers>,
  karta: Pick<Karta, 'rewersId'>,
  szablon: Pick<Szablon, 'rewersId'>,
  talia: Pick<Talia, 'rewersId'>,
): Rewers | undefined {
  const id =
    karta.rewersId !== undefined
      ? karta.rewersId
      : szablon.rewersId !== undefined
        ? szablon.rewersId
        : talia.rewersId;
  return typeof id === 'string' ? rewersy.get(id) : undefined;
}

/**
 * Czy druk dwustronny jest aktywny dla arkusza: jawne ustawienie ma pierwszeństwo,
 * a bez niego druk dwustronny włącza się domyślnie, gdy talia lub choć jedna karta ma rewers.
 */
export function czyDwustronnyWlaczony(
  arkusz: Pick<Arkusz, 'taliaId' | 'ustawienia'>,
  talia: Talia | undefined,
  szablony: ReadonlyMap<string, Szablon>,
  rewersy: ReadonlyMap<string, Rewers>,
): boolean {
  if (arkusz.ustawienia.dwustronny !== undefined) return arkusz.ustawienia.dwustronny.wlaczony;
  if (rewersy.size === 0 || !talia) return false;
  if (typeof talia.rewersId === 'string' && rewersy.has(talia.rewersId)) return true;
  return talia.karty.some((k) => {
    const s = szablony.get(k.szablonId);
    return s ? !!rewersKarty(rewersy, k, s, talia) : false;
  });
}

export function zrodloRewersuKarty(
  rewersy: ReadonlyMap<string, Rewers>,
  karta: Pick<Karta, 'rewersId'>,
  szablon: Pick<Szablon, 'rewersId'>,
  talia: Pick<Talia, 'rewersId'>,
): { rewers?: Rewers; skad: 'karta' | 'szablon' | 'talia' | 'brak'; wylaczony?: boolean } {
  if (karta.rewersId !== undefined) {
    if (karta.rewersId === null) return { skad: 'karta', wylaczony: true };
    const r = rewersy.get(karta.rewersId);
    return r ? { rewers: r, skad: 'karta' } : { skad: 'brak' };
  }
  if (szablon.rewersId !== undefined) {
    if (szablon.rewersId === null) return { skad: 'szablon', wylaczony: true };
    const r = rewersy.get(szablon.rewersId);
    return r ? { rewers: r, skad: 'szablon' } : { skad: 'brak' };
  }
  if (typeof talia.rewersId === 'string') {
    const r = rewersy.get(talia.rewersId);
    return r ? { rewers: r, skad: 'talia' } : { skad: 'brak' };
  }
  return { skad: 'brak' };
}

type CelRewersu =
  | { rodzaj: 'szablon'; id: string }
  | { rodzaj: 'talia'; id: string }
  | { rodzaj: 'karta'; taliaId: string; id: string };

const teraz = () => new Date().toISOString();

export function dodajRewers(p: Projekt, rewers: Rewers): { projekt: Projekt; id: string } {
  const id = unikalneId(rewers.id, new Set((p.rewersy ?? []).map((r) => r.id)));
  return {
    id,
    projekt: { ...p, rewersy: [...(p.rewersy ?? []), { ...rewers, id }], zmieniono: teraz() },
  };
}

/**
 * Nazwa niezajęta (bez względu na wielkość liter i skrajne spacje): `baza`, a gdy zajęta –
 * `baza 2`, `baza 3`…
 */
export function unikalnaNazwa(baza: string, zajete: Iterable<string>): string {
  const norm = (n: string) => n.trim().toLowerCase();
  const zbior = new Set([...zajete].map(norm));
  let nazwa = baza;
  for (let n = 2; zbior.has(norm(nazwa)); n++) nazwa = `${baza} ${n}`;
  return nazwa;
}

/**
 * Nowy pusty rewers. Nazwa (domyślnie z i18n) jest unikalna wśród rewersów projektu
 * i nazw z `zajeteNazwy` (np. rewersów z innych projektów w przeglądarce).
 */
export function nowyRewers(
  p: Projekt,
  opcje: {
    nazwa?: string;
    nazwaKorzenia?: string;
    rozmiar?: { szerokosc: number; wysokosc: number };
    zajeteNazwy?: Iterable<string>;
  } = {},
): { projekt: Projekt; id: string } {
  const pierwszyMm = p.szablony.find((s) => s.rozmiar.tryb === 'mm');
  const domyslny =
    pierwszyMm && pierwszyMm.rozmiar.tryb === 'mm'
      ? { szerokosc: pierwszyMm.rozmiar.szerokosc, wysokosc: pierwszyMm.rozmiar.wysokosc }
      : { szerokosc: 63, wysokosc: 88 };
  const rozm = opcje.rozmiar ?? domyslny;
  const nazwa = unikalnaNazwa(opcje.nazwa ?? t('wlasne.rewersNazwa'), [
    ...(p.rewersy ?? []).map((r) => r.nazwa),
    ...(opcje.zajeteNazwy ?? []),
  ]);
  return dodajRewers(p, {
    id: 'rewers',
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: rozm.szerokosc, wysokosc: rozm.wysokosc },
    tlo: DOMYSLNE_TLO_KARTY,
    korzen: {
      id: 'rewers',
      nazwa: opcje.nazwaKorzenia ?? nazwa,
      typ: 'swobodny',
      dzieci: [],
    },
  });
}

/** Gotowe układy tyłu karty w kreatorze („Zacznij od układu”). */
export const UKLADY_TYLU = ['pusty', 'logo', 'wzor', 'ornament'] as const;
export type UkladTylu = (typeof UKLADY_TYLU)[number];

/**
 * Tył karty z kreatora: rozmiar, rogi, kolor i układ startowy – pusta karta, grafika (logo)
 * na środku, wzór na całą kartę albo ramka z ornamentem. Nazwy elementów z i18n wołającego.
 */
export function nowyTyl(
  id: string,
  o: { nazwa: string; szer: Mm; wys: Mm; promien: Mm; tlo: string; uklad: UkladTylu },
  nazwaGrafiki: string,
): Rewers {
  const ciemny = jasnosc(o.tlo) < 0.5;
  const kontrast = ciemny ? '#ffffff' : '#000000';
  const r: Rewers = {
    id,
    nazwa: o.nazwa,
    rozmiar: { tryb: 'mm', szerokosc: o.szer, wysokosc: o.wys },
    promienRogow: o.promien,
    tlo: o.tlo,
    korzen: { id, nazwa: o.nazwa, typ: 'swobodny', dzieci: [] },
  };
  if (o.uklad === 'logo') {
    const bok = Math.round(Math.min(o.szer, o.wys) * 0.5);
    r.korzen = {
      ...r.korzen,
      dzieci: [
        {
          id: `${id}-grafika`,
          nazwa: nazwaGrafiki,
          typ: 'obraz',
          dopasowanie: 'dopasuj',
          szerokosc: { mm: bok },
          wysokosc: { mm: bok },
          pozycja: { x: 0, y: 0, kotwica: 'srodek' },
        },
      ],
    };
  } else if (o.uklad === 'wzor') {
    r.wzorTla = { rodzaj: 'romby', grubosc: 0.4, odstep: 6, kolor: kontrast, krycie: 0.25 };
  } else if (o.uklad === 'ornament') {
    const ozdobny = szablonDoRewersu(
      r,
      zastosujZestawStylu(rewersJakoSzablon(r), ZESTAWY_STYLOW[0]),
    );
    return { ...ozdobny, ramka: { ...ozdobny.ramka!, odsuniecie: 3 } };
  }
  return r;
}

/** Względna jasność koloru `#rrggbb` (0 – czarny, 1 – biały). */
function jasnosc(kolor: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(kolor);
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function zmienRewers(p: Projekt, id: string, f: (r: Rewers) => Rewers): Projekt {
  const r = p.rewersy?.find((x) => x.id === id);
  const nowy = r && f(r);
  if (!r || nowy === r) return p;
  return {
    ...p,
    zmieniono: teraz(),
    rewersy: (p.rewersy ?? []).map((x) => (x.id === id ? nowy! : x)),
  };
}

export function rewersJakoSzablon(r: Rewers): Szablon {
  return {
    id: r.id,
    nazwa: r.nazwa,
    rozmiar: r.rozmiar,
    korzen: r.korzen,
    ...(r.tlo !== undefined ? { tlo: r.tlo } : {}),
    ...(r.teksturaTla !== undefined ? { teksturaTla: r.teksturaTla } : {}),
    ...(r.wzorTla ? { wzorTla: structuredClone(r.wzorTla) } : {}),
    ...(r.ramka !== undefined ? { ramka: r.ramka } : {}),
    ...(r.promienRogow !== undefined ? { promienRogow: r.promienRogow } : {}),
    ...(r.postrzepienie !== undefined ? { postrzepienie: structuredClone(r.postrzepienie) } : {}),
    // Teksty przykładowe tyłu (id pola → tekst) – w widoku szablonu jako `przyklad`.
    ...(r.przyklad ? { przyklad: { ...r.przyklad } } : {}),
    ...(r.liniePomocnicze?.length ? { liniePomocnicze: structuredClone(r.liniePomocnicze) } : {}),
  };
}

export function szablonDoRewersu(oryginal: Rewers, s: Szablon): Rewers {
  const wynik: Rewers = {
    id: oryginal.id,
    nazwa: s.nazwa,
    rozmiar: s.rozmiar.tryb === 'mm' ? s.rozmiar : oryginal.rozmiar,
    korzen:
      s.korzen.typ === 'swobodny'
        ? (s.korzen as Rewers['korzen'])
        : { ...oryginal.korzen, dzieci: s.korzen.dzieci },
  };
  if (s.tlo !== undefined) wynik.tlo = s.tlo;
  if (s.teksturaTla !== undefined) wynik.teksturaTla = s.teksturaTla;
  if (s.wzorTla !== undefined) wynik.wzorTla = structuredClone(s.wzorTla);
  const usunietoTeksture = oryginal.teksturaTla !== undefined && s.teksturaTla === undefined;
  if (!usunietoTeksture) {
    if (oryginal.teksturaTryb !== undefined) wynik.teksturaTryb = oryginal.teksturaTryb;
    if (oryginal.teksturaKrycie !== undefined) wynik.teksturaKrycie = oryginal.teksturaKrycie;
    if (oryginal.teksturaZabarwienie !== undefined)
      wynik.teksturaZabarwienie = structuredClone(oryginal.teksturaZabarwienie);
  }
  if (s.ramka !== undefined) wynik.ramka = s.ramka;
  if (s.promienRogow !== undefined) wynik.promienRogow = s.promienRogow;
  if (s.postrzepienie !== undefined) wynik.postrzepienie = structuredClone(s.postrzepienie);
  if (s.liniePomocnicze?.length) wynik.liniePomocnicze = structuredClone(s.liniePomocnicze);
  // Przykłady tylko niepuste i tylko istniejących pól tekstu/wartości (bez martwych wpisów).
  const ids = new Set(
    wszystkieWezly(wynik)
      .filter((w) => w.typ === 'tekst' || w.typ === 'wartosc')
      .map((w) => w.id),
  );
  const przyklad = Object.entries(s.przyklad ?? {}).filter(([id, v]) => v !== '' && ids.has(id));
  if (przyklad.length) wynik.przyklad = Object.fromEntries(przyklad);
  return wynik;
}

/**
 * Tył do podglądu w edytorze: pola z tekstem przykładowym (`przyklad`) pokazują go zamiast stałego
 * tekstu. Na kartach i w druku przykłady nie biorą udziału.
 */
export function rewersZPrzykladami(r: Rewers): Rewers {
  const { przyklad, ...bez } = r;
  if (!przyklad) return r;
  const podmien = (w: Wezel): Wezel => {
    if (czyKontener(w)) return { ...w, dzieci: w.dzieci.map(podmien) };
    const v = przyklad[w.id];
    return v && (w.typ === 'tekst' || w.typ === 'wartosc') ? { ...w, tekst: v } : w;
  };
  return { ...bez, korzen: podmien(bez.korzen) as Rewers['korzen'] };
}

export function duplikujRewersWProjekcie(
  p: Projekt,
  id: string,
  sufiks: (n: number) => string,
): { projekt: Projekt; id: string } {
  const lista = p.rewersy ?? [];
  const i = lista.findIndex((x) => x.id === id);
  const r = lista[i];
  if (!r) return { projekt: p, id: '' };
  const noweId = unikalneId(
    `${r.id.replace(/-kopia(-\d+)?$/, '')}-kopia`,
    new Set(lista.map((x) => x.id)),
  );
  const nazwa = nazwaKopiiSzablonu(
    r.nazwa,
    lista.map((x) => x.nazwa),
    sufiks,
  );
  const widok = rewersJakoSzablon(r);
  const duplikat = duplikujSzablon(widok, noweId, nazwa);
  // Przykłady tyłu są po id pól – kopia dostaje je pod nowymi id (to samo drzewo, ta sama kolejność).
  if (r.przyklad) {
    const stare = wszystkieWezly(widok);
    const nowe = wszystkieWezly(duplikat);
    const przyklad: Record<string, string> = {};
    stare.forEach((w, n) => {
      const v = r.przyklad![w.id];
      if (v !== undefined && nowe[n]) przyklad[nowe[n].id] = v;
    });
    duplikat.przyklad = przyklad;
  }
  const skopiowany = szablonDoRewersu(r, duplikat);
  const kopia: Rewers = { ...skopiowany, id: noweId, nazwa };
  const rewersy = [...lista];
  rewersy.splice(i + 1, 0, kopia);
  return { projekt: { ...p, zmieniono: teraz(), rewersy }, id: noweId };
}

/**
 * Przód, z którego tył bierze dane kart (pola o tej samej nazwie): szablon z tym tyłem, potem
 * szablon pierwszej karty z tym tyłem (na karcie, szablonie albo talii). Brak – `undefined`.
 */
export function przodRewersu(p: Projekt, id: string): Szablon | undefined {
  const przypisany = p.szablony.find((s) => s.rewersId === id);
  if (przypisany) return przypisany;
  const szablony = new Map(p.szablony.map((s) => [s.id, s]));
  const rewersy = new Map((p.rewersy ?? []).map((r) => [r.id, r]));
  for (const talia of p.talie)
    for (const karta of talia.karty) {
      const s = szablony.get(karta.szablonId);
      if (s && rewersKarty(rewersy, karta, s, talia)?.id === id) return s;
    }
  return undefined;
}

export function przypisaniaRewersu(
  p: Projekt,
  id: string,
): { szablony: number; talie: number; karty: number; razem: number } {
  const szablony = p.szablony.filter((s) => s.rewersId === id).length;
  const talie = p.talie.filter((t) => t.rewersId === id).length;
  let karty = 0;
  for (const t of p.talie) karty += t.karty.filter((k) => k.rewersId === id).length;
  return { szablony, talie, karty, razem: szablony + talie + karty };
}

export function ustawStalyObrazRewersu(
  p: Projekt,
  dane: DaneZasobow,
  rewersId: string,
  poleId: string,
  plik: string,
  obraz: { dane: Uint8Array; szerokosc: number; wysokosc: number },
): { projekt: Projekt; dane: DaneZasobow } {
  const r = p.rewersy?.find((x) => x.id === rewersId);
  const pole = r && znajdzWezel(rewersJakoSzablon(r), poleId);
  if (!r || pole?.typ !== 'obraz' || pole.klucz) return { projekt: p, dane };
  const zajete = new Set([...p.zasoby.map((z) => z.id), ...dane.keys()]);
  const opis = opisObrazu(plik, obraz.dane, obraz, zajete);
  const wynik = dodajZasoby(p, dane, [{ opis, dane: obraz.dane }]);
  const projekt = zmienRewers(wynik.projekt, rewersId, (rev) =>
    szablonDoRewersu(
      rev,
      zmienWezel(rewersJakoSzablon(rev), poleId, () => ({ ...pole, zasob: opis.id })),
    ),
  );
  return { projekt, dane: wynik.dane };
}

export function ustawTekstureRewersu(
  p: Projekt,
  dane: DaneZasobow,
  rewersId: string,
  plik: string,
  obraz: { dane: Uint8Array; szerokosc: number; wysokosc: number },
): { projekt: Projekt; dane: DaneZasobow } {
  const r = p.rewersy?.find((x) => x.id === rewersId);
  if (!r) return { projekt: p, dane };
  const zajete = new Set([...p.zasoby.map((z) => z.id), ...dane.keys()]);
  const opis = opisObrazu(plik, obraz.dane, obraz, zajete);
  const wynik = dodajZasoby(p, dane, [{ opis, dane: obraz.dane }]);
  const projekt = zmienRewers(wynik.projekt, rewersId, (rev) => ({
    ...rev,
    teksturaTla: opis.id,
  }));
  return { projekt, dane: wynik.dane };
}

export function przypiszRewers(
  p: Projekt,
  cel: CelRewersu,
  id: PrzypisanieRewersu | undefined,
): Projekt {
  if (typeof id === 'string' && !p.rewersy?.some((r) => r.id === id)) return p;
  const przypisz = <T extends { rewersId?: PrzypisanieRewersu }>(x: T): T => {
    if (x.rewersId === id) return x;
    const y = { ...x };
    if (id === undefined) delete y.rewersId;
    else y.rewersId = id;
    return y;
  };
  const szablony =
    cel.rodzaj === 'szablon'
      ? p.szablony.map((s) => (s.id === cel.id ? przypisz(s) : s))
      : p.szablony;
  const talie =
    cel.rodzaj === 'szablon'
      ? p.talie
      : p.talie.map((t) => {
          if (cel.rodzaj === 'talia') return t.id === cel.id ? przypisz(t) : t;
          if (t.id !== cel.taliaId) return t;
          const karty = t.karty.map((k) => (k.id === cel.id ? przypisz(k) : k));
          return karty.some((k, i) => k !== t.karty[i]) ? { ...t, karty } : t;
        });
  if (!szablony.some((s, i) => s !== p.szablony[i]) && !talie.some((t, i) => t !== p.talie[i]))
    return p;
  return { ...p, szablony, talie, zmieniono: teraz() };
}

export function przypiszRewersKartom(
  p: Projekt,
  taliaId: string,
  kartaIds: readonly string[],
  id: PrzypisanieRewersu | undefined,
): Projekt {
  return kartaIds.reduce(
    (akt, kId) => przypiszRewers(akt, { rodzaj: 'karta', taliaId, id: kId }, id),
    p,
  );
}

/** W chwili usunięcia istniejące bezpośrednie przypisania stają się „bez rewersu”. */
export function usunRewers(p: Projekt, id: string): Projekt {
  if (!p.rewersy?.some((r) => r.id === id)) return p;
  const odlacz = <T extends { rewersId?: PrzypisanieRewersu }>(x: T): T =>
    x.rewersId === id ? { ...x, rewersId: null } : x;
  return {
    ...p,
    rewersy: p.rewersy.filter((r) => r.id !== id),
    szablony: p.szablony.map(odlacz),
    talie: p.talie.map((t) => {
      const karty = t.karty.map(odlacz);
      const nast = odlacz(t);
      return karty.some((k, i) => k !== t.karty[i]) ? { ...nast, karty } : nast;
    }),
    zmieniono: teraz(),
  };
}
