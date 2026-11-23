import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { roleProjektu } from '../../dane/edycja';
import {
  doPoprzedniegoKontenera,
  dostosujDoSwobodnego,
  duplikujWezel,
  nowyWezel,
  opakuj,
  przesunWezel,
  rodzicWezla,
  skopiujStyl,
  ukladZWezlow,
  usunWezly,
  wklejStyl,
  wstawWezel,
  wyzej,
  zmienKolejnoscRysowania,
  zmienTypKontenera,
  zmienTypPola,
  zmienWezel,
  znajdzWezel,
  type RodzajNowego,
  type SkopiowanyStyl,
} from '../../dane/szablon';
import { t, tJesliJest } from '../../i18n';
import { zaokraglij } from '../../model/geometria';
import type { DaneZasobow, Projekt } from '../../model/projekt';
import {
  czyKontener,
  rozwinOdstepy,
  wszystkieWezly,
  wymiaryKarty,
  type Kontener,
  type PodkladSzablonu,
  type Pole,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import type { KontekstRenderowania, WyrenderowanaKarta } from '../../silnik/karta';
import type { Scena } from '../../silnik/scena';
import { scenaDoSvg } from '../../silnik/svg';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { NarzedziaPaska } from '../NaglowekAplikacji';
import { tekstOstrzezenia } from '../ostrzezenia';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import { useCzcionkiGlobalne, useSynchronizujCzcionkiGlobalne } from '../zasobyGlobalne';
import { DrzewoSzablonu, nazwaWezla } from './DrzewoSzablonu';
import { ElementyWlasneKontekst } from './elementyWlasne';
import { Liczba, Sekcja } from './Kontrolki';
import { NakladkaSwobodna } from './NakladkaSwobodna';
import { PanelWezla } from './PanelWezla';
import { PanelWyrownania } from './PanelWyrownania';
import { PozycjeMenuDodaj, RODZAJE } from './PozycjeMenuDodaj';
import {
  budujCele,
  celSkalowania,
  SIATKA_DOMYSLNA,
  skalujZaznaczenie,
  zastosujZmiany,
  type Cel,
  type ZmianaPola,
} from './swobodnyMysz';
import { upuscWezel } from './upuszczanie';
import { useGestSwobodny } from './useGestSwobodny';

/*
 * Wspólny edytor drzewa elementów karty – awersu (Edytor szablonu) i rewersu (Edytor rewersu):
 * pasek górny, drzewo z menu „+ Dodaj”, skróty klawiszowe, podgląd z zaznaczaniem
 * i przeciąganiem myszą, właściwości zaznaczenia. Różnice między edytorami przychodzą
 * w parametrach (`UstawieniaEdytoraDrzewa`) – zmiany zachowania edytora robi się tutaj.
 */

export type ZmianaSzablonu = (f: (s: Szablon) => Szablon, klucz?: string) => void;
type ZasobyEdycji = ProjektWEdycji['zasoby']['zasoby'];
type Wymiary = WyrenderowanaKarta['wezly'][number];

/** Rysunek podglądu z klucza (JSON tego, co widać na karcie). Funkcja stała – poza komponentem. */
export type RysujPodglad = (klucz: string, ctx: KontekstRenderowania) => WyrenderowanaKarta;

/** Dane dla panelu „nic nie zaznaczono” (ustawienia całej karty), różnego w obu edytorach. */
export interface KontekstPaneluKarty {
  szablon: Szablon;
  zmienSz: ZmianaSzablonu;
  czcionki: { wartosc: string; tekst: string }[];
  obrazy: { wartosc: string; tekst: string }[];
  wymiary: (id: string) => Wymiary | undefined;
  /** Układ z podglądu do konwersji kontenerów (swobodny ↔ kolumna / wiersz). */
  uklad: ReturnType<typeof ukladZWezlow> | undefined;
}

/** Podkład ze wzoru pod podglądem (tylko awers). */
export interface PodkladEdytora {
  podklad: PodkladSzablonu | undefined;
  adres: string | undefined;
  blad: string;
  wczytaj: (f: File) => void;
  zmien: (f: (p: PodkladSzablonu) => PodkladSzablonu) => void;
  usun: () => void;
}

export interface UstawieniaEdytoraDrzewa {
  edycja: ProjektWEdycji;
  /** Id edytowanego szablonu lub rewersu (miniatura, efekty przy zmianie). */
  id: string;
  /** Edytowane drzewo (rewers – w postaci szablonu); brak – ekran „nie znaleziono”. */
  szablon: Szablon | undefined;
  zmienSz: ZmianaSzablonu;
  /** Czcionki użyte w edytowanym szablonie (synchronizacja z biblioteką przeglądarki). */
  czcionkiUzyte: readonly string[];
  /** Klucz rysunku dla widocznego szablonu (z gestem w toku); zmiana klucza = nowy rysunek. */
  kluczRysunku: (widoczny: Szablon) => string;
  rysuj: RysujPodglad;
  /** Przedrostek identyfikatorów w SVG podglądu (unikalny na stronie). */
  przedrostekSvg: string;
  /** Rodzaj miniatury na liście „Moje projekty”. */
  miniatura: 'szablon' | 'rewers';
  /** Rewers: bez danych kart (bez kluczy, przykładów i pól z danymi). */
  bezDanych: boolean;
  /** Klucze zajęte poza szablonem (dane kart) – tylko awers. */
  zajeteKlucze?: () => Iterable<string>;
  rodzajeDodaj?: readonly RodzajNowego[];
  teksty: {
    brak: string;
    tytul: string;
    nazwa: string;
    drzewo: string;
    podglad: string;
    pomocPodgladu: string;
  };
  zmienNazwe: (nazwa: string) => void;
  duplikuj: () => void;
  /** Link do utworzonej kopii (komunikat pod paskiem). */
  kopia?: { adres: string; tekst: string } | undefined;
  adresPowrotu: string;
  /** Główna akcja paska („Zrób karty”). */
  akcjaGlowna: ReactNode;
  wgrajStalyObraz: (poleId: string, plik: File, sygnal: AbortSignal) => Promise<void>;
  podklad?: PodkladEdytora | undefined;
  panelKarty: (k: KontekstPaneluKarty) => ReactNode;
}

const wPolu = (e: Element | null) =>
  !!e &&
  (e.matches('input, textarea, select, [contenteditable="true"]') || !!e.closest('[role="menu"]'));

function usePodglad(
  kluczRysunku: string,
  rysuj: RysujPodglad,
  przedrostekId: string,
  zasoby: ZasobyEdycji,
) {
  return useMemo(() => {
    if (!kluczRysunku) return undefined;
    try {
      const w = rysuj(kluczRysunku, {
        czcionki: zasoby.czcionki,
        obraz: (id) => zasoby.obrazy.get(id)?.info,
        ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
      });
      return {
        ...w,
        svg: scenaDoSvg(w.scena, {
          adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
          przedrostekId,
        }),
      };
    } catch (e) {
      return { blad: e instanceof Error ? e.message : String(e) };
    }
  }, [kluczRysunku, rysuj, przedrostekId, zasoby.czcionki, zasoby.obrazy, zasoby.elementy]);
}

async function zapiszMiniature(
  rodzaj: 'szablon' | 'rewers',
  projekt: Projekt,
  dane: DaneZasobow,
  id: string,
  scena: Scena,
) {
  const m = await import('../miniaturaRewersu');
  if (rodzaj === 'szablon') await m.zapiszMiniatureSzablonu(projekt, dane, id, scena);
  else await m.zapiszMiniatureRewersu(projekt, dane, id, scena);
}

/**
 * Miniatura edytowanej karty na liście „Moje projekty”: sekundę po ostatniej zmianie podglądu
 * i przy opuszczeniu edytora (z ostatnim podglądem).
 */
function useMiniatura(
  rodzaj: 'szablon' | 'rewers',
  edycja: ProjektWEdycji,
  id: string,
  jest: boolean,
  scena: Scena | undefined,
) {
  const { projekt, dane } = edycja;
  const aktualny = useRef<{ projekt: Projekt; dane: DaneZasobow; scena: Scena } | undefined>(
    undefined,
  );
  useEffect(() => {
    aktualny.current = jest && scena ? { projekt, dane, scena } : undefined;
  }, [projekt, dane, jest, scena]);
  useEffect(() => {
    if (!scena || !jest) return;
    const z = setTimeout(() => {
      void zapiszMiniature(rodzaj, projekt, dane, id, scena).catch(() => undefined);
    }, 1000);
    return () => clearTimeout(z);
  }, [rodzaj, scena, projekt, dane, jest, id]);
  useEffect(
    () => () => {
      const stan = aktualny.current;
      if (!stan) return;
      void zapiszMiniature(rodzaj, stan.projekt, stan.dane, id, stan.scena).catch(() => undefined);
    },
    [rodzaj, id],
  );
}

/** Menu „+ Dodaj”: fokus na pierwszej pozycji, strzałki, Escape i Tab wracają na przycisk. */
function MenuDodaj({
  rodzaje,
  dodaj,
}: {
  rodzaje: readonly RodzajNowego[];
  dodaj: (r: RodzajNowego) => void;
}) {
  const [otwarte, ustawOtwarte] = useState(false);
  const przycisk = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!otwarte) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const poza = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && e.target !== przycisk.current)
        ustawOtwarte(false);
    };
    window.addEventListener('pointerdown', poza);
    return () => window.removeEventListener('pointerdown', poza);
  }, [otwarte]);
  const klawisz = (e: React.KeyboardEvent) => {
    const pozycje = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = pozycje.indexOf(document.activeElement as HTMLElement);
    const cel =
      e.key === 'ArrowDown'
        ? pozycje[(i + 1) % pozycje.length]
        : e.key === 'ArrowUp'
          ? pozycje[(i - 1 + pozycje.length) % pozycje.length]
          : e.key === 'Home'
            ? pozycje[0]
            : e.key === 'End'
              ? pozycje.at(-1)
              : undefined;
    if (cel) {
      e.preventDefault();
      cel.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      ustawOtwarte(false);
      przycisk.current?.focus();
    }
  };
  return (
    <div className="menu-dodaj">
      <button
        ref={przycisk}
        type="button"
        aria-haspopup="menu"
        aria-expanded={otwarte}
        onClick={() => ustawOtwarte((x) => !x)}
      >
        {t('szablon.dodaj')}
      </button>
      {otwarte && (
        <div
          ref={menu}
          className="menu-typu"
          role="menu"
          aria-label={t('szablon.dodaj')}
          onKeyDown={klawisz}
        >
          <PozycjeMenuDodaj
            rodzaje={rodzaje}
            dodaj={(r) => {
              dodaj(r);
              ustawOtwarte(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Skróty klawiszowe edytora: Delete, Ctrl+D, Ctrl+Z / Ctrl+Y, Escape; strzałki w podglądzie;
 * drzewo: strzałki, Home/End, Shift+strzałka (dokłada do zaznaczenia), ←/→ (rodzic / pierwsze
 * dziecko), Alt+↑/↓ (przesuń), Spacja/Enter (Ctrl – dokłada / zdejmuje z zaznaczenia).
 */
function useKlawiszeEdytora(obsluz: (e: KeyboardEvent) => void) {
  const klawisze = useRef(obsluz);
  useEffect(() => {
    klawisze.current = obsluz;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => klawisze.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
}

export function EdytorDrzewa(u: UstawieniaEdytoraDrzewa) {
  const { edycja, szablon, zmienSz, bezDanych, id } = u;
  const { projekt } = edycja;
  const { rodzinyGlobalne } = useCzcionkiGlobalne(projekt);
  useSynchronizujCzcionkiGlobalne(edycja, rodzinyGlobalne, u.czcionkiUzyte);
  const [zazn, ustawZazn] = useState<string[]>([]);
  const [schowek, ustawSchowek] = useState<SkopiowanyStyl>();
  const drzewo = useRef<HTMLDivElement>(null);
  const kartaRef = useRef<HTMLDivElement>(null);
  // Stan tymczasowy gestu myszy (zapis dopiero na pointerup – jeden krok „Cofnij”).
  const [tmp, ustawTmp] = useState<Map<string, ZmianaPola> | undefined>();
  const [przyciaganie, ustawPrzyciaganie] = useState({ siatka: SIATKA_DOMYSLNA, obiekty: true });
  const idProjektu = encodeURIComponent(projekt.id);

  // Zaznaczenie bez usuniętych węzłów (np. po „Cofnij”).
  const aktywne = szablon ? zazn.filter((x) => znajdzWezel(szablon, x)) : [];
  const jeden = szablon && aktywne.length === 1 ? znajdzWezel(szablon, aktywne[0]!) : undefined;

  const wybierz = (x: string, dodajDo: boolean) =>
    ustawZazn((z) => (dodajDo ? (z.includes(x) ? z.filter((y) => y !== x) : [...z, x]) : [x]));
  const fokusWDrzewie = (x: string) =>
    requestAnimationFrame(() =>
      drzewo.current?.querySelector<HTMLElement>(`[data-wezel="${CSS.escape(x)}"]`)?.focus(),
    );

  // Podgląd: silnik jak na kartce i w PDF. Zależy tylko od tego, co widać na karcie.
  const zasoby = edycja.zasoby.zasoby;
  const widoczny = szablon && tmp ? zastosujZmiany(szablon, tmp) : szablon;
  const kluczRysunku = widoczny ? u.kluczRysunku(widoczny) : '';
  const podglad = usePodglad(kluczRysunku, u.rysuj, u.przedrostekSvg, zasoby);
  const scenaPodgladu = podglad && 'scena' in podglad ? podglad.scena : undefined;
  useMiniatura(u.miniatura, edycja, id, !!szablon, scenaPodgladu);

  const wezlyPoId = useMemo(
    () => new Map(szablon ? wszystkieWezly(szablon).map((w) => [w.id, w] as const) : []),
    [szablon],
  );
  const wezlyKarty = podglad && 'wezly' in podglad ? podglad.wezly : undefined;
  // Układ do konwersji kontenerów (swobodny ↔ kolumna / wiersz): ramki z bieżącego podglądu.
  const uklad = useMemo(() => (wezlyKarty ? ukladZWezlow(wezlyKarty) : undefined), [wezlyKarty]);

  const gest = useGestSwobodny({
    szablon,
    wezly: wezlyKarty,
    zaznaczone: aktywne,
    ustawZazn,
    karta: kartaRef,
    szerMm: szablon ? wymiaryKarty(szablon).szer : 1,
    przyciaganie,
    ustawTmp,
    upusc: (cel) => zmienSz((s) => upuscWezel(s, cel)),
    zatwierdz: (zmiany, klucz) => zmienSz((s) => zastosujZmiany(s, zmiany), klucz),
  });

  // Operacje liczone w aktualizatorze (na najnowszym szablonie); nowe id przekazywane przez zmienną.
  const zajeteKlucze = (): Iterable<string> => (bezDanych ? [] : (u.zajeteKlucze?.() ?? []));
  const cel = jeden ?? szablon?.korzen;
  const dodaj = (r: RodzajNowego) => {
    if (!cel) return;
    let noweId = '';
    zmienSz((s) => {
      const c = znajdzWezel(s, cel.id) ?? s.korzen;
      const rodzic = czyKontener(c) ? c : rodzicWezla(s, c.id)?.rodzic;
      const w = nowyWezel(s, r, t(`wezel.${r}`), {
        wWierszu: rodzic?.typ === 'wiersz',
        ...(bezDanych ? { bezKlucza: true } : { zajete: zajeteKlucze() }),
      });
      // W kontenerze swobodnym element dostaje położenie i rozmiar w mm.
      const nowy = rodzic?.typ === 'swobodny' ? dostosujDoSwobodnego(w) : w;
      noweId = nowy.id;
      return wstawWezel(s, c.id, nowy);
    });
    if (noweId) ustawZazn([noweId]);
  };
  const usun = () => {
    if (!szablon) return;
    const ids = aktywne.filter((x) => x !== szablon.korzen.id);
    if (ids.length === 0) return;
    // Fokus po usunięciu: sąsiad albo rodzic pierwszego usuwanego.
    const r = rodzicWezla(szablon, ids[0]!);
    const nastepny =
      r?.rodzic.dzieci.find((d, i) => i > r.indeks && !ids.includes(d.id)) ??
      [...(r?.rodzic.dzieci ?? [])]
        .reverse()
        .find((d, i, arr) => arr.length - 1 - i < r!.indeks && !ids.includes(d.id)) ??
      r?.rodzic;
    zmienSz((s) => usunWezly(s, ids));
    ustawZazn(nastepny ? [nastepny.id] : []);
    if (nastepny) fokusWDrzewie(nastepny.id);
  };
  const duplikuj = () => {
    if (!szablon || !jeden || jeden.id === szablon.korzen.id) return;
    let noweId = '';
    zmienSz((s) => {
      const d = duplikujWezel(s, jeden.id, t('szablon.kopia'), zajeteKlucze());
      noweId = d.id;
      return d.szablon;
    });
    if (noweId) ustawZazn([noweId]);
  };
  const ruch = (f: (s: Szablon, x: string) => Szablon) => {
    if (!jeden) return;
    zmienSz((s) => f(s, jeden.id));
    fokusWDrzewie(jeden.id);
  };
  const opakujW = (typ: 'wiersz' | 'kolumna') => {
    if (aktywne.length === 0) return;
    let noweId = '';
    zmienSz((s) => {
      const o = opakuj(s, aktywne, typ, t(`wezel.${typ}`));
      noweId = o.id;
      return o.szablon;
    });
    if (noweId) ustawZazn([noweId]);
  };

  useKlawiszeEdytora((e) => {
    if (wPolu(document.activeElement)) return;
    // W trakcie gestu myszą działa tylko Escape (bez Cofnij, Delete, Ctrl+D i strzałek).
    if (gest.aktywny()) {
      if (e.key === 'Escape') gest.anuluj();
      if (!['Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) e.preventDefault();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const wDrzewie = !!drzewo.current?.contains(document.activeElement);
    if (ctrl && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) edycja.ponow();
      else edycja.cofnij();
    } else if (ctrl && k === 'y') {
      e.preventDefault();
      edycja.ponow();
    } else if (ctrl && k === 'd') {
      e.preventDefault();
      duplikuj();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      usun();
    } else if (e.key === 'Escape') {
      // Escape przerywa trwający gest; poza gestem zdejmuje zaznaczenie.
      if (!gest.anuluj()) ustawZazn([]);
    } else if (
      !e.altKey &&
      !ctrl &&
      kartaRef.current?.contains(document.activeElement) &&
      gest.strzalki(e)
    ) {
      // Strzałki w podglądzie przesuwają zaznaczone pola swobodne (0,5 mm, Shift – 5 mm).
      e.preventDefault();
    } else if (
      wDrzewie &&
      ['ArrowUp', 'ArrowDown', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(e.key)
    ) {
      e.preventDefault();
      const elementy = [...drzewo.current!.querySelectorAll<HTMLElement>('[data-wezel]')];
      const biezacy = document.activeElement as HTMLElement;
      const i = elementy.indexOf(biezacy);
      const idWezla = biezacy.dataset.wezel;
      if (e.altKey && jeden && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        ruch((s, x) => przesunWezel(s, x, e.key === 'ArrowUp' ? -1 : 1));
        return;
      }
      let nast: HTMLElement | undefined;
      if (e.key === 'ArrowUp') nast = elementy[Math.max(0, i - 1)];
      else if (e.key === 'ArrowDown') nast = elementy[Math.min(elementy.length - 1, i + 1)];
      else if (e.key === 'Home') nast = elementy[0];
      else if (e.key === 'End') nast = elementy.at(-1);
      else if (e.key === 'ArrowLeft' && szablon && idWezla) {
        const r = rodzicWezla(szablon, idWezla);
        nast = r ? elementy.find((x) => x.dataset.wezel === r.rodzic.id) : undefined;
      } else if (e.key === 'ArrowRight' && szablon && idWezla) {
        const w = wezlyPoId.get(idWezla);
        const pierwsze = w && czyKontener(w) ? w.dzieci[0] : undefined;
        nast = pierwsze ? elementy.find((x) => x.dataset.wezel === pierwsze.id) : undefined;
      }
      if (nast?.dataset.wezel) {
        const nid = nast.dataset.wezel;
        if (e.shiftKey) ustawZazn((z) => (z.includes(nid) ? z : [...z, nid]));
        else ustawZazn([nid]);
        nast.focus();
      }
    } else if (wDrzewie && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      const idWezla = (document.activeElement as HTMLElement).dataset.wezel;
      if (idWezla) wybierz(idWezla, ctrl);
    }
  });

  if (!szablon) {
    return (
      <section className="tresc">
        <h1>{u.teksty.brak}</h1>
        <a href={`#/projekt/${idProjektu}`}>{t('szablon.wrocDoKartek')}</a>
      </section>
    );
  }

  const celeZazn: Cel[] = wezlyKarty ? budujCele(szablon, wezlyKarty, aktywne) : [];
  const celUchwytow = celeZazn.length === aktywne.length ? celSkalowania(celeZazn) : undefined;
  const prostokatUchwytow =
    gest.stan?.rodzaj !== 'przesun' ? (celUchwytow?.lokalne ?? celUchwytow?.rect) : undefined;
  const rozmiarZaznaczenia =
    celUchwytow && celeZazn.length > 1 ? (
      <Sekcja tytul={t('nakladka.rozmiarZaznaczenia')} otwarta>
        {(['szer', 'wys'] as const).map((os) => (
          <Liczba
            key={os}
            etykieta={t(`nakladka.zaznaczenie.${os}`)}
            wartosc={zaokraglij(celUchwytow.rect[os], 3)}
            min={1}
            zmien={(wartosc) => {
              const rect = celUchwytow.rect;
              if (Math.abs(rect[os] - wartosc) < 0.0005) return;
              zmienSz(
                (s) =>
                  zastosujZmiany(
                    s,
                    skalujZaznaczenie(s, celeZazn, rect, { ...rect, [os]: wartosc }),
                  ),
                `rozmiar-zaznaczenia:${aktywne.join(',')}:${os}`,
              );
            }}
          />
        ))}
      </Sekcja>
    ) : undefined;
  const wyrownanie =
    celeZazn.length > 0 &&
    celeZazn.length === aktywne.length &&
    new Set(aktywne.map((x) => rodzicWezla(szablon, x)?.rodzic.id)).size === 1 ? (
      <PanelWyrownania
        cele={celeZazn}
        zastosuj={(zmiany) => zmienSz((x) => zastosujZmiany(x, zmiany))}
      />
    ) : undefined;
  const wymiary = (x: string) => wezlyKarty?.find((w) => w.id === x);
  const { szer, wys } = wymiaryKarty(szablon);
  const korzen = (x: string) => x === szablon.korzen.id;
  // „Opakuj” – tylko elementy jednego rodzica (bez korzenia).
  const rodzice = new Set(aktywne.map((x) => rodzicWezla(szablon, x)?.rodzic.id));
  const moznaOpakowac = aktywne.length > 0 && rodzice.size === 1 && !rodzice.has(undefined);
  const r1 = jeden && !korzen(jeden.id) ? rodzicWezla(szablon, jeden.id) : undefined;
  const moznaWyzej = !!r1 && r1.indeks > 0;
  const moznaNizej = !!r1 && r1.indeks < r1.rodzic.dzieci.length - 1;
  const poprzedni = r1 ? r1.rodzic.dzieci[r1.indeks - 1] : undefined;
  const moznaDoKontenera = !!poprzedni && czyKontener(poprzedni);
  const moznaWyjac = !!r1 && r1.rodzic.id !== szablon.korzen.id;
  const korzenZazn = !jeden || jeden.id === szablon.korzen.id;
  // Element do panelu: jeden zaznaczony albo kilku tego samego typu (bez korzenia).
  const zaznWezly = aktywne.map((x) => wezlyPoId.get(x)).filter((w): w is Wezel => !!w);
  const edytowany =
    zaznWezly.length > 0 &&
    !aktywne.includes(szablon.korzen.id) &&
    zaznWezly.every((w) => w.typ === zaznWezly[0]!.typ)
      ? zaznWezly[0]
      : undefined;
  // Sekcja „Położenie”: wszystkie zaznaczone elementy leżą w tym samym kontenerze swobodnym.
  const rodzicSw = (() => {
    if (!edytowany) return undefined;
    const rp = aktywne.map((x) => rodzicWezla(szablon, x)?.rodzic);
    const r = rp[0];
    return r?.typ === 'swobodny' && rp.every((x) => x?.id === r.id) ? r : undefined;
  })();
  /** Rozmiary do zachowania miejsca elementu przy zmianie kotwicy (z bieżącego podglądu). */
  const rozmiaryKotwicy = (x: string) => {
    const rodzic = rodzicWezla(szablon, x)?.rodzic;
    const e = wezlyKarty?.find((w) => w.id === x);
    const r = rodzic && wezlyKarty?.find((w) => w.id === rodzic.id);
    if (!e || !r || !rodzic) return undefined;
    const p = rozwinOdstepy(rodzic.padding);
    const zamienione = e.obrot === 90 || e.obrot === 270;
    return {
      ramka: { szer: r.lokalne.szer - p.lewo - p.prawo, wys: r.lokalne.wys - p.gora - p.dol },
      element: zamienione
        ? { szer: e.lokalne.wys, wys: e.lokalne.szer }
        : { szer: e.lokalne.szer, wys: e.lokalne.wys },
    };
  };
  // Czcionki: role projektu, rodziny w projekcie i rodziny zapisane globalnie w przeglądarce.
  const rodziny = [
    ...new Set([
      ...projekt.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z.rodzina] : [])),
      ...rodzinyGlobalne,
    ]),
  ];
  const czcionki = [
    ...roleProjektu(projekt).map((r) => ({
      wartosc: r,
      tekst: t('wlasciwosci.rola', { rola: tJesliJest(`rola.${r}`) ?? r }),
    })),
    ...rodziny.map((r) => ({ wartosc: r, tekst: r })),
  ];
  const obrazy = projekt.zasoby.flatMap((z) =>
    z.rodzaj === 'obraz' ? [{ wartosc: z.id, tekst: z.nazwa }] : [],
  );
  const podklad = u.podklad;

  return (
    <ElementyWlasneKontekst.Provider
      value={{
        elementy: projekt.biblioteka?.ozdobniki ?? [],
        adresBiblioteki: `#/projekt/${idProjektu}/biblioteka`,
        adresObrazu: (x) => zasoby.obrazy.get(x)?.adres,
      }}
    >
      <div className="edytor-szablonu">
        <header className="pasek-gorny" role="banner">
          <a href="#/" className="logo">
            {t('aplikacja.nazwa')}
          </a>
          <input
            className="nazwa-projektu"
            title={szablon.nazwa}
            aria-label={u.teksty.nazwa}
            value={szablon.nazwa}
            onChange={(e) => u.zmienNazwe(e.target.value)}
          />
          <span className="status-zapisu" role="status">
            {tekstZapisu(edycja.zapis)}
          </span>
          <span className="odstep" />
          <a className="przycisk" href={`#/projekt/${idProjektu}/biblioteka`}>
            {t('biblioteka.tytul')}
          </a>
          <button
            type="button"
            aria-label={t('kartka.cofnij')}
            disabled={!edycja.mozeCofnac}
            onClick={edycja.cofnij}
          >
            ↶
          </button>
          <button
            type="button"
            aria-label={t('kartka.ponow')}
            disabled={!edycja.mozePonowic}
            onClick={edycja.ponow}
          >
            ↷
          </button>
          <button type="button" onClick={u.duplikuj}>
            {t('szablony.duplikuj')}
          </button>
          <a className="przycisk" href={u.adresPowrotu}>
            {t('pasek.powrot')}
          </a>
          {u.akcjaGlowna}
          <NarzedziaPaska />
        </header>
        <h1 className="tylko-czytnik">{u.teksty.tytul}</h1>
        <div role="status">{u.kopia && <a href={u.kopia.adres}>{u.kopia.tekst}</a>}</div>
        <div className="uklad-szablonu">
          <aside className="panel-drzewa" aria-label={u.teksty.drzewo}>
            <h2>{u.teksty.drzewo}</h2>
            <div ref={drzewo}>
              <DrzewoSzablonu korzen={szablon.korzen} zaznaczone={aktywne} wybierz={wybierz} />
            </div>
            <div className="akcje-drzewa">
              <MenuDodaj rodzaje={u.rodzajeDodaj ?? RODZAJE} dodaj={dodaj} />
              <button
                type="button"
                disabled={!moznaWyzej}
                onClick={() => ruch((s, x) => przesunWezel(s, x, -1))}
              >
                {t('szablon.wyzej')}
              </button>
              <button
                type="button"
                disabled={!moznaNizej}
                onClick={() => ruch((s, x) => przesunWezel(s, x, 1))}
              >
                {t('szablon.nizej')}
              </button>
              <button
                type="button"
                disabled={!moznaDoKontenera}
                onClick={() => ruch(doPoprzedniegoKontenera)}
              >
                {t('szablon.doKontenera')}
              </button>
              <button type="button" disabled={!moznaWyjac} onClick={() => ruch(wyzej)}>
                {t('szablon.wyjmij')}
              </button>
              <button type="button" disabled={!moznaOpakowac} onClick={() => opakujW('wiersz')}>
                {t('szablon.opakujWiersz')}
              </button>
              <button type="button" disabled={!moznaOpakowac} onClick={() => opakujW('kolumna')}>
                {t('szablon.opakujKolumne')}
              </button>
              <button type="button" disabled={!jeden || korzenZazn} onClick={duplikuj}>
                {t('kartka.duplikuj')}
              </button>
              <button
                type="button"
                className="niebezpieczny"
                disabled={aktywne.length === 0 || aktywne.includes(szablon.korzen.id)}
                onClick={usun}
              >
                {t('kartka.usun')}
              </button>
            </div>
            <p className="podpis">{t('szablon.pomocDrzewa')}</p>
          </aside>

          <section className="podglad-szablonu" aria-label={u.teksty.podglad}>
            {podglad && 'blad' in podglad ? (
              <p role="alert" className="uwaga">
                {t('szablon.bladPodgladu', { szczegoly: String(podglad.blad) })}
              </p>
            ) : (
              podglad && (
                <>
                  <div
                    ref={kartaRef}
                    className="karta-podgladu"
                    role="group"
                    aria-label={t('nakladka.opis')}
                    tabIndex={0}
                    style={{
                      aspectRatio: `${szer} / ${wys}`,
                      width: `min(100%, ${(szer / wys) * 70}vh)`,
                      touchAction: 'none',
                    }}
                    onPointerDown={gest.onPointerDown}
                    onPointerMove={gest.onPointerMove}
                    onPointerUp={gest.onPointerUp}
                    onPointerCancel={gest.onPointerCancel}
                    onLostPointerCapture={gest.onLostPointerCapture}
                  >
                    <div
                      className="svg-opakowanie"
                      dangerouslySetInnerHTML={{ __html: podglad.svg }}
                    />
                    {/* Podkład ze wzoru: nad kartą (tło karty jest kryjące), nie łapie kliknięć. */}
                    {podklad?.podklad?.widoczny && podklad.adres && (
                      <img
                        className="podklad-podgladu"
                        data-testid="podklad-podgladu"
                        src={podklad.adres}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        style={{ opacity: 1 - podklad.podklad.przezroczystosc / 100 }}
                      />
                    )}
                    {/* Obszary elementów – większe pod spodem, żeby mniejsze dało się kliknąć. */}
                    {[...podglad.wezly]
                      .sort(
                        (a, b) => b.lokalne.szer * b.lokalne.wys - a.lokalne.szer * a.lokalne.wys,
                      )
                      .map((w) => {
                        const wezel = wezlyPoId.get(w.id);
                        if (!wezel) return null;
                        const r = w.obrys
                          ? {
                              x: w.obrys.x - w.lokalne.szer / 2,
                              y: w.obrys.y - w.lokalne.wys / 2,
                              szer: w.lokalne.szer,
                              wys: w.lokalne.wys,
                            }
                          : w;
                        return (
                          <button
                            key={w.id}
                            type="button"
                            tabIndex={-1}
                            className={`obszar-wezla${aktywne.includes(w.id) ? ' zaznaczony' : ''}${czyKontener(wezel) ? ' kontener' : ''}`}
                            data-obszar={w.id}
                            aria-label={nazwaWezla(wezel)}
                            style={{
                              left: `${(r.x / szer) * 100}%`,
                              top: `${(r.y / wys) * 100}%`,
                              width: `${(r.szer / szer) * 100}%`,
                              height: `${(r.wys / wys) * 100}%`,
                              ...(w.obrys ? { transform: `rotate(${w.obrys.kat}deg)` } : {}),
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Klik myszą obsługuje już `pointerdown` (zaznaczanie i przeciąganie);
                              // tu zostaje aktywacja z klawiatury i technologii asystujących.
                              if (e.detail === 0) wybierz(w.id, e.shiftKey);
                            }}
                          />
                        );
                      })}
                    <NakladkaSwobodna
                      szer={szer}
                      wys={wys}
                      stan={gest.stan}
                      siatka={przyciaganie.siatka}
                      prostokat={prostokatUchwytow}
                      obrot={celUchwytow?.lokalne ? celUchwytow.obrot : 0}
                      uchwytDown={gest.onUchwytDown}
                      uchwytKlawisz={(uch, e) => {
                        if (e.altKey || e.ctrlKey || e.metaKey) return;
                        if (gest.strzalkiUchwytu(uch, e)) {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                    />
                  </div>
                  {celeZazn.length === aktywne.length &&
                    celeZazn.some((c) => c.obrotPrzodkow !== 0) && (
                      <p className="podpis" role="status">
                        {t('nakladka.uchwytyNiedostepne')}
                      </p>
                    )}
                  <NarzedziaPodgladu
                    przyciaganie={przyciaganie}
                    ustawPrzyciaganie={ustawPrzyciaganie}
                    podklad={podklad}
                  />
                  {podglad.ostrzezenia.length > 0 && (
                    <ul className="ostrzezenia-karty">
                      {podglad.ostrzezenia.map((o, i) => {
                        const w = znajdzWezel(szablon, o.pole);
                        return (
                          <li key={i}>
                            {tekstOstrzezenia({ ...o, pole: w ? nazwaWezla(w) : o.pole })}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )
            )}
            <p className="podpis">{u.teksty.pomocPodgladu}</p>
          </section>

          <aside className="panel-edytora" aria-label={t('szablon.wlasciwosci')}>
            {rozmiarZaznaczenia}
            {edytowany ? (
              <>
                <h2>
                  {aktywne.length > 1
                    ? t('szablon.zaznaczono', { liczba: aktywne.length })
                    : nazwaWezla(edytowany)}
                </h2>
                <p className="akcje-stylu">
                  <button
                    type="button"
                    onClick={() => ustawSchowek(skopiujStyl(edytowany, szablon))}
                  >
                    {t('wlasciwosci.kopiujStyl')}
                  </button>
                  <button
                    type="button"
                    disabled={!schowek}
                    onClick={() =>
                      schowek &&
                      zmienSz((s) =>
                        aktywne.reduce(
                          (x, idW) => zmienWezel(x, idW, (w) => wklejStyl(w, schowek)),
                          s,
                        ),
                      )
                    }
                  >
                    {t('wlasciwosci.wklejStyl')}
                  </button>
                </p>
                <PanelWezla
                  key={aktywne.join(',')}
                  szablon={szablon}
                  wezel={edytowany}
                  zmienSzablon={zmienSz}
                  wiele={aktywne.length > 1}
                  wymiary={wymiary(edytowany.id)}
                  czcionki={czcionki}
                  obrazy={obrazy}
                  {...(aktywne.length === 1
                    ? {
                        wgrajStalyObraz: (plik: File, sygnal: AbortSignal) =>
                          u.wgrajStalyObraz(edytowany.id, plik, sygnal),
                      }
                    : {})}
                  zajeteKlucze={zajeteKlucze}
                  {...(bezDanych ? { bezDanych: true } : {})}
                  {...(rodzicSw ? { rodzicSwobodny: rodzicSw } : {})}
                  rozmiaryKotwicy={rozmiaryKotwicy}
                  {...(wyrownanie ? { wyrownanie } : {})}
                  mozeNaSwobodny={!!uklad}
                  kolejnosc={(jak) => zmienSz((s) => zmienKolejnoscRysowania(s, edytowany.id, jak))}
                  // Kilka zaznaczonych (ten sam typ) – zmiana dla każdego z nich.
                  zmienWezel={(f, klucz) =>
                    zmienSz(
                      (s) => aktywne.reduce((x, idW) => zmienWezel(x, idW, f), s),
                      klucz && `${klucz}:${aktywne.join(',')}`,
                    )
                  }
                  zmienTyp={(typ) =>
                    zmienSz((s) =>
                      aktywne.reduce(
                        (x, idW) =>
                          czyKontener(edytowany)
                            ? zmienTypKontenera(x, idW, typ as Kontener['typ'], uklad)
                            : zmienTypPola(
                                x,
                                idW,
                                typ as Pole['typ'],
                                t(`wezel.${typ}`),
                                zajeteKlucze(),
                                bezDanych,
                              ),
                        s,
                      ),
                    )
                  }
                  zmienPrzyklad={(klucz, v, grupuj = true) => {
                    if (bezDanych) return;
                    zmienSz(
                      (s) => ({ ...s, przyklad: { ...s.przyklad, [klucz]: v } }),
                      grupuj ? `przyklad:${klucz}` : undefined,
                    );
                  }}
                />
              </>
            ) : aktywne.length > 1 ? (
              <>
                <h2>{t('szablon.zaznaczono', { liczba: aktywne.length })}</h2>
                <p className="podpis">{t('szablon.wieleOpis')}</p>
                {wyrownanie && (
                  <fieldset className="polozenie">
                    <legend>
                      <strong>{t('polozenie.tytul')}</strong>
                    </legend>
                    {wyrownanie}
                  </fieldset>
                )}
              </>
            ) : (
              u.panelKarty({ szablon, zmienSz, czcionki, obrazy, wymiary, uklad })
            )}
          </aside>
        </div>
      </div>
    </ElementyWlasneKontekst.Provider>
  );
}

/** Pasek pod podglądem: przyciąganie (siatka, krawędzie) i – w awersie – podkład ze wzoru. */
function NarzedziaPodgladu({
  przyciaganie,
  ustawPrzyciaganie,
  podklad,
}: {
  przyciaganie: { siatka: number; obiekty: boolean };
  ustawPrzyciaganie: (p: { siatka: number; obiekty: boolean }) => void;
  podklad: PodkladEdytora | undefined;
}) {
  return (
    <div className="narzedzia-podgladu">
      <fieldset>
        <legend>{t('przyciaganie.tytul')}</legend>
        <PoleLiczby
          id="przyciaganie-siatka"
          etykieta={t('przyciaganie.siatka')}
          wartosc={przyciaganie.siatka}
          min={0}
          max={20}
          krok={0.5}
          zmien={(v) => ustawPrzyciaganie({ ...przyciaganie, siatka: v })}
        />
        <label className="pole-wyboru">
          <input
            type="checkbox"
            checked={przyciaganie.obiekty}
            onChange={(e) => ustawPrzyciaganie({ ...przyciaganie, obiekty: e.target.checked })}
          />{' '}
          {t('przyciaganie.obiekty')}
        </label>
        <p className="podpis">{t('przyciaganie.alt')}</p>
      </fieldset>
      {podklad && <PolaPodkladu {...podklad} />}
    </div>
  );
}

/** Podkład ze wzoru: wczytanie, widoczność, przezroczystość. */
function PolaPodkladu({ podklad, adres, blad, wczytaj, zmien, usun }: PodkladEdytora) {
  const plik = useRef<HTMLInputElement>(null);
  return (
    <fieldset>
      <legend>{t('podklad.tytul')}</legend>
      <input
        ref={plik}
        type="file"
        accept="image/png,image/jpeg"
        data-testid="plik-podkladu"
        className="tylko-czytnik"
        tabIndex={-1}
        aria-label={t('podklad.wczytaj')}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) wczytaj(f);
        }}
      />
      <div className="wiersz-przyciskow">
        <button type="button" onClick={() => plik.current?.click()}>
          {podklad ? t('podklad.zmien') : t('podklad.wczytaj')}
        </button>
        {podklad && (
          <button type="button" className="niebezpieczny" onClick={usun}>
            {t('podklad.usun')}
          </button>
        )}
      </div>
      {podklad && (
        <>
          <label className="pole-wyboru">
            <input
              type="checkbox"
              checked={podklad.widoczny}
              onChange={(e) => zmien((p) => ({ ...p, widoczny: e.target.checked }))}
            />{' '}
            {t('podklad.pokaz')}
          </label>
          <label>
            {t('podklad.przezroczystosc')}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={podklad.przezroczystosc}
              onChange={(e) => zmien((p) => ({ ...p, przezroczystosc: Number(e.target.value) }))}
            />
          </label>
        </>
      )}
      {podklad && !adres && <p className="uwaga">{t('podklad.brakObrazu')}</p>}
      {blad && (
        <p role="alert" className="blad-pola">
          {blad}
        </p>
      )}
      <p className="podpis">{t('podklad.opis')}</p>
    </fieldset>
  );
}
