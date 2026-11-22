import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { dodajSzablon, eksportujProjekt, ROZSZERZENIE_PROJEKTU } from '../../dane/archiwum';
import { czyProjektRewersowy } from '../../dane/baza';
import {
  czyProjektWlasny,
  kartkaDlaSzablonu,
  opisRozmiaruSzablonu,
  PAKIET_WLASNY,
  pakietWlasny,
  pasujeDoSlotu,
  ustawieniaKartkiDla,
} from '../../dane/wlasneKarty';
import { czyDwustronnyWlaczony, przypiszRewers, rewersKarty } from '../../dane/rewers';
import {
  czyMieszane,
  dodajKarteMieszane,
  dodajKarteWSlocie,
  dodajKartyZImportu,
  dodajKartke,
  dodajNaglowek,
  dodajStrone,
  duplikujKarty,
  duplikujKartyMieszane,
  kartyKartki,
  kartyWObszarze,
  liczbaStronKartki,
  mozliweRozmiary,
  naMieszane,
  przeniesWKolejnosci,
  przesunWKolejnosci,
  przesunKarty,
  usunKarty,
  usunNaglowek,
  usunStrone,
  ustawKolejnosc,
  zmienNaglowek,
  zmienRozmiarKarty,
  type BladKartki,
  type KartaNaKartce,
  type KontekstKartki,
  type Polozenie,
} from '../../dane/kartka';
import { nazwaKarty } from '../../dane/szablon';
import {
  kolejnoscWidoczna,
  zbudujArkusz,
  zSzarymiObrazami,
  type WynikArkusza,
} from '../../druk/arkusz';
import { odbijProstokat, osOdwracania, zbudujStronyRewersow } from '../../druk/dwustronny';
import { kartyOdlozone, pakietProjektu, wrocDoSiatki } from '../../druk/normalizacja';
import { t, tJesliJest, tn } from '../../i18n';
import type { WyrenderowanaKarta } from '../../silnik/karta';
import { useJezyk } from '../../i18n/react';
import { NarzedziaPaska } from '../NaglowekAplikacji';
import { OknoModalne } from '../OknoModalne';
import type { Arkusz } from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import {
  czyKontener,
  korzenKarty,
  wymiaryKarty,
  type Karta,
  type PoleObraz,
  type PrzypisanieRewersu,
  type Rewers,
  type Szablon,
  type Talia,
  type Wezel,
} from '../../model/szablon';
import { gry } from '../../pakiety/gry';
import type { Pakiet, TypKarty } from '../../pakiety/typy';
import type { Ostrzezenie } from '../../silnik/karta';
import type { Scena } from '../../silnik/scena';
import { scenaDoSvg } from '../../silnik/svg';
import {
  etykietaAwersuZProjektu,
  kluczAwersuZProjektu,
  normalizujNazweSzablonu,
  useAwersyZProjektow,
  wczytajPaczkeAwersuBezRewersu,
} from '../awersyZProjektow';
import { baza } from '../baza';
import { komunikatyBrakujacychWariantow, tekstOstrzezeniaArkusza } from '../ostrzezenia';
import { pdfWWatku } from '../pdfWWatku';
import {
  odczytajKalibracje,
  odczytajKalibracjeRewersu,
  odczytajWarstweTekstowaPdf,
  zapiszKalibracje,
  zapiszKalibracjeRewersu,
  zapiszWarstweTekstowaPdf,
  type Kalibracja,
} from '../kalibracja';
import { obrazyScen, scenyKart, scenyStron, spakuj, type FormatObrazu } from '../eksportObrazow';
import type { ZadaniePdf } from '../../druk/budowaPdf';
import { nazwaPliku, zapiszPlik } from '../pliki';
import {
  dolaczRewersGlobalnyDoProjektu,
  useRewersyGlobalne,
  type ZapisanyRewersGlobalny,
} from '../rewersyGlobalne';
import { useZSzarymiObrazami } from '../szareObrazy';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import type { ZasobyPakietu } from '../zasoby';
import {
  celKolejnosci,
  geometria,
  slotPodPunktem,
  stylMm,
  stylProstokata,
  type CelKolejnosci,
  type Geometria,
} from './geometria';
import { EksportCsvSzablonu } from './EksportCsvSzablonu';
import { ImportDanych } from './ImportDanych';
import { MenuPobierz } from './MenuPobierz';
import { MenuRewersu } from './MenuRewersu';
import { MenuTypu } from './MenuTypu';
import { skalaZKolka, zaokr, zmienObrazKarty } from './obrazKarty';
import { PanelKart, typDlaSzablonu } from './PanelKart';
import { PanelNaglowka } from './PanelNaglowka';
import { PanelRewersuIAwersu } from './PanelRewersuIAwersu';
import { PanelUstawien } from './PanelUstawien';

type Zaznaczenie =
  | { rodzaj: 'karty'; arkuszId: string; ids: string[] }
  | { rodzaj: 'naglowek'; arkuszId: string; id: string }
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
      /** Dotyk: przeciąganie dopiero po przytrzymaniu; wcześniejszy ruch przewija stronę. */
      dotyk?: { t0: number; x: number; y: number; przewijanie: boolean };
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
      dotyk?: boolean;
    }
  | {
      /** Tryb mieszany: przeciągnięcie karty zmienia kolejność (wskaźnik wstawienia). */
      rodzaj: 'kolejnosc';
      arkuszId: string;
      ids: string[];
      klik: string;
      x0: number;
      y0: number;
      ruch: boolean;
      cel?: CelKolejnosci;
      dotyk?: { t0: number; x: number; y: number; przewijanie: boolean };
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
  svgRewersow?: string[];
  pusteRewersy?: boolean[];
  blad?: string;
}

const PROG_RUCHU = 4;
/** Na dotyku karta „podnosi się” po tylu ms przytrzymania (wcześniejszy ruch przewija). */
const PRZYTRZYMANIE_MS = 300;

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

/** Fokus na elemencie po najbliższym odświeżeniu widoku (np. nowa karta, slot po zamknięciu menu). */
const fokusPo = (selektor: string) =>
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selektor)?.focus());

const wPolu = (e: Element | null) =>
  !!e &&
  (e.matches('input, textarea, select, [contenteditable="true"]') || !!e.closest('[role="menu"]'));

