import type { Projekt } from '../model/projekt';
import type { Karta, PrzypisanieRewersu, Rewers, Szablon, Talia } from '../model/szablon';
import { unikalneId } from './czcionki';

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

type CelRewersu =
  | { rodzaj: 'szablon'; id: string }
  | { rodzaj: 'talia'; id: string }
  | { rodzaj: 'karta'; taliaId: string; id: string };

export function dodajRewers(p: Projekt, rewers: Rewers): { projekt: Projekt; id: string } {
  const id = unikalneId(rewers.id, new Set((p.rewersy ?? []).map((r) => r.id)));
  return {
    id,
    projekt: { ...p, rewersy: [...(p.rewersy ?? []), { ...rewers, id }], zmieniono: teraz() },
  };
}

const teraz = () => new Date().toISOString();

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
