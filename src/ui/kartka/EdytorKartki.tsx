import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { eksportujProjekt, ROZSZERZENIE_PROJEKTU } from '../../dane/archiwum';
import {
  dodajKarteWSlocie,
  dodajKartke,
  dodajNaglowek,
  dodajStrone,
  duplikujKarty,
  kartyKartki,
  kartyWObszarze,
  liczbaStronKartki,
  przesunKarty,
  usunKarty,
  usunNaglowek,
  usunStrone,
  zmienNaglowek,
  type BladKartki,
  type KartaNaKartce,
  type KontekstKartki,
  type Polozenie,
} from '../../dane/kartka';
import { zbudujArkusz, zSzarymiObrazami, type WynikArkusza } from '../../druk/arkusz';
import { pakietProjektu } from '../../druk/normalizacja';
import { t } from '../../i18n';
import type { Arkusz } from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import {
  czyKontener,
  korzenKarty,
  type Karta,
  type PoleObraz,
  type Talia,
  type Wezel,
} from '../../model/szablon';
import { gry } from '../../pakiety/gry';
import type { Pakiet, TypKarty } from '../../pakiety/typy';
import type { Ostrzezenie } from '../../silnik/karta';
import type { Scena } from '../../silnik/scena';
import { scenaDoSvg } from '../../silnik/svg';
import { baza } from '../baza';
import { tekstOstrzezeniaArkusza } from '../ostrzezenia';
import { pdfWWatku } from '../pdfWWatku';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { useZSzarymiObrazami } from '../szareObrazy';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import type { ZasobyPakietu } from '../zasoby';
import { geometria, slotPodPunktem, stylMm, stylProstokata, type Geometria } from './geometria';
import { MenuTypu } from './MenuTypu';
import { skalaZKolka, zaokr, zmienObrazKarty } from './obrazKarty';
import { PanelKart } from './PanelKart';
import { PanelNaglowka } from './PanelNaglowka';
import { PanelUstawien } from './PanelUstawien';

type Zaznaczenie =
  | { rodzaj: 'karty'; arkuszId: string; ids: string[] }
  | { rodzaj: 'naglowek'; arkuszId: string; id: string }
  | { rodzaj: 'ustawienia'; arkuszId: string }
  | undefined;

type Gest =
  | {
      rodzaj: 'karty';
      arkuszId: string;
      stronaStart: number;
      slotStart: { kolumna: number; rzad: number };
      ids: string[];
      klik: string;
      x0: number;
      y0: number;
      ruch: boolean;
      o?: Polozenie;
      blad?: BladKartki;
    }
  | {
      rodzaj: 'obszar';
      arkuszId: string;
      strona: number;
      start?: { kolumna: number; rzad: number };
      koniec?: { kolumna: number; rzad: number };
      slot?: { kolumna: number; rzad: number };
      shift: boolean;
      x0: number;
      y0: number;
      ruch: boolean;
    }
  | {
      rodzaj: 'obraz';
      arkuszId: string;
      taliaId: string;
      kartaId: string;
      poleId: string;
      x0: number;
      y0: number;
      mmNaPx: number;
    };

interface Kartka {
  arkusz: Arkusz;
  talia: Talia;
  wynik?: WynikArkusza;
  geometria?: Geometria;
  svg: string[];
  blad?: string;
}

const PROG_RUCHU = 4;

/** Pakiet gry projektu (typy kart, gotowe układy) – ładowany z rejestru gier. */
function usePakiet(id: string | undefined): Pakiet | undefined {
  const [pakiet, ustawPakiet] = useState<{ id: string; p: Pakiet }>();
  useEffect(() => {
    const gra = gry.find((g) => g.id === id);
    if (!gra?.pakiet) return;
    let aktywny = true;
    void gra.pakiet().then((p) => aktywny && ustawPakiet({ id: gra.id, p }));
    return () => {
      aktywny = false;
    };
  }, [id]);
  return pakiet && pakiet.id === id ? pakiet.p : undefined;
}

function poleObrazu(k: Karta, z: ZasobyPakietu): PoleObraz | undefined {
  const s = z.szablony.get(k.szablonId);
  if (!s) return undefined;
  const szukaj = (w: Wezel): PoleObraz | undefined =>
    czyKontener(w) ? w.dzieci.map(szukaj).find(Boolean) : w.typ === 'obraz' ? w : undefined;
  return szukaj(korzenKarty(s, k));
}

const wPolu = (e: Element | null) =>
  !!e &&
  (e.matches('input, textarea, select, [contenteditable="true"]') || !!e.closest('[role="menu"]'));

