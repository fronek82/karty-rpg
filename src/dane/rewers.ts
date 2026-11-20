import type { DaneZasobow, Projekt } from '../model/projekt';
import {
  DOMYSLNE_TLO_KARTY,
  type Karta,
  type PrzypisanieRewersu,
  type Rewers,
  type Szablon,
  type Talia,
} from '../model/szablon';
import { dodajZasoby } from './edycja';
import { unikalneId } from './czcionki';
import { opisObrazu } from './obrazy';
import { duplikujSzablon, nazwaKopiiSzablonu, zmienWezel, znajdzWezel } from './szablon';

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

export function nowyRewers(
  p: Projekt,
  opcje: {
    nazwa?: string;
    nazwaKorzenia?: string;
    rozmiar?: { szerokosc: number; wysokosc: number };
  } = {},
): { projekt: Projekt; id: string } {
  const pierwszyMm = p.szablony.find((s) => s.rozmiar.tryb === 'mm');
  const domyslny =
    pierwszyMm && pierwszyMm.rozmiar.tryb === 'mm'
      ? { szerokosc: pierwszyMm.rozmiar.szerokosc, wysokosc: pierwszyMm.rozmiar.wysokosc }
      : { szerokosc: 63, wysokosc: 88 };
  const rozm = opcje.rozmiar ?? domyslny;
  const istniejace = new Set((p.rewersy ?? []).map((r) => r.nazwa));
  const baza = opcje.nazwa ?? 'Rewers';
  let nazwa = baza;
  for (let n = 2; istniejace.has(nazwa); n++) nazwa = `${baza} ${n}`;
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
    ...(r.ramka !== undefined ? { ramka: r.ramka } : {}),
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
  const usunietoTeksture = oryginal.teksturaTla !== undefined && s.teksturaTla === undefined;
  if (!usunietoTeksture) {
    if (oryginal.teksturaTryb !== undefined) wynik.teksturaTryb = oryginal.teksturaTryb;
    if (oryginal.teksturaKrycie !== undefined) wynik.teksturaKrycie = oryginal.teksturaKrycie;
    if (oryginal.teksturaZabarwienie !== undefined)
      wynik.teksturaZabarwienie = structuredClone(oryginal.teksturaZabarwienie);
  }
  if (s.ramka !== undefined) wynik.ramka = s.ramka;
  return wynik;
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
  const skopiowany = szablonDoRewersu(r, duplikujSzablon(rewersJakoSzablon(r), noweId, nazwa));
  const kopia: Rewers = { ...skopiowany, id: noweId, nazwa };
  const rewersy = [...lista];
  rewersy.splice(i + 1, 0, kopia);
  return { projekt: { ...p, zmieniono: teraz(), rewersy }, id: noweId };
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