/** Edytor kart i widok drukowania: strony A4 z siatką slotów albo podgląd arkusza ze stałymi opcjami druku. */
export function EdytorKartki({
  edycja,
  pokazKartke,
  tryb = 'edycja',
}: {
  edycja: ProjektWEdycji;
  /** Kartka do pokazania po wejściu (np. po „Edytor kart” z edytora szablonu). */
  pokazKartke?: string;
  /** Tryb pracy: „edycja” (tylko edycja kart) albo „drukuj” (podgląd druku i stałe opcje po prawej). */
  tryb?: 'edycja' | 'drukuj';
}) {
  const { projekt, zmien } = edycja;
  const druk = tryb === 'drukuj';
  // Zmiana języka przerysowuje edytor, ale wynik useMemo się nie przelicza sam: KAŻDY nowy
  // useMemo, który woła t() / tn() / tJesliJest() (także pośrednio), musi mieć `jezykUi` w zależnościach.
  const jezykUi = useJezyk();
  const awersyInne = useAwersyZProjektow(projekt.id, projekt.szablony);
  const { rewersyGlobalne } = useRewersyGlobalne(projekt);
  const [celWyjscia, ustawCelWyjscia] = useState<string>();
  const zapiszTeraz = edycja.zapiszTeraz;
  useEffect(() => {
    const naZapis = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void zapiszTeraz().catch(() => undefined);
      }
    };
    window.addEventListener('keydown', naZapis);
    return () => window.removeEventListener('keydown', naZapis);
  }, [zapiszTeraz]);
  // Po wejściu z edytora szablonu – przewiń do kartki dla jego rozmiaru.
  useEffect(() => {
    if (!pokazKartke) return;
    const z = setTimeout(
      () =>
        document
          .querySelector(`.kartka[data-kartka="${CSS.escape(pokazKartke)}"]`)
          ?.scrollIntoView({ block: 'start' }),
      100,
    );
    return () => clearTimeout(z);
  }, [pokazKartke]);
  const idPakietu = pakietProjektu(projekt);
  const pakietGry = usePakiet(idPakietu);
  // Projekt bez pakietu gry (własne karty): typy kart z szablonów projektu.
  const bezGry = idPakietu === undefined || idPakietu === PAKIET_WLASNY;
  const szablonyProjektu = projekt.szablony;
  const maWlasneKartki = projekt.arkusze.some((a) => a.wlasnySzablonId);
  const pakietZSzablonow = useMemo(
    () => (bezGry || maWlasneKartki ? pakietWlasny(szablonyProjektu) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- opisy rozmiarów zależą od języka
    [bezGry, maWlasneKartki, szablonyProjektu, jezykUi],
  );
  const pakiet = bezGry ? pakietZSzablonow : pakietGry;
  const pakietDlaKartki = (a: Arkusz | undefined) =>
    a?.wlasnySzablonId ? pakietZSzablonow : pakiet;
  const typyDlaKartki = (a: Arkusz) => {
    const typy = pakietDlaKartki(a)?.typyKart ?? [];
    return a.wlasnySzablonId ? typy.filter((typ) => typ.id === a.wlasnySzablonId) : typy;
  };
  const zasoby = useZSzarymiObrazami(edycja.zasoby.zasoby, projekt);
  const [zazn, ustawZaznSurowe] = useState<Zaznaczenie>();
  const [wyborDruku, ustawWyborDruku] = useState<{ bazowa?: string; arkuszId?: string }>({
    bazowa: pokazKartke,
  });
  const wybranyArkuszDruku =
    wyborDruku.bazowa === pokazKartke ? (wyborDruku.arkuszId ?? pokazKartke) : pokazKartke;
  const [menuStan, ustawMenuStan] = useState<{
    tryb: 'edycja' | 'drukuj';
    dane?: { arkuszId: string } & Polozenie;
  }>({ tryb });
  const menu = menuStan.tryb === tryb && !druk ? menuStan.dane : undefined;
  const ustawMenu = useCallback(
    (dane: ({ arkuszId: string } & Polozenie) | undefined) => ustawMenuStan({ tryb, dane }),
    [tryb],
  );
  const [gest, ustawGest] = useState<Gest>();
  const gestRef = useRef<Gest | undefined>(undefined);
  const [importTabeli, ustawImportTabeli] = useState<string>();
  const [toast, ustawToastSurowy] = useState<{ tekst: string; cofnij?: boolean; wersja: number }>();
  /** Komunikat o zmianie właśnie wykonanej (`zmian` – ile zmian dokumentu ją tworzy). */
  const ustawToast = useCallback(
    (x: { tekst: string; cofnij?: boolean } | undefined, zmian = 1) =>
      ustawToastSurowy(x && { ...x, wersja: edycja.wersja + (x.cofnij ? zmian : 0) }),
    [edycja.wersja],
  );
  const [bladUkladuStan, ustawBladUkladuStan] = useState<{
    tryb: 'edycja' | 'drukuj';
    tekst?: string;
  }>({ tryb });
  const bladUkladu = bladUkladuStan.tryb === tryb ? bladUkladuStan.tekst : undefined;
  const ustawBladUkladu = useCallback(
    (tekst: string | undefined) => ustawBladUkladuStan({ tryb, tekst }),
    [tryb],
  );
  const ustawWybranyArkuszDruku = useCallback(
    (arkuszId: string | undefined) => {
      ustawWyborDruku({ bazowa: pokazKartke, arkuszId });
      ustawBladUkladu(undefined);
    },
    [pokazKartke, ustawBladUkladu],
  );
  /** Zmiana zaznaczenia czyści komunikat o odrzuconej zmianie układu (należał do innego panelu). */
  const ustawZazn = useCallback(
    (z: Zaznaczenie) => {
      ustawZaznSurowe(z);
      ustawBladUkladu(undefined);
    },
    [ustawBladUkladu],
  );
  const [statusPdf, ustawStatusPdf] = useState('');
  /** Trwa tworzenie PDF albo obrazów – kolejne pobranie czeka (przyciski wyłączone). */
  const [zajete, ustawZajete] = useState(false);
  const wTle = (f: () => Promise<void>) => {
    if (zajete) return;
    ustawZajete(true);
    void f().finally(() => ustawZajete(false));
  };
  const kartkiRef = useRef<HTMLDivElement>(null);

  // --- Budowa stron (ta sama scena co w PDF), z pamięcią kart i kartek między renderami.
  // Nowa pamięć kart przy każdej zmianie zasobów (czcionki, obrazy, szablony).
  const pamiecKart = useMemo(
    () => (zasoby ? new WeakMap<Karta, { scena: Scena; ostrzezenia: Ostrzezenie[] }>() : undefined),
    [zasoby],
  );
  const dopisekKontynuacji = t('kartka.ciagDalszy');
  const pamiecKontynuacji = useMemo(
    () =>
      zasoby
        ? {
            dopisek: dopisekKontynuacji,
            sceny: new WeakMap<Karta, WyrenderowanaKarta[]>(),
          }
        : undefined,
    [zasoby, dopisekKontynuacji],
  );
  // Pamięć zbudowanych kartek (po id – tylko ostatnia wersja, historia nie trzyma starych SVG);
  // zmiana jednej kartki nie buduje pozostałych.
  const [pamiecKartek] = useState(
    () =>
      new Map<
        string,
        {
          arkusz: Arkusz;
          talia: Talia;
          rewersy: readonly Rewers[] | undefined;
          zasoby: unknown;
          jezyk: string;
          kalibracja: Kalibracja;
          k: Kartka;
        }
      >(),
  );
  const [kalibracja, ustawKalibracje] = useState(odczytajKalibracje);
  const zmienKalibracje = (k: Kalibracja) => {
    ustawKalibracje(k);
    zapiszKalibracje(k);
  };
  const [kalibracjaRewersu, ustawKalibracjeRewersu] = useState(odczytajKalibracjeRewersu);
  const zmienKalibracjeRewersu = (k: Kalibracja) => {
    ustawKalibracjeRewersu(k);
    zapiszKalibracjeRewersu(k);
  };
  const [warstwaTekstowaPdf, ustawWarstweTekstowaPdf] = useState(odczytajWarstweTekstowaPdf);
  const zmienWarstweTekstowaPdf = (wlaczona: boolean) => {
    ustawWarstweTekstowaPdf(wlaczona);
    zapiszWarstweTekstowaPdf(wlaczona);
  };
  const arkusze = useDeferredValue(projekt.arkusze);
  const talie = useDeferredValue(projekt.talie);
  const rewersy = useDeferredValue(projekt.rewersy);
  const projektRewersowy = czyProjektRewersowy(projekt);
  const pierwszySzablonId = projekt.szablony[0]?.id;
  const kartki = useMemo((): Kartka[] => {
    if (!zasoby || !pamiecKart) return [];
    const rewersyMapa = new Map((rewersy ?? []).map((r) => [r.id, r] as const));
    return arkusze.map((arkusz) => {
      const talia = talie.find((x) => x.id === arkusz.taliaId)!;
      const dwustronny = czyDwustronnyWlaczony(arkusz, talia, zasoby.szablony, rewersyMapa);
      const z = pamiecKartek.get(arkusz.id);
      if (
        z &&
        z.arkusz === arkusz &&
        z.talia === talia &&
        (!dwustronny || z.rewersy === rewersy) &&
        Boolean(z.k.svgRewersow) === dwustronny &&
        z.zasoby === zasoby &&
        z.jezyk === jezykUi &&
        z.kalibracja === kalibracja
      )
        return z.k;
      let k: Kartka;
      try {
        const ctxArkusza = {
          czcionki: zasoby.czcionki,
          szablony: zasoby.szablony,
          obraz: (id: string) => zasoby.obrazy.get(id)?.info,
          ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
          pamiecKart,
          kalibracja,
          ...(pamiecKontynuacji
            ? {
                dopisekKontynuacji: pamiecKontynuacji.dopisek,
                pamiecKontynuacji: pamiecKontynuacji.sceny,
              }
            : {}),
        };
        const taliaDoBudowy =
          projektRewersowy && talia.karty.length === 0 && pierwszySzablonId
            ? {
                ...talia,
                karty: [
                  {
                    id: '__podglad-rewersu__',
                    szablonId: pierwszySzablonId,
                    dane: {},
                    ilosc: 1,
                  },
                ],
              }
            : talia;
        const wynik = zbudujArkusz(arkusz, taliaDoBudowy, ctxArkusza);
        let svgRewersow: string[] | undefined;
        let pusteRewersy: boolean[] | undefined;
        if (dwustronny) {
          const wRev = zbudujStronyRewersow(arkusz, taliaDoBudowy, wynik, {
            ...ctxArkusza,
            rewersy: rewersyMapa,
          });
          if (wRev.ostrzezenia.length > 0) wynik.ostrzezenia.push(...wRev.ostrzezenia);
          svgRewersow = wRev.strony.map((s, i) =>
            scenaDoSvg(arkusz.ustawienia.czarnoBialy ? zSzarymiObrazami(s) : s, {
              adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
              przedrostekId: `${arkusz.id}-r${i}-`,
              atrybuty: { 'aria-hidden': 'true', class: 'svg-strony' },
            }),
          );
          pusteRewersy = wRev.puste;
        }
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
          ...(svgRewersow ? { svgRewersow } : {}),
          ...(pusteRewersy ? { pusteRewersy } : {}),
        };
      } catch (e) {
        k = { arkusz, talia, svg: [], blad: e instanceof Error ? e.message : String(e) };
      }
      pamiecKartek.set(arkusz.id, {
        arkusz,
        talia,
        rewersy,
        zasoby,
        jezyk: jezykUi,
        kalibracja,
        k,
      });
      return k;
    });
  }, [
    arkusze,
    talie,
    rewersy,
    projektRewersowy,
    pierwszySzablonId,
    zasoby,
    pamiecKart,
    pamiecKartek,
    pamiecKontynuacji,
    jezykUi,
    kalibracja,
  ]);

  // Menu wolnego miejsca wskazuje je indeksem na liście układu – po zmianie układu (mieszane
  // rozmiary) lista jest inna, więc menu zamykamy.
  const menuRef = useRef(menu);
  useEffect(() => {
    menuRef.current = menu;
  });
  useEffect(() => {
    const m = menuRef.current;
    if (m && projekt.arkusze.some((a) => a.id === m.arkuszId && czyMieszane(a)))
      ustawMenu(undefined);
    // Tylko zmiana wyniku układu (nowa lista wolnych miejsc) zamyka menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kartki]);

  // Siatka z BIEŻĄCYCH ustawień (podgląd stron jest odroczony): budowa bez kart – tania.
  const siatkiNaZywo = useMemo(() => {
    const m = new Map<string, { kolumny: number; rzedy: number }>();
    if (!zasoby) return m;
    for (const a of projekt.arkusze) {
      if (!a.ustawienia.slot) continue;
      if (a.ustawienia.drukarnia?.wlaczony && a.ustawienia.drukarnia.uklad === 'pojedyncza')
        continue;
      try {
        const w = zbudujArkusz(
          { ...a, przypiete: [], liczbaStron: 1 },
          { id: a.taliaId, nazwa: '', karty: [] },
          { czcionki: zasoby.czcionki, szablony: zasoby.szablony },
        );
        m.set(a.id, { kolumny: w.siatka.kolumny, rzedy: w.siatka.rzedy });
      } catch {
        // Błąd układu pokaże podgląd strony.
      }
    }
    return m;
  }, [projekt.arkusze, zasoby]);

  const kontekst = useCallback(
    (arkuszId: string): KontekstKartki | undefined => {
      const siatka =
        siatkiNaZywo.get(arkuszId) ?? kartki.find((x) => x.arkusz.id === arkuszId)?.wynik?.siatka;
      return siatka && zasoby ? { szablony: zasoby.szablony, siatka } : undefined;
    },
    [kartki, zasoby, siatkiNaZywo],
  );

  // Karty na żywo (z bieżącego projektu – przeciąganie i zaznaczenie bez opóźnienia).
  const kartyNaKartkach = useMemo(() => {
    const m = new Map<string, KartaNaKartce[]>();
    if (zasoby)
      for (const a of projekt.arkusze) m.set(a.id, kartyKartki(projekt, a.id, zasoby.szablony));
    return m;
  }, [projekt, zasoby]);
  // Cofnięcie usuwa kartkę z dokumentu przed odświeżeniem odroczonych scen.
  const aktualneKartki = kartki.filter((k) => kartyNaKartkach.has(k.arkusz.id));

  const zaznaczoneKarty = useMemo(() => {
    if (zazn?.rodzaj !== 'karty') return [];
    const ids = new Set(zazn.ids);
    return (kartyNaKartkach.get(zazn.arkuszId) ?? []).filter((k) => ids.has(k.karta.id));
  }, [zazn, kartyNaKartkach]);

  // Zaznaczenie wskazujące usunięte elementy (np. po „Cofnij”) – czyścimy.
  const zaznaczenieAktualne = druk
    ? false
    : zazn?.rodzaj === 'karty'
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
    (f: (p: Projekt) => Projekt, klucz?: string): boolean => {
      if (!zasoby) return false;
      const nowy = f(projekt);
      // Sprawdzenie z NOWYMI rolami czcionek (tymczasowo na wspólnym rejestrze – przywracane).
      const z =
        nowy.role === projekt.role
          ? zasoby
          : edycja.zasoby.zRolami(nowy.role, nowy.szablony).zasoby;
      let ok = true;
      try {
        for (const a of nowy.arkusze) {
          if (
            projekt.arkusze.includes(a) &&
            nowy.talie === projekt.talie &&
            nowy.role === projekt.role
          )
            continue;
          const talia = nowy.talie.find((x) => x.id === a.taliaId)!;
          const w = zbudujArkusz(a, talia, {
            czcionki: z.czcionki,
            szablony: z.szablony,
            obraz: (id) => z.obrazy.get(id)?.info,
            ...(z.elementy ? { elementy: z.elementy } : {}),
            // Zapamiętane karty są wyrenderowane starymi czcionkami – przy zmianie ról bez pamięci.
            ...(nowy.role === projekt.role && pamiecKart ? { pamiecKart } : {}),
          });
          const mieszana = czyMieszane(a);
          const przypietych = mieszana ? 0 : (a.przypiete ?? []).length;
          if (
            w.rozmieszczenie.karty.filter((c) => !c.czesc).length < przypietych ||
            w.ostrzezenia.some((o) =>
              /^(przypiecie-|siatka-za-mala|karta-wieksza-niz-strona)/.test(o.komunikat),
            ) ||
            // Nagłówki grup nie są rysowane przy własnym układzie – nie blokują jego zmian.
            (!a.ustawienia.uklad &&
              !mieszana &&
              (a.naglowki ?? []).some((h) => h.kolumna + h.kolumny > w.siatka.kolumny))
          ) {
            ok = false;
            break;
          }
        }
      } finally {
        if (nowy.role !== projekt.role) edycja.zasoby.zRolami(projekt.role, projekt.szablony);
      }
      if (!ok) {
        ustawBladUkladu(t('kartka.zmianaNieMiesci'));
        return false;
      }
      ustawBladUkladu(undefined);
      zmien(f, klucz ? { klucz: `uklad:${klucz}` } : {});
      return true;
    },
    [projekt, zasoby, zmien, pamiecKart, edycja.zasoby, ustawBladUkladu],
  );

  // --- Akcje na zaznaczeniu.
  const usunZaznaczone = useCallback(() => {
    if (aktywne?.rodzaj === 'naglowek') {
      if (zmienUklad((p) => usunNaglowek(p, aktywne.arkuszId, aktywne.id))) {
        ustawZazn(undefined);
        ustawToast({ tekst: t('kartka.usunietoNaglowek'), cofnij: true });
      }
      return;
    }
    if (aktywne?.rodzaj !== 'karty' || zaznaczoneKarty.length === 0) return;
    const n = zaznaczoneKarty.length;
    const k0 = zaznaczoneKarty[0]!.karta;
    const nazwa = nazwaKarty(
      k0.dane,
      projekt.szablony.find((x) => x.id === k0.szablonId),
    );
    zmien((p) => usunKarty(p, aktywne.arkuszId, aktywne.ids));
    ustawZazn(undefined);
    ustawToast({
      tekst:
        n === 1
          ? t('kartka.usunietoKarte', { nazwa: nazwa || t('karta.bezNazwy') })
          : t('kartka.usunietoKarty', { liczba: n }),
      cofnij: true,
    });
  }, [aktywne, zaznaczoneKarty, zmien, zmienUklad, ustawZazn, ustawToast, projekt.szablony]);

  const duplikuj = useCallback(
    (n: number) => {
      if (aktywne?.rodzaj !== 'karty') return;
      const ctx = kontekst(aktywne.arkuszId);
      if (!ctx) return;
      const ids = zaznaczoneKarty.map((k) => k.karta.id);
      const mieszane = projekt.arkusze.some((a) => a.id === aktywne.arkuszId && czyMieszane(a));
      const { kopie } = mieszane
        ? duplikujKartyMieszane(projekt, aktywne.arkuszId, ids, n)
        : duplikujKarty(projekt, aktywne.arkuszId, ids, n, ctx);
      zmien(
        (p) =>
          (mieszane
            ? duplikujKartyMieszane(p, aktywne.arkuszId, ids, n)
            : duplikujKarty(p, aktywne.arkuszId, ids, n, ctx)
          ).projekt,
      );
      if (kopie.length) ustawZazn({ rodzaj: 'karty', arkuszId: aktywne.arkuszId, ids: kopie });
      ustawToast({ tekst: t('kartka.zduplikowano', { liczba: kopie.length }), cofnij: true });
    },
    [aktywne, kontekst, projekt, zaznaczoneKarty, zmien, ustawZazn, ustawToast],
  );

  const przesunZaznaczone = useCallback(
    (o: Polozenie) => {
      if (aktywne?.rodzaj !== 'karty') return;
      const ctx = kontekst(aktywne.arkuszId);
      if (!ctx) return;
      const arkuszK = projekt.arkusze.find((a) => a.id === aktywne.arkuszId);
      if (arkuszK && czyMieszane(arkuszK)) {
        // Mieszane rozmiary: strzałki zmieniają kolejność (lewo / góra – wcześniej).
        const m = kartki.find((x) => x.arkusz.id === arkuszK.id)?.wynik?.mieszane;
        if (!m) return;
        const lista = kolejnoscWidoczna(m);
        const nowa = przesunWKolejnosci(lista, aktywne.ids, o.kolumna + o.rzad < 0 ? -1 : 1);
        if (nowa.join() !== lista.join()) {
          const przelacza = arkuszK.ustawienia.mieszane?.kolejnosc !== 'wlasna';
          zmien((p) => ustawKolejnosc(p, arkuszK.id, nowa));
          if (przelacza) ustawToast({ tekst: t('mieszane.przelaczono'), cofnij: true });
        }
        return;
      }
      const w = przesunKarty(projekt, aktywne.arkuszId, aktywne.ids, o, ctx);
      if ('blad' in w) return;
      zmien((p) => {
        const x = przesunKarty(p, aktywne.arkuszId, aktywne.ids, o, ctx);
        return 'projekt' in x ? x.projekt : p;
      });
      // Przycisk karty jest renderowany od nowa w nowym miejscu – fokus idzie za nią.
      if (document.activeElement?.matches('.karta-na-kartce'))
        fokusPo(`[data-karta="${aktywne.ids[0]}"]`);
    },
    [aktywne, kontekst, projekt, zmien, kartki, ustawToast],
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
      } else if (druk) {
        return;
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
      } else if (
        aktywne?.rodzaj === 'karty' &&
        e.key.startsWith('Arrow') &&
        !document.activeElement?.classList.contains('slot')
      ) {
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
  }, [aktywne, druk, duplikuj, edycja, przesunZaznaczone, ustawMenu, usunZaznaczone, ustawZazn]);

  // Miniatura pierwszej strony na liście projektów (bez obrazów – adresy blob: są chwilowe).
  // Dla projektów własnych i rewersowych zachowujemy miniaturę pojedynczego szablonu/rewersu.
  const pierwszaStrona =
    czyProjektRewersowy(projekt) || czyProjektWlasny(projekt)
      ? undefined
      : kartki[0]?.wynik?.strony[0];
  useEffect(() => {
    if (!pierwszaStrona || edycja.niezapisane) return;
    const z = setTimeout(() => {
      void baza()
        .zapiszMiniature(projekt.id, scenaDoSvg(pierwszaStrona, { przedrostekId: 'min-' }))
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(z);
  }, [edycja.niezapisane, pierwszaStrona, projekt.id]);
  // …i od razu przy wyjściu z edytora (tylko gdy stan projektu jest zapisany).
  const ostatniaStrona = useRef(pierwszaStrona);
  const niezapisaneRef = useRef(edycja.niezapisane);
  useEffect(() => {
    ostatniaStrona.current = pierwszaStrona;
    niezapisaneRef.current = edycja.niezapisane;
  });
  const idProjektu = projekt.id;
  useEffect(
    () => () => {
      const s = ostatniaStrona.current;
      if (s && !niezapisaneRef.current)
        void baza()
          .zapiszMiniature(idProjektu, scenaDoSvg(s, { przedrostekId: 'min-' }))
          .catch(() => undefined);
    },
    [idProjektu],
  );

  // Komunikat znika sam po chwili.
  useEffect(() => {
    if (!toast) return;
    const z = setTimeout(() => ustawToastSurowy(undefined), 8000);
    return () => clearTimeout(z);
  }, [toast]);
  // „Cofnij” w komunikacie dotyczy tylko zmiany, o której mówi – po kolejnej zmianie komunikat znika.
  const toastAktualny = toast && toast.wersja === edycja.wersja ? toast : undefined;

  // --- Gesty myszy (delegacja zdarzeń na warstwach stron).
  const stronaPod = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.strona-kartki[data-strona]');
    if (!el || el.dataset.strona === undefined) return undefined;
    return { el, arkuszId: el.dataset.arkusz!, strona: Number(el.dataset.strona) };
  };
  const mmNaStronie = (el: HTMLElement, g: Geometria, x: number, y: number) => {
    const r = el.getBoundingClientRect();
    return { x: ((x - r.left) / r.width) * g.szer, y: ((y - r.top) / r.height) * g.wys };
  };

  // Aktywne nasłuchy gestu na window – zdejmowane także przy odmontowaniu edytora.
  const nasluchy = useRef<
    { ruch: (e: PointerEvent) => void; koniec: () => void; anuluj: () => void } | undefined
  >(undefined);
  useEffect(
    () => () => {
      const n = nasluchy.current;
      if (!n) return;
      window.removeEventListener('pointermove', n.ruch);
      window.removeEventListener('pointerup', n.koniec);
      window.removeEventListener('pointercancel', n.anuluj);
    },
    [],
  );

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
    const przesuniety = Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > PROG_RUCHU;
    if ((g.rodzaj === 'karty' || g.rodzaj === 'kolejnosc') && g.dotyk && !g.ruch) {
      // Dotyk: ruch przed przytrzymaniem przewija stronę (karta ma touch-action: none).
      if (g.dotyk.przewijanie || (przesuniety && e.timeStamp - g.dotyk.t0 < PRZYTRZYMANIE_MS)) {
        window.scrollBy(g.dotyk.x - e.clientX, g.dotyk.y - e.clientY);
        gestRef.current = {
          ...g,
          dotyk: { ...g.dotyk, x: e.clientX, y: e.clientY, przewijanie: true },
        };
        return;
      }
    }
    if (g.rodzaj === 'obszar' && g.dotyk && przesuniety) {
      // Dotyk na pustym miejscu przewija stronę (przeglądarka) – bez zaznaczania prostokątem.
      zakonczGest(true);
      return;
    }
    const ruch = g.ruch || przesuniety;
    const k = kartki.find((x) => x.arkusz.id === g.arkuszId);
    const s = stronaPod(e.clientX, e.clientY);
    if (g.rodzaj === 'kolejnosc') {
      const m = k?.wynik?.mieszane;
      if (!ruch || !k?.geometria || !m) return ustawGestOba({ ...g, ruch });
      if (!s || s.arkuszId !== g.arkuszId) {
        const { cel: _c, ...bez } = g;
        void _c;
        return ustawGestOba({ ...bez, ruch });
      }
      const pt = mmNaStronie(s.el, k.geometria, e.clientX, e.clientY);
      return ustawGestOba({ ...g, ruch, cel: celKolejnosci(m, g.ids, s.strona, pt) });
    }
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

  /** Zdejmuje nasłuchy gestu; `przerwij` – bez skutków (np. pointercancel, odmontowanie). */
  const zakonczGest = (przerwij = false) => {
    const n = nasluchy.current;
    if (n) {
      window.removeEventListener('pointermove', n.ruch);
      window.removeEventListener('pointerup', n.koniec);
      window.removeEventListener('pointercancel', n.anuluj);
      nasluchy.current = undefined;
    }
    if (przerwij) ustawGestOba(undefined);
  };

  const koniecGestu = () => {
    zakonczGest();
    const g = gestRef.current;
    ustawGestOba(undefined);
    if (!g || g.rodzaj === 'obraz') return;
    if (g.rodzaj === 'kolejnosc') {
      const m = kartki.find((x) => x.arkusz.id === g.arkuszId)?.wynik?.mieszane;
      const arkuszG = projekt.arkusze.find((a) => a.id === g.arkuszId);
      if (g.ruch && g.cel && m && arkuszG) {
        const lista = kolejnoscWidoczna(m);
        const nowa = przeniesWKolejnosci(lista, g.ids, g.cel.przedId);
        if (nowa.join() !== lista.join()) {
          // Pierwsze przeciągnięcie przy „od największych” przełącza na kolejność własną.
          const przelacza = arkuszG.ustawienia.mieszane?.kolejnosc !== 'wlasna';
          zmien((p) => ustawKolejnosc(p, g.arkuszId, nowa));
          if (przelacza) ustawToast({ tekst: t('mieszane.przelaczono'), cofnij: true });
        }
      } else if (!g.ruch && g.ids.length > 1) {
        ustawZazn({ rodzaj: 'karty', arkuszId: g.arkuszId, ids: [g.klik] });
      }
      return;
    }
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
    if (cel.closest('.pasek-karty, .menu-typu, .usun-strone, [data-kontynuacja]')) return;
    ustawMenu(undefined);
    const stronaEl = e.currentTarget.closest<HTMLElement>('.strona-kartki')!;
    const pt = mmNaStronie(stronaEl, k.geometria, e.clientX, e.clientY);
    const kartaEl = cel.closest<HTMLElement>('[data-karta]');
    const naglowekEl = cel.closest<HTMLElement>('[data-naglowek]');
    const mieszane = czyMieszane(k.arkusz);
    if (mieszane && !kartaEl) {
      // Mieszane rozmiary: wolne miejsce otwiera menu przez swój przycisk, reszta odznacza.
      if (!cel.closest('[data-wolne]')) ustawZazn(undefined);
      return;
    }
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
      } else if (mieszane) {
        ustawGestOba({
          rodzaj: 'kolejnosc',
          arkuszId: k.arkusz.id,
          ids,
          klik: id,
          x0: e.clientX,
          y0: e.clientY,
          ruch: false,
          ...(e.pointerType === 'touch'
            ? { dotyk: { t0: e.timeStamp, x: e.clientX, y: e.clientY, przewijanie: false } }
            : {}),
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
          ...(e.pointerType === 'touch'
            ? { dotyk: { t0: e.timeStamp, x: e.clientX, y: e.clientY, przewijanie: false } }
            : {}),
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
        ...(e.pointerType === 'touch' ? { dotyk: true } : {}),
      });
    }
    zakonczGest();
    nasluchy.current = { ruch: ruchGestu, koniec: koniecGestu, anuluj: () => zakonczGest(true) };
    window.addEventListener('pointermove', ruchGestu);
    window.addEventListener('pointerup', koniecGestu);
    window.addEventListener('pointercancel', nasluchy.current.anuluj);
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
    const arkuszM = projekt.arkusze.find((a) => a.id === menu.arkuszId);
    if (arkuszM && czyMieszane(arkuszM)) {
      // Mieszane: kliknięte wolne miejsce wskazuje kartę, za którą wstawiamy (kolejność własna).
      const wolne = kartki.find((x) => x.arkusz.id === arkuszM.id)?.wynik?.mieszane?.wolne[
        menu.kolumna
      ];
      const po = wolne?.poKluczu?.slice(0, wolne.poKluczu.lastIndexOf('#'));
      const typKarty = { szablonId: w.szablonId, ...(w.dane ? { dane: w.dane } : {}) };
      const { kartaId } = dodajKarteMieszane(projekt, arkuszM.id, typKarty, po);
      if (!zmienUklad((p) => dodajKarteMieszane(p, arkuszM.id, typKarty, po).projekt)) {
        ustawToast({ tekst: t('kartka.nieMiesci') });
        return;
      }
      ustawZazn({ rodzaj: 'karty', arkuszId: arkuszM.id, ids: [kartaId] });
      ustawMenu(undefined);
      fokusPo(`[data-karta="${kartaId}"]`);
      return;
    }
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
    fokusPo(`[data-karta="${proba.kartaId}"]`);
  };

  const dodajZInnegoProjektu = async (klucz: string) => {
    if (!menu) return;
    const polozenie = menu;
    const wpis = awersyInne.find((a) => kluczAwersuZProjektu(a) === klucz);
    if (!wpis) return;
    ustawMenu(undefined);
    try {
      const paczka = await wczytajPaczkeAwersuBezRewersu(wpis);
      let dodanaKartaId: string | undefined;
      await edycja.zmienZZasobami((p, d) => {
        const istniejacy = p.szablony.find(
          (s) =>
            s.korzen.dzieci.length > 0 &&
            normalizujNazweSzablonu(s.nazwa) === normalizujNazweSzablonu(wpis.szablonNazwa),
        );
        const dodany = istniejacy
          ? { projekt: p, szablonId: istniejacy.id, zasoby: d }
          : dodajSzablon(p, d, paczka);
        const nowySzablon = dodany.projekt.szablony.find((s) => s.id === dodany.szablonId);
        if (!nowySzablon) return { projekt: p, dane: d };
        const arkuszM = dodany.projekt.arkusze.find((a) => a.id === polozenie.arkuszId);
        if (arkuszM && czyMieszane(arkuszM)) {
          const wolne = kartki.find((x) => x.arkusz.id === arkuszM.id)?.wynik?.mieszane?.wolne[
            polozenie.kolumna
          ];
          const po = wolne?.poKluczu?.slice(0, wolne.poKluczu.lastIndexOf('#'));
          const w = dodajKarteMieszane(
            dodany.projekt,
            arkuszM.id,
            { szablonId: nowySzablon.id },
            po,
          );
          dodanaKartaId = w.kartaId;
          return { projekt: w.projekt, dane: dodany.zasoby };
        }
        const bazaCtx = kontekst(polozenie.arkuszId);
        if (!bazaCtx) return { projekt: p, dane: d };
        const szablonyZNowym = new Map(bazaCtx.szablony);
        szablonyZNowym.set(nowySzablon.id, nowySzablon);
        const domyslnyRozmiar =
          nowySzablon.rozmiar.tryb === 'sloty'
            ? { kolumny: nowySzablon.rozmiar.kolumny, rzedy: nowySzablon.rozmiar.rzedy }
            : { kolumny: 1, rzedy: 1 };
        const x = dodajKarteWSlocie(
          dodany.projekt,
          polozenie.arkuszId,
          polozenie,
          { szablonId: nowySzablon.id, rozmiary: [domyslnyRozmiar] },
          { ...bazaCtx, szablony: szablonyZNowym },
        );
        if ('blad' in x) return { projekt: p, dane: d };
        dodanaKartaId = x.kartaId;
        return { projekt: x.projekt, dane: dodany.zasoby };
      });
      if (dodanaKartaId) {
        ustawZazn({ rodzaj: 'karty', arkuszId: polozenie.arkuszId, ids: [dodanaKartaId] });
        fokusPo(`[data-karta="${dodanaKartaId}"]`);
      } else {
        ustawToast({ tekst: t('kartka.nieMiesci') });
      }
    } catch (e) {
      ustawToast({ tekst: e instanceof Error ? e.message : String(e) });
    }
  };

  const wybierzRewersKarty = (
    taliaId: string,
    kartaId: string,
    rewersId: PrzypisanieRewersu | undefined,
  ) => {
    zmien((p) => przypiszRewers(p, { rodzaj: 'karta', taliaId, id: kartaId }, rewersId));
  };

  const wybierzRewersGlobalnyKarty = (
    taliaId: string,
    kartaId: string,
    wpis: ZapisanyRewersGlobalny,
  ) => {
    void dolaczRewersGlobalnyDoProjektu(wpis, edycja, (p, rid) =>
      przypiszRewers(p, { rodzaj: 'karta', taliaId, id: kartaId }, rid),
    ).catch((e) => ustawToast({ tekst: e instanceof Error ? e.message : String(e) }));
  };
  // Przycisk „Rozmiar” na pasku nad kartą: następny (cyklicznie) rozmiar typu, który się mieści.
  const nastepnyRozmiar = (() => {
    const jedna = aktywne?.rodzaj === 'karty' && zaznaczoneKarty.length === 1 && zaznaczoneKarty[0];
    if (!jedna) return undefined;
    const arkusz = projekt.arkusze.find((a) => a.id === aktywne.arkuszId);
    const rozmiary =
      typDlaSzablonu(pakietDlaKartki(arkusz), jedna.karta.szablonId)?.typ.rozmiary ?? [];
    const ctx = kontekst(aktywne.arkuszId);
    if (!rozmiary.length || !ctx) return undefined;
    const mozliwe = mozliweRozmiary(projekt, aktywne.arkuszId, jedna.karta.id, rozmiary, ctx);
    const i = rozmiary.findIndex((r) => r.kolumny === jedna.kolumny && r.rzedy === jedna.rzedy);
    // Wczytana karta może mieć rozmiar spoza listy typu. Wtedy sprawdzamy całą listę.
    for (let d = 1; d <= rozmiary.length; d++) {
      const j = (i + d) % rozmiary.length;
      const r = rozmiary[j]!;
      if (j === i || !mozliwe[j]) continue;
      return {
        etykieta: t('kartka.rozmiarNastepny', {
          rozmiar: `${r.kolumny}×${r.rzedy}${r.nazwa ? ` ${r.nazwa}` : ''}`,
        }),
        zmien: () =>
          zmien((p) => {
            const x = zmienRozmiarKarty(p, aktywne.arkuszId, jedna.karta.id, r, ctx);
            return 'projekt' in x ? x.projekt : p;
          }),
      };
    }
    return undefined;
  })();
  const zamknijMenu = () => {
    if (!menu) return;
    ustawMenu(undefined);
    fokusPo(
      `[data-arkusz="${menu.arkuszId}"][data-strona="${menu.strona}"] [data-slot="${menu.kolumna},${menu.rzad}"]`,
    );
  };

  const zadaniePdf = (z: NonNullable<typeof zasoby>, dodatki: Partial<ZadaniePdf> = {}) => {
    return {
      tytul: projekt.nazwa,
      dopisekKontynuacji: t('kartka.ciagDalszy'),
      arkusze: projekt.arkusze,
      talie: projekt.talie,
      szablony: [...z.szablony.values()],
      ...(projekt.rewersy?.length ? { rewersy: projekt.rewersy } : {}),
      czcionki: z.plikiCzcionek,
      ...(z.elementy ? { elementy: [...z.elementy] } : {}),
      role: z.role,
      ...(z.zapasowa !== undefined ? { zapasowa: z.zapasowa } : {}),
      obrazy: [...z.obrazy].map(([id, o]) => ({
        id,
        info: o.info,
        dane: o.dane,
        format: o.format,
      })),
      // Kalibracja przesuwa wydruk PDF. Margines znaczników uwzględnia ją także w podglądzie.
      ...(kalibracja.x || kalibracja.y ? { przesuniecie: kalibracja } : {}),
      ...(kalibracjaRewersu.x || kalibracjaRewersu.y
        ? { przesuniecieRewersu: kalibracjaRewersu }
        : {}),
      ...(warstwaTekstowaPdf ? { warstwaTekstowa: true } : {}),
      ...dodatki,
    };
  };
  /** Liczba kart w strefie przycięcia (formaty zdjęciowe) – ostrzeżenie przy eksporcie. */
  const wStrefie = () =>
    kartki.reduce(
      (n, k) =>
        n +
        (k.wynik?.ostrzezenia.filter((o) => o.komunikat === 'karta-w-strefie-przyciecia').length ??
          0),
      0,
    );
  const zStrefa = (tekst: string) => {
    const n = wStrefie();
    return n > 0 ? `${tekst} ${t('pobierz.ostrzezenieStrefy', { liczba: n })}` : tekst;
  };

  const pobierzPdf = async () => {
    if (!zasoby) return;
    ustawStatusPdf(t('arkusze.generowanie'));
    try {
      const bajty = await pdfWWatku(zadaniePdf(zasoby));
      zapiszPlik(bajty, 'application/pdf', nazwaPliku(projekt.nazwa, '.pdf'));
      ustawStatusPdf(zStrefa(t('arkusze.pdfGotowy')));
    } catch (e) {
      ustawStatusPdf(
        t('kartka.bladPdf', { szczegoly: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  const wydrukTestowy = async (arkusz: Arkusz) => {
    if (!zasoby) return;
    ustawStatusPdf(t('arkusze.generowanie'));
    try {
      const bajty = await pdfWWatku(zadaniePdf(zasoby, { testowy: arkusz.id }));
      zapiszPlik(
        bajty,
        'application/pdf',
        nazwaPliku(`${arkusz.nazwa}-${t('pobierz.plikTestowy')}`, '.pdf'),
      );
      ustawStatusPdf(t('pobierz.wydrukTestowyGotowy'));
    } catch (e) {
      ustawStatusPdf(
        t('kartka.bladPdf', { szczegoly: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  const wydrukTestowyDwustronny = async (arkusz: Arkusz) => {
    if (!zasoby) return;
    ustawStatusPdf(t('arkusze.generowanie'));
    try {
      const bajty = await pdfWWatku(
        zadaniePdf(zasoby, {
          testowyDwustronny: arkusz.id,
          etykietyTestowe: { przod: t('dwustronny.testPrzod'), tyl: t('dwustronny.testTyl') },
        }),
      );
      zapiszPlik(
        bajty,
        'application/pdf',
        nazwaPliku(`${arkusz.nazwa}-${t('dwustronny.plikProbny')}`, '.pdf'),
      );
      ustawStatusPdf(t('dwustronny.probnyGotowy'));
    } catch (e) {
      ustawStatusPdf(
        t('kartka.bladPdf', { szczegoly: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  const pobierzObrazy = async (rodzaj: 'strony' | 'karty', format: FormatObrazu) => {
    if (!zasoby) return;
    const postep = (gotowe: number, razem: number) =>
      ustawStatusPdf(t('pobierz.rasteryzacja', { gotowe, razem }));
    try {
      postep(0, 1);
      const sceny =
        rodzaj === 'strony' ? scenyStron(kartki, format) : scenyKart(kartki, zasoby, format);
      if (sceny.length === 0) {
        ustawStatusPdf(t('pobierz.nicDoEksportu'));
        return;
      }
      const pliki = await obrazyScen(sceny, zasoby.obrazy, format, postep);
      const wynik = spakuj(
        pliki,
        nazwaPliku(
          `${projekt.nazwa}-${t(rodzaj === 'strony' ? 'pobierz.plikStrony' : 'pobierz.plikKarty')}`,
          '.zip',
        ),
      );
      zapiszPlik(wynik.bajty, wynik.typ, wynik.nazwa);
      ustawStatusPdf(zStrefa(t('pobierz.obrazyGotowe')));
    } catch (e) {
      ustawStatusPdf(
        t('pobierz.bladObrazow', { szczegoly: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  // --- Panel boczny.
  const kartkaImportu = projekt.arkusze.find((a) => a.id === importTabeli);
  const szablonyDoImportu = (a: Arkusz) => {
    const ids = new Set(typyDlaKartki(a).flatMap((typ) => typ.warianty.map((w) => w.szablonId)));
    const dostepne = [...(zasoby?.szablony.values() ?? [])].filter((s) => ids.has(s.id));
    const slot = kartki.find((k) => k.arkusz.id === a.id)?.wynik?.slot ?? a.ustawienia.slot;
    if (czyMieszane(a)) return dostepne;
    return dostepne.filter((s) => !slot || pasujeDoSlotu(s, slot, a.ustawienia.dopasowanie));
  };
  const arkuszZazn = aktywne && projekt.arkusze.find((a) => a.id === aktywne.arkuszId);
  const arkuszDruku =
    projekt.arkusze.find((a) => a.id === (wybranyArkuszDruku ?? pokazKartke)) ?? projekt.arkusze[0];
  const arkuszBiezacy = druk ? arkuszDruku : arkuszZazn;
  const nowaKartka = pakiet
    ? () => {
        const nazwa = t('kartka.nazwaKartki', { numer: projekt.arkusze.length + 1 });
        // Własne karty: nowa kartka bez tytułu, z ustawieniami zaznaczonej (ten sam rozmiar kart).
        const wzor =
          bezGry && arkuszBiezacy
            ? { nazwa, ustawienia: arkuszBiezacy.ustawienia }
            : pakiet.nowaKartka;
        const w = dodajKartke(projekt, wzor, nazwa, !bezGry);
        zmien((p) => dodajKartke(p, wzor, nazwa, !bezGry).projekt);
        ustawWybranyArkuszDruku(w.arkuszId);
      }
    : undefined;
  // Własne karty: nowa kartka dopasowana do rozmiaru szablonu (bez tytułu, papier jak zaznaczona).
  const nowaKartkaDlaSzablonu = (szablonId: string) => {
    const s = projekt.szablony.find((x) => x.id === szablonId);
    if (!s) return;
    if (!bezGry) {
      const w = kartkaDlaSzablonu(projekt, szablonId);
      if (w.projekt !== projekt) zmien((p) => kartkaDlaSzablonu(p, szablonId).projekt);
      ustawWybranyArkuszDruku(w.arkuszId);
      return;
    }
    const papier = arkuszBiezacy?.ustawienia;
    const wzor = {
      nazwa: s.nazwa,
      ustawienia: ustawieniaKartkiDla(s, papier?.papier, papier?.wymiaryPapieru),
    };
    const w = dodajKartke(projekt, wzor, s.nazwa, false);
    zmien((p) => dodajKartke(p, wzor, s.nazwa, false).projekt);
    ustawWybranyArkuszDruku(w.arkuszId);
  };
  /** Karty kartki pogrupowane wg szablonu i wymiaru – lista „Na kartce” w trybie mieszanym. */
  const naKartce = (a: Arkusz) => {
    const talia = projekt.talie.find((x) => x.id === a.taliaId);
    const grupy = new Map<
      string,
      { id: string; nazwa: string; kolor?: string; szer: number; wys: number; liczba: number }
    >();
    for (const kt of talia?.karty ?? []) {
      const sz = zasoby?.szablony.get(kt.szablonId);
      if (!sz || kt.ilosc < 1) continue;
      const { szer, wys } = wymiaryKarty(sz, kt);
      const klucz = `${sz.id}|${szer}|${wys}`;
      const g = grupy.get(klucz);
      if (g) g.liczba += kt.ilosc;
      else
        grupy.set(klucz, {
          id: klucz,
          nazwa: sz.nazwa,
          ...(sz.tlo ? { kolor: sz.tlo } : {}),
          szer,
          wys,
          liczba: kt.ilosc,
        });
    }
    return [...grupy.values()];
  };

  let panel: React.ReactNode;
  if (druk) {
    if (arkuszDruku) {
      const wynikDruku = kartki.find((k) => k.arkusz.id === arkuszDruku.id)?.wynik;
      panel = (
        <PanelUstawien
          staly
          kalibracja={kalibracja}
          zmienKalibracje={zmienKalibracje}
          kalibracjaRewersu={kalibracjaRewersu}
          zmienKalibracjeRewersu={zmienKalibracjeRewersu}
          warstwaTekstowaPdf={warstwaTekstowaPdf}
          zmienWarstweTekstowaPdf={zmienWarstweTekstowaPdf}
          key={arkuszDruku.id}
          edycja={edycja}
          arkusz={arkuszDruku}
          arkusze={projekt.arkusze.map((a) => ({ id: a.id, nazwa: a.nazwa }))}
          wybierzArkusz={(id) => {
            ustawWybranyArkuszDruku(id);
            ustawBladUkladu(undefined);
          }}
          zmienUklad={zmienUklad}
          {...(wynikDruku ? { wynik: wynikDruku } : {})}
          wydrukTestowy={() => wTle(() => wydrukTestowy(arkuszDruku))}
          wydrukTestowyDwustronny={() => wTle(() => wydrukTestowyDwustronny(arkuszDruku))}
          przelaczRozmiary={(trybRozm) => {
            if (trybRozm === 'mieszane') zmienUklad((p) => naMieszane(p, arkuszDruku.id));
            else if (zasoby) {
              const ctxSiatki = {
                czcionki: zasoby.czcionki,
                obraz: (id: string) => zasoby.obrazy.get(id)?.info,
              };
              const { odlozone } = wrocDoSiatki(projekt, arkuszDruku.id, ctxSiatki);
              zmien((p) => wrocDoSiatki(p, arkuszDruku.id, ctxSiatki).projekt);
              if (odlozone > 0)
                ustawToast({ tekst: tn('mieszane.odlozono', odlozone), cofnij: true });
            }
          }}
          naKartce={naKartce(arkuszDruku)}
          {...(bladUkladu ? { blad: bladUkladu } : {})}
          {...(nowaKartka ? { nowaKartka } : {})}
          kartkaDlaSzablonu={nowaKartkaDlaSzablonu}
        />
      );
    }
  } else if (aktywne?.rodzaj === 'karty' && arkuszZazn && kontekst(arkuszZazn.id)) {
    const ctx = kontekst(arkuszZazn.id)!;
    const naStronie = zaznaczoneKarty.filter((k) => k.strona === zaznaczoneKarty[0]?.strona);
    const od = Math.min(...naStronie.map((k) => k.kolumna));
    const do_ = Math.max(...naStronie.map((k) => k.kolumna + k.kolumny));
    const mozeNaglowek =
      !!arkuszZazn.ustawienia.grupy &&
      !arkuszZazn.ustawienia.uklad &&
      !czyMieszane(arkuszZazn) &&
      naStronie.length > 0;
    panel = (
      <PanelKart
        key={aktywne.ids.join(',')}
        edycja={edycja}
        arkusz={arkuszZazn}
        karty={zaznaczoneKarty}
        pakiet={pakietDlaKartki(arkuszZazn)}
        ctx={ctx}
        duplikuj={duplikuj}
        usun={usunZaznaczone}
        zamknij={() => ustawZazn(undefined)}
        {...((bezGry || arkuszZazn.wlasnySzablonId === zaznaczoneKarty[0]?.karta.szablonId) &&
        zaznaczoneKarty[0]
          ? {
              edytujSzablon: `#/projekt/${encodeURIComponent(projekt.id)}/szablon/${encodeURIComponent(zaznaczoneKarty[0].karta.szablonId)}`,
            }
          : {})}
        ostrzezenia={(kartki.find((x) => x.arkusz.id === arkuszZazn.id)?.wynik?.ostrzezenia ?? [])
          .filter((o) => o.kartaId && aktywne.ids.includes(o.kartaId))
          .map((o) =>
            // Jedna karta – bez jej nazwy przed treścią; kilka – z nazwą zamiast identyfikatora.
            aktywne.ids.length === 1
              ? tekstOstrzezeniaArkusza({ komunikat: o.komunikat })
              : tekstOstrzezeniaArkusza(
                  o,
                  (() => {
                    const k = zaznaczoneKarty.find((x) => x.karta.id === o.kartaId)?.karta;
                    return k && nazwaKarty(k.dane, zasoby?.szablony.get(k.szablonId));
                  })(),
                ),
          )}
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
                const opis = {
                  strona,
                  kolumna: od,
                  kolumny: do_ - od,
                  naglowek: t('kartka.nowaGrupa'),
                };
                const ok = zmienUklad((p) => {
                  const x = dodajNaglowek(p, arkuszZazn.id, opis, ctx);
                  return 'projekt' in x ? x.projekt : p;
                });
                if (ok) ustawZazn({ rodzaj: 'naglowek', arkuszId: arkuszZazn.id, id: w.id });
                else ustawToast({ tekst: t('kartka.zmianaNieMiesci') });
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
          key={h.id}
          arkusz={arkuszZazn}
          naglowek={h}
          maksKolumn={ctx.siatka.kolumny}
          {...(bladUkladu ? { blad: bladUkladu } : {})}
          zmien={(z, klucz) => {
            const w = zmienNaglowek(projekt, arkuszZazn.id, h.id, z, ctx);
            if ('blad' in w) return ustawBladUkladu(t('kartka.naglowekKoliduje'));
            zmienUklad(
              (p) => {
                const x = zmienNaglowek(p, arkuszZazn.id, h.id, z, ctx);
                return 'projekt' in x ? x.projekt : p;
              },
              klucz ? `naglowek:${h.id}:${klucz}` : undefined,
            );
          }}
          usun={usunZaznaczone}
          zamknij={() => ustawZazn(undefined)}
        />
      );
  }
  const szablonyCsvProjektu = [
    ...new Map(projekt.arkusze.flatMap((a) => szablonyDoImportu(a)).map((s) => [s.id, s])).values(),
  ];
  const taliaDomyslna = projekt.talie.find((x) => x.id === arkuszZazn?.taliaId) ?? projekt.talie[0];
  panel ??= (
    <aside className="panel-edytora" aria-label={t('kartka.pomoc')}>
      <h2>{t('kartka.nicNieZaznaczono')}</h2>
      <PanelRewersuIAwersu edycja={edycja} talia={taliaDomyslna} />
      <p className="podpis">{t('kartka.pomocDodawanie')}</p>
      <p className="podpis">{t('kartka.pomocZaznaczanie')}</p>
      <p className="podpis">{t('kartka.pomocSkroty')}</p>
      <p className="podpis">{t('kartka.pomocDruk')}</p>
      <EksportCsvSzablonu szablony={szablonyCsvProjektu} />
    </aside>
  );

  // Ostrzeżenia kartek (nie kart): przypięcia poza siatką, nagłówki, tytuł; karty odłożone.
  const ileKart = (k: Kartka, kod: string) =>
    new Set((k.wynik?.ostrzezenia ?? []).filter((o) => o.komunikat === kod).map((o) => o.kartaId))
      .size;
  const ileKartDpi = (k: Kartka) =>
    new Set(
      (k.wynik?.ostrzezenia ?? [])
        .filter(
          (o) =>
            o.komunikat.startsWith('niska-rozdzielczosc-obrazu:') ||
            o.komunikat.startsWith('niska-rozdzielczosc-ramki:'),
        )
        .map((o) => o.kartaId),
    ).size;
  const ostrzezeniaKartek = kartki.flatMap((k) => [
    ...(k.wynik?.ostrzezenia ?? [])
      .filter((o) => !o.kartaId)
      .map((o) => `${k.arkusz.nazwa}: ${tekstOstrzezeniaArkusza(o)}`),
    // Ostrzeżenia kart dotyczące całej kartki (rozmiar, strefa przycięcia, DPI, spad) – zbiorczo.
    ...(ileKart(k, 'papier-za-maly-na-spad') > 0 &&
    !(k.wynik?.ostrzezenia ?? []).some(
      (o) => !o.kartaId && o.komunikat === 'papier-za-maly-na-spad',
    )
      ? [`${k.arkusz.nazwa}: ${tekstOstrzezeniaArkusza({ komunikat: 'papier-za-maly-na-spad' })}`]
      : []),
    ...(ileKartDpi(k)
      ? [
          t('kartka.niskieDpi', {
            kartka: k.arkusz.nazwa,
            liczba: ileKartDpi(k),
          }),
        ]
      : []),
    ...(ileKart(k, 'karta-w-strefie-przyciecia')
      ? [
          t('kartka.wStrefie', {
            kartka: k.arkusz.nazwa,
            liczba: ileKart(k, 'karta-w-strefie-przyciecia'),
          }),
        ]
      : []),
    ...(ileKart(k, 'karta-inny-rozmiar')
      ? [
          t('kartka.innyRozmiarKart', {
            kartka: k.arkusz.nazwa,
            liczba: ileKart(k, 'karta-inny-rozmiar'),
          }),
        ]
      : []),
    ...(kartyOdlozone(projekt, k.arkusz.id).length
      ? [
          t('kartka.odlozone', {
            kartka: k.arkusz.nazwa,
            liczba: kartyOdlozone(projekt, k.arkusz.id).length,
          }),
        ]
      : []),
  ]);

  // Role bez czcionki – silnik użył zapasowej (zbiór uzupełniany przy budowie stron).
  const brakujaceCzcionki = useMemo(
    () => (kartki.length && zasoby ? [...zasoby.czcionki.brakujace] : []),
    [kartki, zasoby],
  );
  const brakujaceWarianty = useMemo(
    () =>
      kartki.length && zasoby
        ? komunikatyBrakujacychWariantow([...zasoby.czcionki.brakujaceWarianty.values()])
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- teksty zależą od języka
    [kartki, zasoby, jezykUi],
  );

  // --- Widok.
  const idProjektuUrl = encodeURIComponent(projekt.id);
  const szablonPowrotu =
    (pokazKartke
      ? projekt.arkusze.find((a) => a.id === pokazKartke)?.wlasnySzablonId
      : projekt.arkusze[0]?.wlasnySzablonId) ?? projekt.szablony[0]?.id;
  const adresPowrotu = druk
    ? pokazKartke
      ? `#/projekt/${idProjektuUrl}/kartka/${encodeURIComponent(pokazKartke)}`
      : `#/projekt/${idProjektuUrl}`
    : bezGry && szablonPowrotu
      ? `#/projekt/${idProjektuUrl}/szablon/${encodeURIComponent(szablonPowrotu)}`
      : idPakietu && idPakietu !== PAKIET_WLASNY
        ? `#/gra/${encodeURIComponent(idPakietu)}`
        : '#/wlasne';
  const adresDruku = pokazKartke
    ? `#/projekt/${idProjektuUrl}/drukuj/${encodeURIComponent(pokazKartke)}`
    : `#/projekt/${idProjektuUrl}/drukuj`;

  const sprawdzWyjscie = (e: React.MouseEvent, cel: string) => {
    if (!edycja.niezapisane) return;
    if (cel.startsWith(`#/projekt/${idProjektuUrl}`)) return;
    e.preventDefault();
    ustawCelWyjscia(cel);
  };

  const naglowekProjektu = (
    <header className="pasek-gorny" role="banner">
      <a href="#/" className="logo" onClick={(e) => sprawdzWyjscie(e, '#/')}>
        {t('aplikacja.nazwa')}
      </a>
      <input
        className="nazwa-projektu"
        title={projekt.nazwa}
        aria-label={t('kartka.nazwaProjektu')}
        value={projekt.nazwa}
        onChange={(e) =>
          zmien((p) => ({ ...p, nazwa: e.target.value, zmieniono: new Date().toISOString() }), {
            klucz: 'nazwa',
          })
        }
      />
      <button
        type="button"
        className={edycja.niezapisane ? 'glowny przycisk-zapisz' : 'przycisk-zapisz'}
        disabled={!edycja.niezapisane || edycja.zapis.stan === 'zapisywanie'}
        title={t('projekt.zapiszPodpowiedz')}
        onClick={() => void edycja.zapiszTeraz().catch(() => undefined)}
      >
        {t('projekt.zapisz')}
      </button>
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
      <a className="przycisk" href={adresPowrotu} onClick={(e) => sprawdzWyjscie(e, adresPowrotu)}>
        {t('pasek.powrot')}
      </a>
      {druk ? (
        <>
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
          <MenuPobierz
            wylaczone={!zasoby || zajete}
            pobierz={(co) =>
              wTle(() => (co.rodzaj === 'pdf' ? pobierzPdf() : pobierzObrazy(co.rodzaj, co.format)))
            }
          />
          <span role="status" aria-live="polite" className="status-pdf">
            {statusPdf}
          </span>
        </>
      ) : (
        <a className="przycisk glowny" href={adresDruku}>
          {t('kartka.drukujKarty')}
        </a>
      )}
      <NarzedziaPaska />
    </header>
  );

  return (
    <div className="edytor-kartki">
      {naglowekProjektu}
      {celWyjscia && (
        <OknoModalne tytul={t('projekt.wyjscieTytul')} zamknij={() => ustawCelWyjscia(undefined)}>
          <p>{t('projekt.wyjscieOpis')}</p>
          <div className="okno-wyjscia-akcje">
            <button
              type="button"
              className="glowny"
              onClick={() => {
                const cel = celWyjscia;
                void edycja
                  .zapiszTeraz()
                  .then(() => {
                    ustawCelWyjscia(undefined);
                    window.location.hash = cel;
                  })
                  .catch(() => ustawCelWyjscia(undefined));
              }}
            >
              {t('projekt.zapiszIWyjdz')}
            </button>
            <button
              type="button"
              className="niebezpieczny"
              onClick={() => {
                const cel = celWyjscia;
                ustawCelWyjscia(undefined);
                window.location.hash = cel;
              }}
            >
              {t('projekt.wyjdzBezZapisu')}
            </button>
            <button type="button" autoFocus onClick={() => ustawCelWyjscia(undefined)}>
              {t('projekt.zostan')}
            </button>
          </div>
        </OknoModalne>
      )}
      {!druk && kartkaImportu && (
        <ImportDanych
          key={kartkaImportu.id}
          nazwaKartki={kartkaImportu.nazwa}
          szablony={szablonyDoImportu(kartkaImportu)}
          rewersDlaSzablonu={(s) => {
            const rewersy = new Map((projekt.rewersy ?? []).map((r) => [r.id, r]));
            const talia = projekt.talie.find((x) => x.id === kartkaImportu.taliaId);
            return rewersKarty(rewersy, {}, s, talia ?? {});
          }}
          zasoby={projekt.zasoby}
          zamknij={() => ustawImportTabeli(undefined)}
          zapisz={(szablonId, wiersze) => {
            const id = kartkaImportu.id;
            const ctx = kontekst(id);
            if (!ctx || !szablonyDoImportu(kartkaImportu).some((s) => s.id === szablonId))
              return false;
            const proba = dodajKartyZImportu(projekt, id, szablonId, wiersze, ctx);
            if ('blad' in proba) return false;
            if (
              !zmienUklad((p) => {
                const wynik = dodajKartyZImportu(p, id, szablonId, wiersze, ctx);
                return 'projekt' in wynik ? wynik.projekt : p;
              })
            )
              return false;
            ustawToast({
              tekst: t('tabelaImport.zaimportowano', { liczba: wiersze.length }),
              cofnij: true,
            });
            return true;
          }}
        />
      )}
      <h1 className="tylko-czytnik">{projekt.nazwa || t('kartka.nazwaProjektu')}</h1>
      {(edycja.ostrzezenia.length > 0 ||
        brakujaceCzcionki.length > 0 ||
        brakujaceWarianty.length > 0 ||
        ostrzezeniaKartek.length > 0) && (
        <details className="uwaga ostrzezenia-projektu">
          <summary>
            {t('projekt.ostrzezenia', {
              liczba:
                edycja.ostrzezenia.length +
                ostrzezeniaKartek.length +
                brakujaceWarianty.length +
                (brakujaceCzcionki.length ? 1 : 0),
            })}
          </summary>
          <ul>
            {[...edycja.ostrzezenia, ...ostrzezeniaKartek, ...brakujaceWarianty].map((o, i) => (
              <li key={i}>{o}</li>
            ))}
            {brakujaceCzcionki.length > 0 && (
              <li>
                {t('czcionki.brakujace', {
                  lista: brakujaceCzcionki.map((r) => tJesliJest(`rola.${r}`) ?? r).join(', '),
                })}
              </li>
            )}
          </ul>
        </details>
      )}
      <div className="uklad-edytora">
        <div className="kartki" ref={kartkiRef}>
          {!zasoby && <p>{t('arkusze.wczytywanie')}</p>}
          {zasoby && projekt.arkusze.length === 0 && (
            <p className="uwaga">
              {t('kartka.brakKartek')}{' '}
              {nowaKartka && (
                <button type="button" onClick={nowaKartka}>
                  {t('kartka.nowaKartka')}
                </button>
              )}
            </p>
          )}
          {aktualneKartki.map((k) => (
            <WidokKartki
              key={k.arkusz.id}
              podgladDruku={druk}
              tylkoRewers={czyProjektRewersowy(projekt)}
              onWybierzKartke={
                druk && aktualneKartki.length > 1
                  ? () => {
                      ustawWybranyArkuszDruku(k.arkusz.id);
                      ustawBladUkladu(undefined);
                    }
                  : undefined
              }
              szablony={zasoby?.szablony}
              importujDane={
                !druk && k.wynik && szablonyDoImportu(k.arkusz).length
                  ? () => ustawImportTabeli(k.arkusz.id)
                  : undefined
              }
              k={k}
              wiele={aktualneKartki.length > 1}
              karty={kartyNaKartkach.get(k.arkusz.id) ?? []}
              liczbaStron={
                czyMieszane(k.arkusz) || k.arkusz.ustawienia.drukarnia?.wlaczony
                  ? (k.wynik?.strony.length ?? 1)
                  : Math.max(liczbaStronKartki(projekt, k.arkusz.id), k.svg.length)
              }
              zazn={aktywne}
              gest={gest}
              menu={menu?.arkuszId === k.arkusz.id ? menu : undefined}
              typy={typyDlaKartki(k.arkusz)}
              uwaga={(typ) => {
                // Mieszane: typ, który nie zmieści się w klikniętym wolnym miejscu (nadal klikalny).
                const w = menu?.arkuszId === k.arkusz.id && k.wynik?.mieszane?.wolne[menu.kolumna];
                const s = zasoby?.szablony.get(typ.warianty[0]!.szablonId);
                if (!w || !s || !czyMieszane(k.arkusz)) return undefined;
                const r = wymiaryKarty(s);
                return r.szer > w.szer + 1e-6 || r.wys > w.wys + 1e-6
                  ? t('mieszane.nieZmiesciSieTu')
                  : undefined;
              }}
              przesun={(kierunek) => przesunZaznaczone({ strona: 0, kolumna: kierunek, rzad: 0 })}
              blokada={(typ) => {
                if (czyMieszane(k.arkusz)) return undefined;
                const ctx = kontekst(k.arkusz.id);
                const s = ctx?.szablony.get(typ.warianty[0]!.szablonId);
                // Własne karty: jedna kartka = jeden rozmiar karty.
                const slotK = k.wynik?.slot ?? k.arkusz.ustawienia.slot;
                if (
                  (bezGry || k.arkusz.wlasnySzablonId) &&
                  s &&
                  slotK &&
                  !pasujeDoSlotu(s, slotK, k.arkusz.ustawienia.dopasowanie)
                )
                  return t('kartka.innyRozmiar', { rozmiar: opisRozmiaruSzablonu(s) });
                const ok =
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
                  );
                return ok ? undefined : t('kartka.nieMiesci');
              }}
              dodaj={dodajZMenu}
              dodatkoweAwersy={awersyInne.map((a) => ({
                klucz: kluczAwersuZProjektu(a),
                etykieta: etykietaAwersuZProjektu(a),
              }))}
              dodajZInnegoProjektu={(klucz) => void dodajZInnegoProjektu(klucz)}
              rewersyLokalne={projekt.rewersy ?? []}
              rewersyGlobalne={rewersyGlobalne}
              wybierzRewersKarty={(kartaId, rid) => wybierzRewersKarty(k.talia.id, kartaId, rid)}
              wybierzRewersGlobalnyKarty={(kartaId, wpis) =>
                wybierzRewersGlobalnyKarty(k.talia.id, kartaId, wpis)
              }
              zamknijMenu={zamknijMenu}
              poczatekGestu={poczatekGestu}
              duplikuj={() => duplikuj(1)}
              usun={usunZaznaczone}
              rozmiar={aktywne?.arkuszId === k.arkusz.id ? nastepnyRozmiar : undefined}
              dodajStrone={() => zmien((p) => dodajStrone(p, k.arkusz.id))}
              otworzMenu={(p) => {
                ustawZazn(undefined);
                ustawMenu({ arkuszId: k.arkusz.id, ...p });
              }}
              wybierzNaglowek={(id) => {
                ustawMenu(undefined);
                ustawZazn({ rodzaj: 'naglowek', arkuszId: k.arkusz.id, id });
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
      {toastAktualny && (
        <div className="toast" role="status">
          <span>{toastAktualny.tekst}</span>
          {toastAktualny.cofnij && (
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
  podgladDruku = false,
  tylkoRewers = false,
  onWybierzKartke,
  szablony,
  importujDane,
  k,
  wiele,
  karty,
  liczbaStron,
  zazn,
  gest,
  menu,
  typy,
  dodatkoweAwersy,
  dodajZInnegoProjektu,
  rewersyLokalne,
  rewersyGlobalne,
  wybierzRewersKarty,
  wybierzRewersGlobalnyKarty,
  blokada,
  uwaga,
  przesun,
  dodaj,
  zamknijMenu,
  poczatekGestu,
  duplikuj,
  usun,
  rozmiar,
  dodajStrone,
  usunStrone,
  otworzMenu,
  wybierzKarte,
  wybierzNaglowek,
}: {
  podgladDruku?: boolean;
  tylkoRewers?: boolean;
  onWybierzKartke?: () => void;
  szablony: ReadonlyMap<string, Szablon> | undefined;
  importujDane: (() => void) | undefined;
  otworzMenu: (p: Polozenie) => void;
  wybierzNaglowek: (id: string) => void;
  wybierzKarte: (id: string, shift: boolean) => void;
  k: Kartka;
  wiele: boolean;
  karty: KartaNaKartce[];
  liczbaStron: number;
  zazn: Zaznaczenie;
  gest: Gest | undefined;
  menu: Polozenie | undefined;
  typy: TypKarty[];
  dodatkoweAwersy: { klucz: string; etykieta: string }[];
  dodajZInnegoProjektu: (klucz: string) => void;
  rewersyLokalne: readonly Rewers[];
  rewersyGlobalne: readonly ZapisanyRewersGlobalny[];
  wybierzRewersKarty: (kartaId: string, rewersId: PrzypisanieRewersu | undefined) => void;
  wybierzRewersGlobalnyKarty: (kartaId: string, wpis: ZapisanyRewersGlobalny) => void;
  /** Powód, dla którego typu nie można dodać w tym slocie (undefined – można). */
  blokada: (typ: TypKarty) => string | undefined;
  /** Ostrzeżenie przy typie, który nadal można dodać (mieszane: nie zmieści się w tym miejscu). */
  uwaga: (typ: TypKarty) => string | undefined;
  /** Mieszane: przesunięcie zaznaczonych kart o jedno miejsce w kolejności. */
  przesun: (kierunek: -1 | 1) => void;
  dodaj: (typ: TypKarty, wariant: number) => void;
  zamknijMenu: () => void;
  poczatekGestu: (e: React.PointerEvent, k: Kartka, strona: number) => void;
  duplikuj: () => void;
  usun: () => void;
  /** Następny mieszczący się rozmiar zaznaczonej karty (gdy typ ma kilka rozmiarów). */
  rozmiar?: { etykieta: string; zmien: () => void };
  dodajStrone: () => void;
  usunStrone: (s: number) => void;
}) {
  const g = k.geometria;
  const id = k.arkusz.id;
  const mieszane = k.wynik?.mieszane;
  const zaznaczone =
    zazn?.rodzaj === 'karty' && zazn.arkuszId === id ? new Set(zazn.ids) : new Set<string>();
  const gestTu = gest && gest.arkuszId === id ? gest : undefined;
  const [kursor, ustawKursor] = useState<Record<number, string>>({});
  const [menuRewersu, ustawMenuRewersu] = useState<{
    strona: number;
    kartaId: string;
    maNadpisanie: boolean;
    styl: React.CSSProperties;
  }>();
  useEffect(() => {
    if (!menuRewersu) return;
    const zamknij = () => ustawMenuRewersu(undefined);
    window.addEventListener('pointerdown', zamknij);
    return () => window.removeEventListener('pointerdown', zamknij);
  }, [menuRewersu]);
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
    <section
      className="kartka"
      data-kartka={k.arkusz.id}
      aria-label={k.arkusz.nazwa}
      onClick={onWybierzKartke}
    >
      {wiele && <h2 className="tytul-kartki">{k.arkusz.nazwa}</h2>}
      {Array.from({ length: Math.max(liczbaStron, k.svg.length) }, (_, s) => {
        const naStronie = karty.filter((x) => x.strona === s);
        const kontynuacje =
          k.wynik?.rozmieszczenie.karty.filter((x) => x.strona === s && x.czesc) ?? [];
        const zajete = new Set<string>();
        for (const c of [...naStronie, ...kontynuacje])
          for (let i = 0; i < c.kolumny; i++)
            for (let j = 0; j < c.rzedy; j++) zajete.add(`${c.kolumna + i},${c.rzad + j}`);
        const pusta = !mieszane && naStronie.length === 0 && kontynuacje.length === 0;
        const kartyMieszane = mieszane?.karty.filter((c) => c.strona === s) ?? [];
        const polePol = mieszane ? mieszane.obszar.szer * mieszane.obszar.wys : 0;
        const zajetePole = kartyMieszane.reduce((suma, c) => suma + c.szer * c.wys, 0);
        // Jeden przystanek Tab na stronę (pierwszy wolny slot albo ostatnio odwiedzony),
        // pozostałe sloty osiągalne strzałkami.
        let przystanek = kursor[s];
        if (!przystanek || zajete.has(przystanek)) {
          przystanek = undefined;
          for (let r = 0; r < (g?.siatka.rzedy ?? 0) && !przystanek; r++)
            for (let c = 0; c < (g?.siatka.kolumny ?? 0) && !przystanek; c++)
              if (!zajete.has(`${c},${r}`)) przystanek = `${c},${r}`;
        }
        const ruchSlotu = (e: React.KeyboardEvent, c: number, r: number) => {
          const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
            e.key
          ];
          if (!d || !g) return;
          e.preventDefault();
          for (let x = c + d[0]!, y = r + d[1]!; ; x += d[0]!, y += d[1]!) {
            if (x < 0 || y < 0 || x >= g.siatka.kolumny || y >= g.siatka.rzedy) return;
            if (zajete.has(`${x},${y}`)) continue;
            ustawKursor((k) => ({ ...k, [s]: `${x},${y}` }));
            (
              e.currentTarget.parentElement?.querySelector(
                `[data-slot="${x},${y}"]`,
              ) as HTMLElement | null
            )?.focus();
            return;
          }
        };
        const maRewersy = !!k.svgRewersow;
        const drukarniaAktywna = !!k.arkusz.ustawienia.drukarnia?.wlaczony;
        const scenaStrony = k.wynik?.strony[s];
        const szerStrony = scenaStrony?.szer ?? g?.szer;
        const wysStrony = scenaStrony?.wys ?? g?.wys;
        const wymiaryStronyCss =
          szerStrony && wysStrony ? { aspectRatio: `${szerStrony} / ${wysStrony}` } : undefined;
        const pozycjeDrukarni = drukarniaAktywna
          ? (k.wynik?.pozycjeKart.filter((p) => p.strona === s) ?? [])
          : [];
        const stronaPrzodu = (
          <div className="strona-kartki" data-arkusz={id} data-strona={s} style={wymiaryStronyCss}>
            <div className="svg-opakowanie" dangerouslySetInnerHTML={{ __html: k.svg[s] ?? '' }} />
            {g && !drukarniaAktywna && (k.arkusz.ustawienia.marginesBezpieczenstwa ?? 0) > 0 && (
              // Strefa przycięcia (np. punkt foto) – tylko w edytorze, nie w druku.
              <div className="strefa-bezpieczenstwa" aria-hidden="true">
                <div
                  style={stylMm(
                    g,
                    k.arkusz.ustawienia.marginesBezpieczenstwa!,
                    k.arkusz.ustawienia.marginesBezpieczenstwa!,
                    Math.max(0, g.szer - 2 * k.arkusz.ustawienia.marginesBezpieczenstwa!),
                    Math.max(0, g.wys - 2 * k.arkusz.ustawienia.marginesBezpieczenstwa!),
                  )}
                />
              </div>
            )}
            {!podgladDruku && drukarniaAktywna && szerStrony && wysStrony && (
              <div className="warstwa">
                {pozycjeDrukarni.map((p) => {
                  const nazwa =
                    nazwaKarty(p.karta.dane, szablony?.get(p.karta.szablonId)) ||
                    t('karta.bezNazwy');
                  return (
                    <button
                      key={`${p.karta.id}#${p.numer}`}
                      type="button"
                      className={`karta-na-kartce${zaznaczone.has(p.karta.id) ? ' zaznaczona' : ''}`}
                      data-karta={p.karta.id}
                      style={{
                        left: `${(p.x / szerStrony) * 100}%`,
                        top: `${(p.y / wysStrony) * 100}%`,
                        width: `${(p.szer / szerStrony) * 100}%`,
                        height: `${(p.wys / wysStrony) * 100}%`,
                      }}
                      aria-pressed={zaznaczone.has(p.karta.id)}
                      onClick={(e) => wybierzKarte(p.karta.id, e.shiftKey)}
                      aria-label={t('mieszane.kartaEtykieta', {
                        nazwa: p.czesc
                          ? `${nazwa} – ${t('kartka.ciagDalszy')} ${p.czesc + 1}`
                          : nazwa,
                        strona: s + 1,
                        szer: Math.round(p.szer),
                        wys: Math.round(p.wys),
                      })}
                    />
                  );
                })}
              </div>
            )}
            {!podgladDruku && g && !drukarniaAktywna && mieszane && (
              <div className="warstwa" onPointerDown={(e) => poczatekGestu(e, k, s)}>
                {mieszane.wolne.map((w, i) =>
                  w.strona !== s ? null : (
                    <button
                      key={`wolne-${i}`}
                      type="button"
                      className={`wolne-miejsce${menu && menu.strona === s && menu.kolumna === i ? ' aktywny' : ''}`}
                      data-wolne={i}
                      style={stylMm(g, w.x, w.y, w.szer, w.wys)}
                      aria-label={t('mieszane.wolneEtykieta', {
                        szer: Math.round(w.szer),
                        wys: Math.round(w.wys),
                        strona: s + 1,
                      })}
                      onClick={() => otworzMenu({ strona: s, kolumna: i, rzad: 0 })}
                    >
                      {t('mieszane.wolne', { szer: Math.round(w.szer), wys: Math.round(w.wys) })}
                    </button>
                  ),
                )}
                {kartyMieszane.map((c) => {
                  const podnoszona =
                    gestTu?.rodzaj === 'kolejnosc' && gestTu.ruch && gestTu.ids.includes(c.kartaId);
                  const nazwa =
                    nazwaKarty(c.karta.dane, szablony?.get(c.karta.szablonId)) ||
                    t('karta.bezNazwy');
                  return (
                    <button
                      key={c.klucz}
                      type="button"
                      className={`karta-na-kartce${zaznaczone.has(c.kartaId) ? ' zaznaczona' : ''}${podnoszona ? ' podnoszona' : ''}`}
                      data-karta={c.kartaId}
                      style={stylMm(g, c.x, c.y, c.szer, c.wys)}
                      aria-pressed={zaznaczone.has(c.kartaId)}
                      onClick={(e) => e.detail === 0 && wybierzKarte(c.kartaId, e.shiftKey)}
                      aria-label={t('mieszane.kartaEtykieta', {
                        nazwa: c.czesc
                          ? `${nazwa} – ${t('kartka.ciagDalszy')} ${c.czesc + 1}`
                          : nazwa,
                        strona: s + 1,
                        szer: Math.round(c.szer),
                        wys: Math.round(c.wys),
                      })}
                    />
                  );
                })}
                {gestTu?.rodzaj === 'kolejnosc' &&
                  gestTu.ruch &&
                  gestTu.cel &&
                  gestTu.cel.strona === s && (
                    <div
                      className="wskaznik-wstawienia"
                      data-testid="wskaznik-wstawienia"
                      style={stylMm(g, gestTu.cel.x - 0.75, gestTu.cel.y, 1.5, gestTu.cel.wys)}
                    />
                  )}
                {!gestTu &&
                  (() => {
                    const c = kartyMieszane.find((x) => zaznaczone.has(x.kartaId));
                    if (!c) return null;
                    const p = stylMm(g, c.x, c.y, c.szer, c.wys);
                    return (
                      <div
                        className="pasek-karty"
                        style={{ left: p.left, top: p.top, width: 'auto', height: 'auto' }}
                      >
                        <button type="button" onClick={() => przesun(-1)}>
                          ◀ {t('mieszane.wczesniej')}
                        </button>
                        <button type="button" onClick={() => przesun(1)}>
                          {t('mieszane.pozniej')} ▶
                        </button>
                        <button type="button" onClick={duplikuj}>
                          {t('kartka.duplikuj')}
                        </button>
                        <button type="button" className="niebezpieczny" onClick={usun}>
                          {t('kartka.usun')}
                        </button>
                      </div>
                    );
                  })()}
                {menu &&
                  menu.strona === s &&
                  (() => {
                    const w = mieszane.wolne[menu.kolumna];
                    if (!w) return null;
                    const poPrawej = w.x + w.szer < g.szer * 0.6;
                    const p = stylMm(g, w.x, w.y, w.szer, w.wys);
                    return (
                      <MenuTypu
                        typy={typy}
                        dodatkowe={dodatkoweAwersy}
                        dodatkoweNaglowek={t('kartka.awersyInneProjekty')}
                        wybierzDodatkowe={dodajZInnegoProjektu}
                        tytul={t('mieszane.dodajTutaj', {
                          szer: Math.round(w.szer),
                          wys: Math.round(w.wys),
                        })}
                        stopka={t('mieszane.menuOpis')}
                        styl={
                          poPrawej
                            ? { left: `${((w.x + w.szer) / g.szer) * 100}%`, top: p.top }
                            : { right: `${100 - (w.x / g.szer) * 100}%`, top: p.top }
                        }
                        blokada={blokada}
                        uwaga={uwaga}
                        wybierz={dodaj}
                        zamknij={zamknijMenu}
                      />
                    );
                  })()}
              </div>
            )}
            {!podgladDruku && g && !drukarniaAktywna && !mieszane && (
              <div className="warstwa" onPointerDown={(e) => poczatekGestu(e, k, s)}>
                {Array.from({ length: g.siatka.rzedy }, (_, r) =>
                  Array.from({ length: g.siatka.kolumny }, (_, c) =>
                    zajete.has(`${c},${r}`) ? null : (
                      <button
                        key={`${c},${r}`}
                        type="button"
                        className={`slot${menu && menu.strona === s && menu.kolumna === c && menu.rzad === r ? ' aktywny' : ''}`}
                        data-slot={`${c},${r}`}
                        tabIndex={przystanek === `${c},${r}` ? 0 : -1}
                        onKeyDown={(e) => ruchSlotu(e, c, r)}
                        onFocus={() =>
                          kursor[s] !== `${c},${r}` &&
                          ustawKursor((k) => ({ ...k, [s]: `${c},${r}` }))
                        }
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
                        aria-pressed={
                          zazn?.rodzaj === 'naglowek' && zazn.arkuszId === id && zazn.id === h.id
                        }
                        onClick={(e) => e.detail === 0 && wybierzNaglowek(h.id)}
                        style={stylMm(g, h.x, h.y, h.szer, h.wys)}
                        aria-label={t('kartka.naglowekEtykieta', { tekst: n?.naglowek ?? '' })}
                      />
                    );
                  })}
                {kontynuacje.map((c) => (
                  <button
                    key={`ciag-${c.karta.id}#${c.numer}`}
                    type="button"
                    className={`karta-na-kartce${zaznaczone.has(c.karta.id) ? ' zaznaczona' : ''}`}
                    data-kontynuacja={c.karta.id}
                    style={stylProstokata(g, s, c.kolumna, c.rzad, c.kolumny, c.rzedy)}
                    aria-pressed={zaznaczone.has(c.karta.id)}
                    aria-label={`${nazwaKarty(c.karta.dane, szablony?.get(c.karta.szablonId)) || t('karta.bezNazwy')} – ${t('kartka.ciagDalszy')} ${(c.czesc ?? 0) + 1}`}
                    onClick={(e) => wybierzKarte(c.karta.id, e.shiftKey)}
                  />
                ))}
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
                        nazwa:
                          nazwaKarty(c.karta.dane, szablony?.get(c.karta.szablonId)) ||
                          t('karta.bezNazwy'),
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
                    {rozmiar && (
                      <button type="button" onClick={rozmiar.zmien}>
                        {rozmiar.etykieta}
                      </button>
                    )}
                    <button type="button" className="niebezpieczny" onClick={usun}>
                      {t('kartka.usun')}
                    </button>
                  </div>
                )}
                {menu && menu.strona === s && (
                  <MenuTypu
                    typy={typy}
                    dodatkowe={dodatkoweAwersy}
                    dodatkoweNaglowek={t('kartka.awersyInneProjekty')}
                    wybierzDodatkowe={dodajZInnegoProjektu}
                    styl={(() => {
                      const p = stylProstokata(g, s, menu.kolumna + 1, menu.rzad);
                      return menu.kolumna > g.siatka.kolumny - 4
                        ? {
                            right: `${100 - parseFloat(stylProstokata(g, s, menu.kolumna, menu.rzad).left)}%`,
                            top: p.top,
                          }
                        : { left: p.left, top: p.top };
                    })()}
                    blokada={blokada}
                    wybierz={dodaj}
                    zamknij={zamknijMenu}
                  />
                )}
              </div>
            )}
          </div>
        );
        const warstwaRewersu = (() => {
          if (podgladDruku || drukarniaAktywna || !szerStrony || !wysStrony) return null;
          const krawedz = k.arkusz.ustawienia.dwustronny?.krawedz ?? 'dluga';
          const stronaWym = { szer: szerStrony, wys: wysStrony };
          const os = osOdwracania(stronaWym, krawedz);
          const rewersyMapa = new Map(rewersyLokalne.map((r) => [r.id, r]));
          const pozycjeStrony = (k.wynik?.pozycjeKart ?? []).filter((p) => p.strona === s);
          return (
            <div className="warstwa-rewersu">
              {pozycjeStrony.map((p, idx) => {
                const ob = odbijProstokat(p, stronaWym, os);
                const sz = szablony?.get(p.karta.szablonId);
                const maRewers = sz ? !!rewersKarty(rewersyMapa, p.karta, sz, k.talia) : false;
                const leftPct = (ob.x / szerStrony) * 100;
                const topPct = (ob.y / wysStrony) * 100;
                const widthPct = (ob.szer / szerStrony) * 100;
                const heightPct = (ob.wys / wysStrony) * 100;
                return (
                  <button
                    key={`${p.karta.id}-${idx}`}
                    type="button"
                    className={maRewers ? 'slot-rewersu' : 'slot-rewersu pusty'}
                    data-karta-rewers={p.karta.id}
                    aria-label={
                      maRewers ? t('kartka.wybierzRewersKarty') : t('kartka.dodajRewersKarty')
                    }
                    title={maRewers ? t('kartka.wybierzRewersKarty') : t('kartka.dodajRewersKarty')}
                    style={{
                      left: `${leftPct}%`,
                      top: `${topPct}%`,
                      width: `${widthPct}%`,
                      height: `${heightPct}%`,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const poPrawej = leftPct + widthPct < 60;
                      ustawMenuRewersu({
                        strona: s,
                        kartaId: p.karta.id,
                        maNadpisanie: p.karta.rewersId !== undefined,
                        styl: poPrawej
                          ? {
                              position: 'absolute',
                              left: `${leftPct + widthPct}%`,
                              top: `${topPct}%`,
                            }
                          : { position: 'absolute', right: `${100 - leftPct}%`, top: `${topPct}%` },
                      });
                    }}
                  />
                );
              })}
              {menuRewersu && menuRewersu.strona === s && (
                <MenuRewersu
                  key={menuRewersu.kartaId}
                  rewersyLokalne={rewersyLokalne}
                  rewersyGlobalne={rewersyGlobalne}
                  maNadpisanie={menuRewersu.maNadpisanie}
                  styl={menuRewersu.styl}
                  wybierzLokalny={(rid) => {
                    wybierzRewersKarty(menuRewersu.kartaId, rid);
                    ustawMenuRewersu(undefined);
                  }}
                  wybierzGlobalny={(wpis) => {
                    wybierzRewersGlobalnyKarty(menuRewersu.kartaId, wpis);
                    ustawMenuRewersu(undefined);
                  }}
                  zamknij={() => ustawMenuRewersu(undefined)}
                />
              )}
            </div>
          );
        })();
        return (
          <div key={s} className="strona-opakowanie">
            <div className="etykieta-strony">
              {mieszane && !drukarniaAktywna
                ? tn('mieszane.zajete', kartyMieszane.length, {
                    numer: s + 1,
                    liczba: liczbaStron,
                    procent: polePol > 0 ? Math.round((zajetePole / polePol) * 100) : 0,
                  })
                : t('kartka.strona', { numer: s + 1, liczba: liczbaStron })}
              {!podgladDruku && !drukarniaAktywna && pusta && liczbaStron > 1 && (
                <button type="button" className="usun-strone" onClick={() => usunStrone(s)}>
                  {t('kartka.usunStrone')}
                </button>
              )}
            </div>
            {tylkoRewers && maRewersy ? (
              <div
                className="strona-kartki strona-rewersu"
                data-arkusz={id}
                data-strona-rewersu={s}
                role={podgladDruku ? 'img' : 'region'}
                aria-label={t('dwustronny.podgladTylu', { numer: s + 1, liczba: liczbaStron })}
                style={wymiaryStronyCss}
              >
                <div
                  className="svg-opakowanie"
                  dangerouslySetInnerHTML={{ __html: k.svgRewersow?.[s] ?? '' }}
                />
                {warstwaRewersu}
              </div>
            ) : maRewersy ? (
              <div className="para-stron">
                <div className="strona-pary">
                  <div className="etykieta-pary">{t('dwustronny.przod')}</div>
                  {stronaPrzodu}
                </div>
                <div className="strona-pary">
                  <div className="etykieta-pary">
                    {k.pusteRewersy?.[s] ? t('dwustronny.tylPusty') : t('dwustronny.tyl')}
                  </div>
                  <div
                    className="strona-kartki strona-rewersu"
                    data-arkusz={id}
                    data-strona-rewersu={s}
                    role={podgladDruku ? 'img' : 'region'}
                    aria-label={t('dwustronny.podgladTylu', { numer: s + 1, liczba: liczbaStron })}
                    style={wymiaryStronyCss}
                  >
                    <div
                      className="svg-opakowanie"
                      dangerouslySetInnerHTML={{ __html: k.svgRewersow?.[s] ?? '' }}
                    />
                    {warstwaRewersu}
                  </div>
                </div>
              </div>
            ) : (
              stronaPrzodu
            )}
          </div>
        );
      })}
      {!podgladDruku && !mieszane && !k.arkusz.ustawienia.drukarnia?.wlaczony && (
        <button type="button" className="dodaj-strone" onClick={dodajStrone}>
          ＋ {t('kartka.dodajStrone')}
        </button>
      )}
      {importujDane && (
        <button
          type="button"
          className="dodaj-strone"
          onClick={(e) => {
            e.currentTarget.focus({ preventScroll: true });
            importujDane();
          }}
        >
          {t('tabelaImport.akcja')}
        </button>
      )}
    </section>
  );
}