/** Edytor kartki: strony A4 z siatką slotów, karty klikane, przeciągane i edytowane w panelu. */
export function EdytorKartki({ edycja }: { edycja: ProjektWEdycji }) {
  const { projekt, zmien } = edycja;
  const pakiet = usePakiet(pakietProjektu(projekt));
  const zasoby = useZSzarymiObrazami(edycja.zasoby.zasoby, projekt);
  const [zazn, ustawZazn] = useState<Zaznaczenie>();
  const [menu, ustawMenu] = useState<{ arkuszId: string } & Polozenie>();
  const [gest, ustawGest] = useState<Gest>();
  const gestRef = useRef<Gest | undefined>(undefined);
  const [toast, ustawToast] = useState<{ tekst: string; cofnij?: boolean }>();
  const [bladUkladu, ustawBladUkladu] = useState<string>();
  const [statusPdf, ustawStatusPdf] = useState('');
  const kartkiRef = useRef<HTMLDivElement>(null);

  // --- Budowa stron (ta sama scena co w PDF), z pamięcią kart i kartek między renderami.
  // Nowa pamięć kart przy każdej zmianie zasobów (czcionki, obrazy, szablony).
  const pamiecKart = useMemo(
    () => (zasoby ? new WeakMap<Karta, { scena: Scena; ostrzezenia: Ostrzezenie[] }>() : undefined),
    [zasoby],
  );
  // Pamięć zbudowanych kartek (klucz – obiekt arkusza); zmiana tylko jednej kartki nie buduje reszty.
  const [pamiecKartek] = useState(
    () => new WeakMap<Arkusz, { talia: Talia; zasoby: unknown; k: Kartka }>(),
  );
  const arkusze = useDeferredValue(projekt.arkusze);
  const talie = useDeferredValue(projekt.talie);
  const kartki = useMemo((): Kartka[] => {
    if (!zasoby || !pamiecKart) return [];
    return arkusze.map((arkusz) => {
      const talia = talie.find((x) => x.id === arkusz.taliaId)!;
      const z = pamiecKartek.get(arkusz);
      if (z && z.talia === talia && z.zasoby === zasoby) return z.k;
      let k: Kartka;
      try {
        const wynik = zbudujArkusz(arkusz, talia, {
          czcionki: zasoby.czcionki,
          szablony: zasoby.szablony,
          obraz: (id) => zasoby.obrazy.get(id)?.info,
          pamiecKart,
        });
        k = {
          arkusz,
          talia,
          wynik,
          ...(geometria(wynik) ? { geometria: geometria(wynik)! } : {}),
          svg: wynik.strony.map((s, i) =>
            scenaDoSvg(arkusz.ustawienia.czarnoBialy ? zSzarymiObrazami(s) : s, {
              adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
              przedrostekId: `${arkusz.id}-s${i}-`,
              atrybuty: { 'aria-hidden': 'true', class: 'svg-strony' },
            }),
          ),
        };
      } catch (e) {
        k = { arkusz, talia, svg: [], blad: e instanceof Error ? e.message : String(e) };
      }
      pamiecKartek.set(arkusz, { talia, zasoby, k });
      return k;
    });
  }, [arkusze, talie, zasoby, pamiecKart, pamiecKartek]);

  const kontekst = useCallback(
    (arkuszId: string): KontekstKartki | undefined => {
      const k = kartki.find((x) => x.arkusz.id === arkuszId);
      return k?.wynik && zasoby ? { szablony: zasoby.szablony, siatka: k.wynik.siatka } : undefined;
    },
    [kartki, zasoby],
  );

  // Karty na żywo (z bieżącego projektu – przeciąganie i zaznaczenie bez opóźnienia).
  const kartyNaKartkach = useMemo(() => {
    const m = new Map<string, KartaNaKartce[]>();
    if (zasoby)
      for (const a of projekt.arkusze) m.set(a.id, kartyKartki(projekt, a.id, zasoby.szablony));
    return m;
  }, [projekt, zasoby]);

  const zaznaczoneKarty = useMemo(() => {
    if (zazn?.rodzaj !== 'karty') return [];
    const ids = new Set(zazn.ids);
    return (kartyNaKartkach.get(zazn.arkuszId) ?? []).filter((k) => ids.has(k.karta.id));
  }, [zazn, kartyNaKartkach]);

  // Zaznaczenie wskazujące usunięte elementy (np. po „Cofnij”) – czyścimy.
  const zaznaczenieAktualne =
    zazn?.rodzaj === 'karty'
      ? zaznaczoneKarty.length > 0
      : zazn?.rodzaj === 'naglowek'
        ? !!projekt.arkusze
            .find((a) => a.id === zazn.arkuszId)
            ?.naglowki?.some((h) => h.id === zazn.id)
        : true;
  const aktywne = zaznaczenieAktualne ? zazn : undefined;

  /**
   * Zmiana wpływająca na siatkę (tytuł, papier, nagłówki, czcionki): odrzucona, gdy karty
   * przestałyby się mieścić albo zaczęły nachodzić na siebie.
   */
  const zmienUklad = useCallback(
    (f: (p: Projekt) => Projekt, klucz?: string) => {
      if (!zasoby) return;
      const nowy = f(projekt);
      for (const a of nowy.arkusze) {
        if (
          projekt.arkusze.includes(a) &&
          nowy.talie === projekt.talie &&
          nowy.role === projekt.role
        )
          continue;
        const talia = nowy.talie.find((x) => x.id === a.taliaId)!;
        const w = zbudujArkusz(a, talia, {
          czcionki: zasoby.czcionki,
          szablony: zasoby.szablony,
          obraz: (id) => zasoby.obrazy.get(id)?.info,
          pamiecKart,
        });
        if (w.ostrzezenia.some((o) => /^przypiecie-(poza-siatka|koliduje)/.test(o.komunikat))) {
          ustawBladUkladu(t('kartka.zmianaNieMiesci'));
          return;
        }
      }
      ustawBladUkladu(undefined);
      zmien(f, klucz ? { klucz: `uklad:${klucz}` } : {});
    },
    [projekt, zasoby, zmien, pamiecKart],
  );

  // --- Akcje na zaznaczeniu.
  const usunZaznaczone = useCallback(() => {
    if (aktywne?.rodzaj === 'naglowek') {
      zmienUklad((p) => usunNaglowek(p, aktywne.arkuszId, aktywne.id));
      ustawZazn(undefined);
      ustawToast({ tekst: t('kartka.usunietoNaglowek'), cofnij: true });
      return;
    }
    if (aktywne?.rodzaj !== 'karty' || zaznaczoneKarty.length === 0) return;
    const n = zaznaczoneKarty.length;
    const nazwa = zaznaczoneKarty[0]!.karta.dane.nazwa;
    zmien((p) => usunKarty(p, aktywne.arkuszId, aktywne.ids));
    ustawZazn(undefined);
    ustawToast({
      tekst:
        n === 1
          ? t('kartka.usunietoKarte', { nazwa: nazwa || t('karta.bezNazwy') })
          : t('kartka.usunietoKarty', { liczba: n }),
      cofnij: true,
    });
  }, [aktywne, zaznaczoneKarty, zmien, zmienUklad]);

  const duplikuj = useCallback(
    (n: number) => {
      if (aktywne?.rodzaj !== 'karty') return;
      const ctx = kontekst(aktywne.arkuszId);
      if (!ctx) return;
      const ids = zaznaczoneKarty.map((k) => k.karta.id);
      const { kopie } = duplikujKarty(projekt, aktywne.arkuszId, ids, n, ctx);
      zmien((p) => duplikujKarty(p, aktywne.arkuszId, ids, n, ctx).projekt);
      if (kopie.length) ustawZazn({ rodzaj: 'karty', arkuszId: aktywne.arkuszId, ids: kopie });
      ustawToast({ tekst: t('kartka.zduplikowano', { liczba: kopie.length }), cofnij: true });
    },
    [aktywne, kontekst, projekt, zaznaczoneKarty, zmien],
  );

  const przesunZaznaczone = useCallback(
    (o: Polozenie) => {
      if (aktywne?.rodzaj !== 'karty') return;
      const ctx = kontekst(aktywne.arkuszId);
      if (!ctx) return;
      const w = przesunKarty(projekt, aktywne.arkuszId, aktywne.ids, o, ctx);
      if ('blad' in w) return;
      zmien((p) => {
        const x = przesunKarty(p, aktywne.arkuszId, aktywne.ids, o, ctx);
        return 'projekt' in x ? x.projekt : p;
      });
    },
    [aktywne, kontekst, projekt, zmien],
  );

  // --- Skróty klawiszowe.
  useEffect(() => {
    const klawisz = (e: KeyboardEvent) => {
      if (wPolu(document.activeElement)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) edycja.ponow();
        else edycja.cofnij();
      } else if (ctrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        edycja.ponow();
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplikuj(1);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (aktywne?.rodzaj === 'karty' || aktywne?.rodzaj === 'naglowek') {
          e.preventDefault();
          usunZaznaczone();
        }
      } else if (e.key === 'Escape') {
        ustawMenu(undefined);
        ustawZazn(undefined);
      } else if (aktywne?.rodzaj === 'karty' && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const o = { strona: 0, kolumna: 0, rzad: 0 };
        if (e.key === 'ArrowLeft') o.kolumna = -1;
        if (e.key === 'ArrowRight') o.kolumna = 1;
        if (e.key === 'ArrowUp') o.rzad = -1;
        if (e.key === 'ArrowDown') o.rzad = 1;
        przesunZaznaczone(o);
      }
    };
    window.addEventListener('keydown', klawisz);
    return () => window.removeEventListener('keydown', klawisz);
  }, [aktywne, duplikuj, edycja, przesunZaznaczone, usunZaznaczone]);

  // Miniatura pierwszej strony na liście projektów (bez obrazów – adresy blob: są chwilowe).
  const pierwszaStrona = kartki[0]?.wynik?.strony[0];
  useEffect(() => {
    if (!pierwszaStrona) return;
    const z = setTimeout(() => {
      void baza()
        .zapiszMiniature(projekt.id, scenaDoSvg(pierwszaStrona, { przedrostekId: 'min-' }))
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(z);
  }, [pierwszaStrona, projekt.id]);

  // Komunikat znika sam po chwili.
  useEffect(() => {
    if (!toast) return;
    const z = setTimeout(() => ustawToast(undefined), 8000);
    return () => clearTimeout(z);
  }, [toast]);

  // --- Gesty myszy (delegacja zdarzeń na warstwach stron).
  const stronaPod = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.strona-kartki');
    if (!el) return undefined;
    return { el, arkuszId: el.dataset.arkusz!, strona: Number(el.dataset.strona) };
  };
  const mmNaStronie = (el: HTMLElement, g: Geometria, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * g.szer, y: ((y - r.top) / r.height) * g.wys };
  };

  const ustawGestOba = (g: Gest | undefined) => {
    gestRef.current = g;
    ustawGest(g);
  };

  const ruchGestu = (e: PointerEvent) => {
    const g = gestRef.current;
    if (!g) return;
    if (g.rodzaj === 'obraz') {
      const dx = (e.clientX - g.x0) * g.mmNaPx;
      const dy = (e.clientY - g.y0) * g.mmNaPx;
      if (Math.abs(dx) + Math.abs(dy) < 0.05) return;
      gestRef.current = { ...g, x0: e.clientX, y0: e.clientY };
      zmien(
        (p) =>
          zmienObrazKarty(p, g.taliaId, g.kartaId, g.poleId, (u) => ({
            ...u,
            przesuniecie: {
              x: zaokr((u.przesuniecie?.x ?? 0) + dx),
              y: zaokr((u.przesuniecie?.y ?? 0) + dy),
            },
          })),
        { klucz: `obraz:${g.kartaId}:przesun` },
      );
      return;
    }
    const ruch = g.ruch || Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > PROG_RUCHU;
    const k = kartki.find((x) => x.arkusz.id === g.arkuszId);
    const s = stronaPod(e.clientX, e.clientY);
    if (g.rodzaj === 'karty') {
      if (!ruch || !k?.geometria) return ustawGestOba({ ...g, ruch });
      if (!s || s.arkuszId !== g.arkuszId) return ustawGestOba({ ...g, ruch, blad: 'poza-siatka' });
      const pt = mmNaStronie(s.el, k.geometria, e.clientX, e.clientY);
      const slot = slotPodPunktem(k.geometria, s.strona, pt.x, pt.y, true)!;
      const o = {
        strona: s.strona - g.stronaStart,
        kolumna: slot.kolumna - g.slotStart.kolumna,
        rzad: slot.rzad - g.slotStart.rzad,
      };
      const ctx = kontekst(g.arkuszId);
      const w = ctx && przesunKarty(projekt, g.arkuszId, g.ids, o, ctx);
      const blad = !w ? 'poza-siatka' : 'blad' in w ? w.blad : undefined;
      ustawGestOba({ ...g, ruch, o, ...(blad ? { blad } : { blad: undefined }) });
    } else {
      if (!k?.geometria) return;
      let koniec = g.koniec;
      if (s && s.arkuszId === g.arkuszId && s.strona === g.strona) {
        const pt = mmNaStronie(s.el, k.geometria, e.clientX, e.clientY);
        koniec = slotPodPunktem(k.geometria, g.strona, pt.x, pt.y, true);
      }
      ustawGestOba({ ...g, ruch, ...(koniec ? { koniec } : {}) });
    }
  };

  const koniecGestu = () => {
    window.removeEventListener('pointermove', ruchGestu);
    window.removeEventListener('pointerup', koniecGestu);
    window.removeEventListener('pointercancel', koniecGestu);
    const g = gestRef.current;
    ustawGestOba(undefined);
    if (!g || g.rodzaj === 'obraz') return;
    if (g.rodzaj === 'karty') {
      if (g.ruch && g.o && !g.blad && (g.o.strona || g.o.kolumna || g.o.rzad)) {
        const ctx = kontekst(g.arkuszId);
        if (ctx) {
          zmien((p) => {
            const x = przesunKarty(p, g.arkuszId, g.ids, g.o!, ctx);
            return 'projekt' in x ? x.projekt : p;
          });
        }
      } else if (!g.ruch && g.ids.length > 1) {
        ustawZazn({ rodzaj: 'karty', arkuszId: g.arkuszId, ids: [g.klik] });
      }
      return;
    }
    if (!g.ruch) {
      // Klik w pusty slot – menu typu karty; obok siatki – odznaczenie.
      ustawZazn(undefined);
      if (g.slot) ustawMenu({ arkuszId: g.arkuszId, strona: g.strona, ...g.slot });
      return;
    }
    if (g.start && g.koniec) {
      const ids = kartyWObszarze(
        kartyNaKartkach.get(g.arkuszId) ?? [],
        g.strona,
        g.start,
        g.koniec,
      );
      const poprzednie =
        g.shift && aktywne?.rodzaj === 'karty' && aktywne.arkuszId === g.arkuszId
          ? aktywne.ids
          : [];
      const wszystkie = [...new Set([...poprzednie, ...ids])];
      ustawZazn(
        wszystkie.length ? { rodzaj: 'karty', arkuszId: g.arkuszId, ids: wszystkie } : undefined,
      );
    }
  };

  const poczatekGestu = (e: React.PointerEvent, k: Kartka, strona: number) => {
    if (e.button !== 0 || !k.geometria || !zasoby) return;
    const cel = e.target as HTMLElement;
    if (cel.closest('.pasek-karty, .menu-typu, .usun-strone')) return;
    ustawMenu(undefined);
    const stronaEl = e.currentTarget.closest<HTMLElement>('.strona-kartki')!;
    const pt = mmNaStronie(stronaEl, k.geometria, e.clientX, e.clientY);
    const kartaEl = cel.closest<HTMLElement>('[data-karta]');
    const naglowekEl = cel.closest<HTMLElement>('[data-naglowek]');
    if (naglowekEl) {
      ustawZazn({ rodzaj: 'naglowek', arkuszId: k.arkusz.id, id: naglowekEl.dataset.naglowek! });
      return;
    }
    if (kartaEl) {
      e.preventDefault();
      const id = kartaEl.dataset.karta!;
      const obecne =
        aktywne?.rodzaj === 'karty' && aktywne.arkuszId === k.arkusz.id ? aktywne.ids : [];
      if (e.shiftKey) {
        const ids = obecne.includes(id) ? obecne.filter((x) => x !== id) : [...obecne, id];
        ustawZazn(ids.length ? { rodzaj: 'karty', arkuszId: k.arkusz.id, ids } : undefined);
        return;
      }
      const ids = obecne.includes(id) ? obecne : [id];
      ustawZazn({ rodzaj: 'karty', arkuszId: k.arkusz.id, ids });
      const karta = (kartyNaKartkach.get(k.arkusz.id) ?? []).find((x) => x.karta.id === id)?.karta;
      const pole = karta && poleObrazu(karta, zasoby);
      if (e.altKey && karta && pole && ids.length === 1) {
        ustawGestOba({
          rodzaj: 'obraz',
          arkuszId: k.arkusz.id,
          taliaId: k.talia.id,
          kartaId: id,
          poleId: pole.id,
          x0: e.clientX,
          y0: e.clientY,
          mmNaPx: k.geometria.szer / stronaEl.getBoundingClientRect().width,
        });
      } else {
        ustawGestOba({
          rodzaj: 'karty',
          arkuszId: k.arkusz.id,
          stronaStart: strona,
          slotStart: slotPodPunktem(k.geometria, strona, pt.x, pt.y, true)!,
          ids,
          klik: id,
          x0: e.clientX,
          y0: e.clientY,
          ruch: false,
        });
      }
    } else {
      const slotEl = cel.closest<HTMLElement>('[data-slot]');
      const slot = slotEl ? slotEl.dataset.slot!.split(',').map(Number) : undefined;
      const start = slotPodPunktem(k.geometria, strona, pt.x, pt.y, true);
      ustawGestOba({
        rodzaj: 'obszar',
        arkuszId: k.arkusz.id,
        strona,
        ...(start ? { start, koniec: start } : {}),
        ...(slot ? { slot: { kolumna: slot[0]!, rzad: slot[1]! } } : {}),
        shift: e.shiftKey,
        x0: e.clientX,
        y0: e.clientY,
        ruch: false,
      });
    }
    window.addEventListener('pointermove', ruchGestu);
    window.addEventListener('pointerup', koniecGestu);
    window.addEventListener('pointercancel', koniecGestu);
  };

  // Kółko myszy nad zaznaczoną kartą z ilustracją – skala ilustracji.
  const kolkoRef = useRef<(e: WheelEvent) => void>(() => undefined);
  useEffect(() => {
    kolkoRef.current = (e: WheelEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-karta]');
      if (
        !el ||
        aktywne?.rodzaj !== 'karty' ||
        aktywne.ids.length !== 1 ||
        aktywne.ids[0] !== el.dataset.karta ||
        !zasoby
      )
        return;
      const k = zaznaczoneKarty[0];
      const pole = k && poleObrazu(k.karta, zasoby);
      const talia = projekt.arkusze.find((a) => a.id === aktywne.arkuszId)?.taliaId;
      if (!k || !pole || !talia) return;
      e.preventDefault();
      zmien(
        (p) =>
          zmienObrazKarty(p, talia, k.karta.id, pole.id, (u) => ({
            ...u,
            skala: skalaZKolka(u.skala ?? 1, e.deltaY),
          })),
        {
          klucz: `obraz:${k.karta.id}:skala`,
        },
      );
    };
  });
  useEffect(() => {
    const el = kartkiRef.current;
    if (!el) return;
    const f = (e: WheelEvent) => kolkoRef.current(e);
    el.addEventListener('wheel', f, { passive: false });
    return () => el.removeEventListener('wheel', f);
  }, []);

  // --- Dodawanie karty z menu.
  const dodajZMenu = (typ: TypKarty, wariant: number) => {
    if (!menu) return;
    const ctx = kontekst(menu.arkuszId);
    if (!ctx) return;
    const w = typ.warianty[wariant]!;
    const opis = {
      szablonId: w.szablonId,
      rozmiary: typ.rozmiary,
      ...(w.dane ? { dane: w.dane } : {}),
    };
    const proba = dodajKarteWSlocie(projekt, menu.arkuszId, menu, opis, ctx);
    if ('blad' in proba) return;
    zmien((p) => {
      const x = dodajKarteWSlocie(p, menu.arkuszId, menu, opis, ctx);
      return 'projekt' in x ? x.projekt : p;
    });
    ustawZazn({ rodzaj: 'karty', arkuszId: menu.arkuszId, ids: [proba.kartaId] });
    ustawMenu(undefined);
  };

  const pobierzPdf = async () => {
    if (!zasoby) return;
    ustawStatusPdf(t('arkusze.generowanie'));
    try {
      const bajty = await pdfWWatku({
        tytul: projekt.nazwa,
        arkusze: projekt.arkusze,
        talie: projekt.talie,
        szablony: [...zasoby.szablony.values()],
        czcionki: zasoby.plikiCzcionek,
        role: zasoby.role,
        ...(zasoby.zapasowa !== undefined ? { zapasowa: zasoby.zapasowa } : {}),
        obrazy: [...zasoby.obrazy].map(([id, o]) => ({
          id,
          info: o.info,
          dane: o.dane,
          format: o.format,
        })),
      });
      zapiszPlik(bajty, 'application/pdf', nazwaPliku(projekt.nazwa, '.pdf'));
      ustawStatusPdf(t('arkusze.pdfGotowy'));
    } catch (e) {
      ustawStatusPdf(
        t('kartka.bladPdf', { szczegoly: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  // --- Panel boczny.
  const arkuszZazn = aktywne && projekt.arkusze.find((a) => a.id === aktywne.arkuszId);
  let panel: React.ReactNode;
  if (aktywne?.rodzaj === 'karty' && arkuszZazn && kontekst(arkuszZazn.id)) {
    const ctx = kontekst(arkuszZazn.id)!;
    const naStronie = zaznaczoneKarty.filter((k) => k.strona === zaznaczoneKarty[0]?.strona);
    const od = Math.min(...naStronie.map((k) => k.kolumna));
    const do_ = Math.max(...naStronie.map((k) => k.kolumna + k.kolumny));
    const mozeNaglowek = !!arkuszZazn.ustawienia.grupy && naStronie.length > 0;
    panel = (
      <PanelKart
        edycja={edycja}
        arkusz={arkuszZazn}
        karty={zaznaczoneKarty}
        pakiet={pakiet}
        ctx={ctx}
        duplikuj={duplikuj}
        usun={usunZaznaczone}
        zamknij={() => ustawZazn(undefined)}
        ostrzezenia={(kartki.find((x) => x.arkusz.id === arkuszZazn.id)?.wynik?.ostrzezenia ?? [])
          .filter((o) => o.kartaId && aktywne.ids.includes(o.kartaId))
          .map((o) => tekstOstrzezeniaArkusza(o))}
        {...(mozeNaglowek
          ? {
              dodajNaglowek: () => {
                const strona = naStronie[0]!.strona;
                const w = dodajNaglowek(
                  projekt,
                  arkuszZazn.id,
                  { strona, kolumna: od, kolumny: do_ - od, naglowek: t('kartka.nowaGrupa') },
                  ctx,
                );
                if ('blad' in w) {
                  ustawToast({ tekst: t('kartka.naglowekKoliduje') });
                  return;
                }
                zmienUklad(() => w.projekt);
                ustawZazn({ rodzaj: 'naglowek', arkuszId: arkuszZazn.id, id: w.id });
              },
            }
          : {})}
      />
    );
  } else if (aktywne?.rodzaj === 'naglowek' && arkuszZazn) {
    const h = arkuszZazn.naglowki?.find((x) => x.id === aktywne.id);
    const ctx = kontekst(arkuszZazn.id);
    if (h && ctx)
      panel = (
        <PanelNaglowka
          arkusz={arkuszZazn}
          naglowek={h}
          maksKolumn={ctx.siatka.kolumny}
          {...(bladUkladu ? { blad: bladUkladu } : {})}
          zmien={(z, klucz) => {
            const w = zmienNaglowek(projekt, arkuszZazn.id, h.id, z, ctx);
            if ('blad' in w) return ustawBladUkladu(t('kartka.naglowekKoliduje'));
            zmienUklad(() => w.projekt, klucz ? `naglowek:${h.id}:${klucz}` : undefined);
          }}
          usun={usunZaznaczone}
          zamknij={() => ustawZazn(undefined)}
        />
      );
  } else if (aktywne?.rodzaj === 'ustawienia' && arkuszZazn) {
    panel = (
      <PanelUstawien
        edycja={edycja}
        arkusz={arkuszZazn}
        zmienUklad={zmienUklad}
        {...(bladUkladu ? { blad: bladUkladu } : {})}
        {...(pakiet
          ? {
              nowaKartka: () => {
                const nazwa = t('kartka.nazwaKartki', { numer: projekt.arkusze.length + 1 });
                const w = dodajKartke(projekt, pakiet.nowaKartka, nazwa);
                zmien(() => w.projekt);
                ustawZazn({ rodzaj: 'ustawienia', arkuszId: w.arkuszId });
              },
            }
          : {})}
        zamknij={() => ustawZazn(undefined)}
      />
    );
  }
  panel ??= (
    <aside className="panel-edytora" aria-label={t('kartka.pomoc')}>
      <h2>{t('kartka.nicNieZaznaczono')}</h2>
      <p className="podpis">{t('kartka.pomocDodawanie')}</p>
      <p className="podpis">{t('kartka.pomocZaznaczanie')}</p>
      <p className="podpis">{t('kartka.pomocSkroty')}</p>
      <p className="podpis">{t('kartka.pomocDruk')}</p>
    </aside>
  );

  // --- Widok.
  const naglowekProjektu = (
    <header className="pasek-gorny">
      <a href="#/" className="logo">
        {t('aplikacja.nazwa')}
      </a>
      <input
        className="nazwa-projektu"
        aria-label={t('kartka.nazwaProjektu')}
        value={projekt.nazwa}
        onChange={(e) =>
          zmien((p) => ({ ...p, nazwa: e.target.value, zmieniono: new Date().toISOString() }), {
            klucz: 'nazwa',
          })
        }
      />
      <span
        role="status"
        aria-live="polite"
        className={`status-zapisu ${edycja.zapis.stan === 'blad' ? 'blad' : ''}`}
      >
        {tekstZapisu(edycja.zapis)}
      </span>
      <span className="odstep" />
      <button
        type="button"
        className="ikonowy"
        aria-label={t('kartka.cofnij')}
        title={t('kartka.cofnij')}
        disabled={!edycja.mozeCofnac}
        onClick={edycja.cofnij}
      >
        ↶
      </button>
      <button
        type="button"
        className="ikonowy"
        aria-label={t('kartka.ponow')}
        title={t('kartka.ponow')}
        disabled={!edycja.mozePonowic}
        onClick={edycja.ponow}
      >
        ↷
      </button>
      <button
        type="button"
        aria-pressed={aktywne?.rodzaj === 'ustawienia'}
        onClick={() =>
          ustawZazn(
            aktywne?.rodzaj === 'ustawienia'
              ? undefined
              : { rodzaj: 'ustawienia', arkuszId: aktywne?.arkuszId ?? projekt.arkusze[0]!.id },
          )
        }
      >
        ⚙ {t('kartka.ustawienia')}
      </button>
      <button
        type="button"
        onClick={() =>
          zapiszPlik(
            eksportujProjekt(projekt, edycja.dane),
            'application/zip',
            nazwaPliku(projekt.nazwa, ROZSZERZENIE_PROJEKTU),
          )
        }
      >
        ⤓ {t('projekty.eksportuj')}
      </button>
      <button type="button" className="glowny" disabled={!zasoby} onClick={() => void pobierzPdf()}>
        ⎙ {t('arkusze.pobierzPdf')}
      </button>
      <span role="status" aria-live="polite" className="status-pdf">
        {statusPdf}
      </span>
    </header>
  );

  return (
    <div className="edytor-kartki">
      {naglowekProjektu}
      {edycja.ostrzezenia.length > 0 && (
        <details className="uwaga ostrzezenia-projektu">
          <summary>{t('projekt.ostrzezenia', { liczba: edycja.ostrzezenia.length })}</summary>
          <ul>
            {edycja.ostrzezenia.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="uklad-edytora">
        <div className="kartki" ref={kartkiRef}>
          {!zasoby && <p>{t('arkusze.wczytywanie')}</p>}
          {kartki.map((k) => (
            <WidokKartki
              key={k.arkusz.id}
              k={k}
              wiele={kartki.length > 1}
              karty={kartyNaKartkach.get(k.arkusz.id) ?? []}
              liczbaStron={liczbaStronKartki(projekt, k.arkusz.id)}
              zazn={aktywne}
              gest={gest}
              menu={menu?.arkuszId === k.arkusz.id ? menu : undefined}
              typy={pakiet?.typyKart ?? []}
              miesciSie={(typ) => {
                const ctx = kontekst(k.arkusz.id);
                return (
                  !!menu &&
                  !!ctx &&
                  !(
                    'blad' in
                    dodajKarteWSlocie(
                      projekt,
                      k.arkusz.id,
                      menu,
                      { szablonId: typ.warianty[0]!.szablonId, rozmiary: typ.rozmiary },
                      ctx,
                    )
                  )
                );
              }}
              dodaj={dodajZMenu}
              zamknijMenu={() => ustawMenu(undefined)}
              poczatekGestu={poczatekGestu}
              duplikuj={() => duplikuj(1)}
              usun={usunZaznaczone}
              dodajStrone={() => zmien((p) => dodajStrone(p, k.arkusz.id))}
              otworzMenu={(p) => {
                ustawZazn(undefined);
                ustawMenu({ arkuszId: k.arkusz.id, ...p });
              }}
              wybierzKarte={(id, shift) => {
                const obecne =
                  aktywne?.rodzaj === 'karty' && aktywne.arkuszId === k.arkusz.id
                    ? aktywne.ids
                    : [];
                const ids = shift
                  ? obecne.includes(id)
                    ? obecne.filter((x) => x !== id)
                    : [...obecne, id]
                  : [id];
                ustawZazn(ids.length ? { rodzaj: 'karty', arkuszId: k.arkusz.id, ids } : undefined);
              }}
              usunStrone={(s) =>
                zmien((p) => {
                  const w = usunStrone(p, k.arkusz.id, s);
                  return 'projekt' in w ? w.projekt : p;
                })
              }
            />
          ))}
        </div>
        <div className="kolumna-panelu">{panel}</div>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.tekst}</span>
          {toast.cofnij && (
            <button
              type="button"
              onClick={() => {
                edycja.cofnij();
                ustawToast(undefined);
              }}
            >
              {t('kartka.cofnij')}
            </button>
          )}
          <button
            type="button"
            aria-label={t('kartka.zamknijKomunikat')}
            onClick={() => ustawToast(undefined)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/** Jedna kartka: jej strony (SVG z silnika) z warstwą slotów, kart, nagłówków i podglądów. */
function WidokKartki({
  k,
  wiele,
  karty,
  liczbaStron,
  zazn,
  gest,
  menu,
  typy,
  miesciSie,
  dodaj,
  zamknijMenu,
  poczatekGestu,
  duplikuj,
  usun,
  dodajStrone,
  usunStrone,
  otworzMenu,
  wybierzKarte,
}: {
  otworzMenu: (p: Polozenie) => void;
  wybierzKarte: (id: string, shift: boolean) => void;
  k: Kartka;
  wiele: boolean;
  karty: KartaNaKartce[];
  liczbaStron: number;
  zazn: Zaznaczenie;
  gest: Gest | undefined;
  menu: Polozenie | undefined;
  typy: TypKarty[];
  miesciSie: (typ: TypKarty) => boolean;
  dodaj: (typ: TypKarty, wariant: number) => void;
  zamknijMenu: () => void;
  poczatekGestu: (e: React.PointerEvent, k: Kartka, strona: number) => void;
  duplikuj: () => void;
  usun: () => void;
  dodajStrone: () => void;
  usunStrone: (s: number) => void;
}) {
  const g = k.geometria;
  const id = k.arkusz.id;
  const zaznaczone =
    zazn?.rodzaj === 'karty' && zazn.arkuszId === id ? new Set(zazn.ids) : new Set<string>();
  const gestTu = gest && gest.arkuszId === id ? gest : undefined;
  const pierwsza = karty
    .filter((x) => zaznaczone.has(x.karta.id))
    .sort((a, b) => a.strona - b.strona || a.rzad - b.rzad || a.kolumna - b.kolumna)[0];

  if (k.blad) {
    return (
      <p role="alert" className="uwaga">
        {t('kartka.bladUkladu', { szczegoly: k.blad })}
      </p>
    );
  }
  return (
    <section className="kartka" aria-label={k.arkusz.nazwa}>
      {wiele && <h2 className="tytul-kartki">{k.arkusz.nazwa}</h2>}
      {Array.from({ length: Math.max(liczbaStron, k.svg.length) }, (_, s) => {
        const naStronie = karty.filter((x) => x.strona === s);
        const zajete = new Set<string>();
        for (const c of naStronie)
          for (let i = 0; i < c.kolumny; i++)
            for (let j = 0; j < c.rzedy; j++) zajete.add(`${c.kolumna + i},${c.rzad + j}`);
        const pusta = naStronie.length === 0;
        return (
          <div key={s} className="strona-opakowanie">
            <div className="etykieta-strony">
              {t('kartka.strona', { numer: s + 1, liczba: liczbaStron })}
              {pusta && liczbaStron > 1 && (
                <button type="button" className="usun-strone" onClick={() => usunStrone(s)}>
                  {t('kartka.usunStrone')}
                </button>
              )}
            </div>
            <div
              className="strona-kartki"
              data-arkusz={id}
              data-strona={s}
              style={g ? { aspectRatio: `${g.szer} / ${g.wys}` } : undefined}
            >
              <div
                className="svg-opakowanie"
                dangerouslySetInnerHTML={{ __html: k.svg[s] ?? '' }}
              />
              {g && (
                <div className="warstwa" onPointerDown={(e) => poczatekGestu(e, k, s)}>
                  {Array.from({ length: g.siatka.rzedy }, (_, r) =>
                    Array.from({ length: g.siatka.kolumny }, (_, c) =>
                      zajete.has(`${c},${r}`) ? null : (
                        <button
                          key={`${c},${r}`}
                          type="button"
                          className={`slot${menu && menu.strona === s && menu.kolumna === c && menu.rzad === r ? ' aktywny' : ''}`}
                          data-slot={`${c},${r}`}
                          style={stylProstokata(g, s, c, r)}
                          aria-label={t('kartka.pustySlot', {
                            strona: s + 1,
                            kolumna: c + 1,
                            rzad: r + 1,
                          })}
                          onClick={(e) =>
                            e.detail === 0 && otworzMenu({ strona: s, kolumna: c, rzad: r })
                          }
                        />
                      ),
                    ),
                  )}
                  {(k.wynik?.naglowki ?? [])
                    .filter((h) => h.strona === s)
                    .map((h) => {
                      const n = k.arkusz.naglowki?.find((x) => x.id === h.id);
                      return (
                        <button
                          key={h.id}
                          type="button"
                          className={`naglowek-grupy${zazn?.rodzaj === 'naglowek' && zazn.id === h.id ? ' zaznaczony' : ''}`}
                          data-naglowek={h.id}
                          style={stylMm(g, h.x, h.y, h.szer, h.wys)}
                          aria-label={t('kartka.naglowekEtykieta', { tekst: n?.naglowek ?? '' })}
                        />
                      );
                    })}
                  {naStronie.map((c) => {
                    const podnoszona =
                      gestTu?.rodzaj === 'karty' && gestTu.ruch && gestTu.ids.includes(c.karta.id);
                    return (
                      <button
                        key={c.karta.id}
                        type="button"
                        className={`karta-na-kartce${zaznaczone.has(c.karta.id) ? ' zaznaczona' : ''}${podnoszona ? ' podnoszona' : ''}`}
                        data-karta={c.karta.id}
                        style={stylProstokata(g, s, c.kolumna, c.rzad, c.kolumny, c.rzedy)}
                        aria-pressed={zaznaczone.has(c.karta.id)}
                        onClick={(e) => e.detail === 0 && wybierzKarte(c.karta.id, e.shiftKey)}
                        aria-label={t('kartka.kartaEtykieta', {
                          nazwa: c.karta.dane.nazwa || t('karta.bezNazwy'),
                          strona: s + 1,
                          kolumna: c.kolumna + 1,
                          rzad: c.rzad + 1,
                        })}
                      />
                    );
                  })}
                  {gestTu?.rodzaj === 'karty' &&
                    gestTu.ruch &&
                    gestTu.o &&
                    karty
                      .filter(
                        (c) => gestTu.ids.includes(c.karta.id) && c.strona + gestTu.o!.strona === s,
                      )
                      .map((c) => (
                        <div
                          key={`p-${c.karta.id}`}
                          className={`podglad-celu${gestTu.blad ? ' zly' : ''}`}
                          style={stylProstokata(
                            g,
                            s,
                            c.kolumna + gestTu.o!.kolumna,
                            c.rzad + gestTu.o!.rzad,
                            c.kolumny,
                            c.rzedy,
                          )}
                        />
                      ))}
                  {gestTu?.rodzaj === 'obszar' &&
                    gestTu.ruch &&
                    gestTu.strona === s &&
                    gestTu.start &&
                    gestTu.koniec && (
                      <div
                        className="obszar-zaznaczenia"
                        style={stylProstokata(
                          g,
                          s,
                          Math.min(gestTu.start.kolumna, gestTu.koniec.kolumna),
                          Math.min(gestTu.start.rzad, gestTu.koniec.rzad),
                          Math.abs(gestTu.start.kolumna - gestTu.koniec.kolumna) + 1,
                          Math.abs(gestTu.start.rzad - gestTu.koniec.rzad) + 1,
                        )}
                      />
                    )}
                  {pierwsza && pierwsza.strona === s && !gestTu && (
                    <div
                      className="pasek-karty"
                      style={{
                        ...stylProstokata(g, s, pierwsza.kolumna, pierwsza.rzad),
                        width: 'auto',
                        height: 'auto',
                      }}
                    >
                      <button type="button" onClick={duplikuj}>
                        {t('kartka.duplikuj')}
                      </button>
                      <button type="button" className="niebezpieczny" onClick={usun}>
                        {t('kartka.usun')}
                      </button>
                    </div>
                  )}
                  {menu && menu.strona === s && (
                    <MenuTypu
                      typy={typy}
                      styl={(() => {
                        const p = stylProstokata(g, s, menu.kolumna + 1, menu.rzad);
                        return menu.kolumna > g.siatka.kolumny - 4
                          ? {
                              right: `${100 - parseFloat(stylProstokata(g, s, menu.kolumna, menu.rzad).left)}%`,
                              top: p.top,
                            }
                          : { left: p.left, top: p.top };
                      })()}
                      miesciSie={miesciSie}
                      wybierz={dodaj}
                      zamknij={zamknijMenu}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <button type="button" className="dodaj-strone" onClick={dodajStrone}>
        ＋ {t('kartka.dodajStrone')}
      </button>
    </section>
  );
}
