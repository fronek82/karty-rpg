import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { roleProjektu } from '../../dane/edycja';
import {
  doPoprzedniegoKontenera,
  dostosujDoSwobodnego,
  duplikujWezel,
  nowyWezel,
  opakuj,
  pokazOdmianyZaznaczenia,
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
import { ACCEPT_PLIKU_SZABLONU } from '../../dane/archiwum';
import { zapiszPlik } from '../pliki';
import type { ProjektWEdycji } from '../useProjekt';
import { PrzyciskZapisu, useSkrotZapisu, useStrazWyjscia } from '../zapisReczny';
import { useCzcionkiGlobalne, useSynchronizujCzcionkiGlobalne } from '../zasobyGlobalne';
import { DrzewoSzablonu, nazwaWezla } from './DrzewoSzablonu';
import { ElementyWlasneKontekst } from './elementyWlasne';
import { adresBiblioteki, biezacyAdres } from '../biblioteki/adresy';
import { polaczElementy, useElementyOzdobne } from '../useBiblioteka';
import { zasobyElementow } from '../../dane/biblioteka';
import { elementyPozaKarta } from '../../dane/zgodnosc';
import { Liczba, Sekcja } from './Kontrolki';
import { NakladkaSwobodna } from './NakladkaSwobodna';
import { PanelWezla, type PrzodTylu } from './PanelWezla';
import { PanelWyrownania } from './PanelWyrownania';
import { GRUPY_ELEMENTOW, IKONY_RODZAJOW, PozycjeMenuDodaj, RODZAJE } from './PozycjeMenuDodaj';
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
import { PasekBoczny, type GrupaPaskaBocznego } from '../ui2/PasekBoczny';
import { IkonaKreskowa } from '../ui2/Ikony';
import { KLUCZ_WYSOKOSCI_STRUKTURY } from '../../wspolne/ustawienia';
import './edytorUi2.css';

// Okno AI ładowane dopiero po kliknięciu „Układ ze zdjęcia”.
const OknoUkladuZeZdjecia = lazy(() =>
  import('./OknoUkladuZeZdjecia').then((m) => ({ default: m.OknoUkladuZeZdjecia })),
);

const WYSOKOSC_STRUKTURY_DOMYSLNA = 240;
const WYSOKOSC_STRUKTURY_MIN = 120;
const WYSOKOSC_STRUKTURY_MAX = 600;
const POZIOMY_ZOOM = [50, 75, 100, 125, 150, 175, 200] as const;

function odczytajWysokoscStruktury(): number {
  try {
    const raw = window.localStorage.getItem(KLUCZ_WYSOKOSCI_STRUKTURY);
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= WYSOKOSC_STRUKTURY_MIN && n <= WYSOKOSC_STRUKTURY_MAX) {
      return Math.round(n);
    }
  } catch {
    // Brak dostępu do localStorage.
  }
  return WYSOKOSC_STRUKTURY_DOMYSLNA;
}

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

export interface PlikSzablonuEdytora {
  /** Bajty pliku, nazwa pliku i ostrzeżenia (np. licencje czcionek). */
  eksportuj: () => { bajty: Uint8Array; nazwa: string; ostrzezenia: string[] };
  /** Dodaje szablon z pliku do projektu; zwraca link do niego i ostrzeżenia. */
  importuj: (bajty: Uint8Array) => Promise<{ adres: string; tekst: string; ostrzezenia: string[] }>;
}

export interface UstawieniaEdytoraDrzewa {
  edycja: ProjektWEdycji;
  /** Edytowana strona karty (do przełącznika Przód | Tył). */
  strona?: 'przod' | 'tyl';
  /** Id edytowanego szablonu lub rewersu (miniatura, efekty przy zmianie). */
  id: string;
  /** Edytowane drzewo (rewers – w postaci szablonu); brak – ekran „nie znaleziono”. */
  szablon: Szablon | undefined;
  zmienSz: ZmianaSzablonu;
  /** Utworzenie nowego pustego szablonu w bieżącym projekcie. */
  nowySzablon?: () => void;
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
  /** Plik szablonu (format wspólny dla awersu i rewersu): eksport edytowanego, import jako nowy. */
  plikSzablonu: PlikSzablonuEdytora;
  wgrajStalyObraz: (poleId: string, plik: File, sygnal: AbortSignal) => Promise<void>;
  podklad?: PodkladEdytora | undefined;
  /** Tył: przód, z którego pola o tej samej nazwie biorą dane kart (wartość przykładowa w panelu). */
  przodTylu?: PrzodTylu | undefined;
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
  przycisk: wyglad,
}: {
  rodzaje: readonly RodzajNowego[];
  dodaj: (r: RodzajNowego) => void;
  /** Inny wygląd przycisku otwierającego (puste stany drzewa i podglądu) – to samo menu. */
  przycisk?: { tresc: React.ReactNode; className: string; etykieta?: string; testId: string };
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
    <div className={`menu-dodaj${wyglad ? ` ${wyglad.className}` : ''}`}>
      <button
        ref={przycisk}
        type="button"
        aria-haspopup="menu"
        aria-expanded={otwarte}
        {...(wyglad?.etykieta ? { 'aria-label': wyglad.etykieta } : {})}
        {...(wyglad ? { 'data-testid': wyglad.testId } : {})}
        onClick={() => ustawOtwarte((x) => !x)}
      >
        {wyglad ? wyglad.tresc : t('szablon.dodaj')}
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
  const zyweElementy = useElementyOzdobne().wlasne;
  useSynchronizujCzcionkiGlobalne(edycja, rodzinyGlobalne, u.czcionkiUzyte);
  const [zazn, ustawZazn] = useState<string[]>([]);
  const [schowek, ustawSchowek] = useState<SkopiowanyStyl>();
  const drzewo = useRef<HTMLDivElement>(null);
  const kartaRef = useRef<HTMLDivElement>(null);
  // Stan tymczasowy gestu myszy (zapis dopiero na pointerup – jeden krok „Cofnij”).
  const [tmp, ustawTmp] = useState<Map<string, ZmianaPola> | undefined>();
  const [przyciaganie, ustawPrzyciaganie] = useState({ siatka: SIATKA_DOMYSLNA, obiekty: true });
  const idProjektu = encodeURIComponent(projekt.id);
  useSkrotZapisu(edycja.zapiszTeraz);
  const { sprawdzWyjscie, okno: oknoWyjscia } = useStrazWyjscia(edycja);
  const plikImportu = useRef<HTMLInputElement>(null);
  const [oknoAi, ustawOknoAi] = useState(false);
  const przyciskAi = useRef<HTMLButtonElement>(null);
  // Komunikat eksportu/importu pliku szablonu (z linkiem do zaimportowanego) albo błąd.
  const [komunikatPliku, ustawKomunikatPliku] = useState<{
    tekst: string;
    link?: { adres: string; tekst: string };
    blad?: boolean;
  }>();
  const opisBledu = (e: unknown) => (e instanceof Error ? e.message : String(e));
  const eksportujPlik = () => {
    try {
      const { bajty, nazwa, ostrzezenia } = u.plikSzablonu.eksportuj();
      zapiszPlik(bajty, 'application/zip', nazwa);
      ustawKomunikatPliku(ostrzezenia.length ? { tekst: ostrzezenia.join(' ') } : undefined);
    } catch (e) {
      ustawKomunikatPliku({ tekst: opisBledu(e), blad: true });
    }
  };
  const importujPlik = async (plik: File) => {
    ustawKomunikatPliku(undefined);
    try {
      const w = await u.plikSzablonu.importuj(new Uint8Array(await plik.arrayBuffer()));
      ustawKomunikatPliku({ tekst: w.ostrzezenia.join(' '), link: w });
    } catch (e) {
      ustawKomunikatPliku({
        tekst: t('szablony.bladImportu', { szczegoly: opisBledu(e) }),
        blad: true,
      });
    }
  };

  // Zaznaczenie bez usuniętych węzłów (np. po „Cofnij”).
  const aktywne = szablon ? zazn.filter((x) => znajdzWezel(szablon, x)) : [];
  const pustaKarta = !!szablon && czyKontener(szablon.korzen) && szablon.korzen.dzieci.length === 0;
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
  // Zaznaczony element w odmianie przełącznika – podgląd pokazuje tę odmianę.
  const kluczRysunku = widoczny ? u.kluczRysunku(pokazOdmianyZaznaczenia(widoczny, aktywne)) : '';
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

  // Stan UI2 R4: przeciąganie z lewego paska, powiększenie, zwijana i przesuwana Struktura, prawy panel.
  const [przeciaganyRodzaj, ustawPrzeciaganyRodzaj] = useState<RodzajNowego>();
  const [nadKarta, ustawNadKarta] = useState(false);
  const [zoom, ustawZoom] = useState<'dopasuj' | number>('dopasuj');
  const [strukturaOtwarta, ustawStrukturaOtwarta] = useState(true);
  const [wysokoscStruktury, ustawWysokoscStruktury] = useState<number>(odczytajWysokoscStruktury);
  const [prawyPanelOtwarty, ustawPrawyPanelOtwarty] = useState(true);
  const [prawaZakladka, ustawPrawaZakladka] = useState<'element' | 'karta'>('element');
  const gestGranicy = useRef<{ startY: number; startH: number } | undefined>(undefined);

  // Operacje liczone w aktualizatorze (na najnowszym szablonie); nowe id przekazywane przez zmienną.
  const zajeteKlucze = (): Iterable<string> => (bezDanych ? [] : (u.zajeteKlucze?.() ?? []));
  const cel = jeden ?? szablon?.korzen;
  const dodaj = (r: RodzajNowego, pozycjaMm?: { x: number; y: number }) => {
    if (!cel) return;
    let noweId = '';
    zmienSz((s) => {
      const wybrany = znajdzWezel(s, cel.id) ?? s.korzen;
      // Przy upuszczeniu bezpośrednio na kartę w układzie swobodnym wstawiamy do korzenia (chyba że zaznaczony jest kontener swobodny).
      const c =
        pozycjaMm &&
        s.korzen.typ === 'swobodny' &&
        !(czyKontener(wybrany) && wybrany.typ === 'swobodny')
          ? s.korzen
          : wybrany;
      const rodzic = czyKontener(c) ? c : rodzicWezla(s, c.id)?.rodzic;
      const w = nowyWezel(s, r, t(`wezel.${r}`), {
        wWierszu: rodzic?.typ === 'wiersz',
        ...(bezDanych ? { bezKlucza: true } : { zajete: zajeteKlucze() }),
      });
      // W kontenerze swobodnym element dostaje położenie i rozmiar w mm (z pozycją upuszczenia, jeśli podano).
      let nowy = rodzic?.typ === 'swobodny' ? dostosujDoSwobodnego(w) : w;
      if (pozycjaMm && rodzic?.typ === 'swobodny') {
        const { szer: kSzer, wys: kWys } = wymiaryKarty(s);
        const szerElem =
          nowy.szerokosc && typeof nowy.szerokosc === 'object' && 'mm' in nowy.szerokosc
            ? nowy.szerokosc.mm
            : 20;
        const wysElem =
          nowy.wysokosc && typeof nowy.wysokosc === 'object' && 'mm' in nowy.wysokosc
            ? nowy.wysokosc.mm
            : 10;
        const nx = zaokraglij(
          Math.max(0, Math.min(kSzer - szerElem, pozycjaMm.x - szerElem / 2)),
          1,
        );
        const ny = zaokraglij(Math.max(0, Math.min(kWys - wysElem, pozycjaMm.y - wysElem / 2)), 1);
        nowy = { ...nowy, pozycja: { ...(nowy.pozycja ?? {}), x: nx, y: ny } };
      }
      noweId = nowy.id;
      return wstawWezel(s, c.id, nowy);
    });
    if (noweId) {
      ustawZazn([noweId]);
      ustawPrawaZakladka('element');
    }
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
      <Sekcja tytul={t('nakladka.rozmiarZaznaczenia')}>
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
  // Zaokrąglone rogi karty także na podkładzie i cieniu podglądu (w % – niezależnie od skali).
  const promienKarty = szablon.postrzepienie?.sila
    ? 0
    : Math.min(szablon.promienRogow ?? 0, szer / 2, wys / 2);
  const pozaKarta = wezlyKarty
    ? elementyPozaKarta(wezlyKarty, szer, wys, szablon.korzen.id)
    : undefined;
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
  // Czcionki w dwóch grupach: „Systemowe” (wbudowane w aplikację) i „Moja biblioteka”.
  const wbudowane = new Set(
    projekt.zasoby.flatMap((z) =>
      z.rodzaj === 'czcionka' && z.zrodlo === 'wbudowana' ? [z.rodzina] : [],
    ),
  );
  const czcionki = [
    ...roleProjektu(projekt).map((r) => ({
      wartosc: r,
      tekst: t('wlasciwosci.rola', { rola: tJesliJest(`rola.${r}`) ?? r }),
    })),
    ...rodziny
      .filter((r) => wbudowane.has(r))
      .map((r) => ({ wartosc: r, tekst: r, grupa: t('biblioteka.zrodlo.systemowe') })),
    ...rodziny
      .filter((r) => !wbudowane.has(r))
      .map((r) => ({ wartosc: r, tekst: r, grupa: t('biblioteka.zrodlo.moja') })),
  ];
  // Obrazy biblioteki bez obrazów ramek 9-slice (te wybiera się jako ozdobnik, nie obraz).
  const obrazyRamek = new Set(zasobyElementow(projekt.biblioteka?.ozdobniki ?? []));
  const obrazy = projekt.zasoby.flatMap((z) =>
    z.rodzaj === 'obraz' && !obrazyRamek.has(z.id) ? [{ wartosc: z.id, tekst: z.nazwa }] : [],
  );
  const adresOzdobnikow = adresBiblioteki('ozdobniki', biezacyAdres());
  // Ozdobniki do wyborów: z widoku projektu i z biblioteki na żywo (dodane po otwarciu).
  const elementyWyboru = polaczElementy(projekt.biblioteka?.ozdobniki ?? [], zyweElementy);
  const podklad = u.podklad;

  const dozwoloneRodzaje = u.rodzajeDodaj ?? RODZAJE;
  const dozwoloneSet = new Set<RodzajNowego>(dozwoloneRodzaje);
  const grupyPaska: GrupaPaskaBocznego[] = GRUPY_ELEMENTOW.map((g) => ({
    id: g.id,
    nazwa: t(`edytor.grupa.${g.id}`),
    pozycje: g.rodzaje
      .filter((r) => dozwoloneSet.has(r))
      .map((r) => ({
        id: r,
        nazwa: t(`wezel.${r}`),
        podpowiedz: tJesliJest(`edytor.tip.${r}`) ?? undefined,
        ikona: IKONY_RODZAJOW[r],
        ...(r === 'swobodny' ? { odznaka: t('edytor.domyslny') } : {}),
        przeciagane: true,
        onKlik: () => dodaj(r),
        onPoczatekPrzeciagania: (e: React.DragEvent<HTMLButtonElement>) => {
          e.dataTransfer.setData('application/x-karty-rodzaj', r);
          e.dataTransfer.setData('text/plain', r);
          e.dataTransfer.effectAllowed = 'copy';
          ustawPrzeciaganyRodzaj(r);
        },
        onKoniecPrzeciagania: () => {
          ustawPrzeciaganyRodzaj(undefined);
          ustawNadKarta(false);
        },
      })),
  })).filter((g) => g.pozycje.length > 0);

  const stronaAktywna = u.strona ?? 'przod';
  const rewersyProjektu = projekt.rewersy ?? [];
  const maRewers = rewersyProjektu.length > 0;
  const adresPrzod = `#/projekt/${idProjektu}/szablon/${encodeURIComponent(
    u.przodTylu?.szablon.id ?? projekt.szablony[0]?.id ?? id,
  )}`;
  const przypisanyRewersId =
    stronaAktywna === 'przod'
      ? (projekt.szablony.find((s) => s.id === id)?.rewersId ?? rewersyProjektu[0]?.id)
      : id;
  const adresTyl = przypisanyRewersId
    ? `#/projekt/${idProjektu}/rewers/${encodeURIComponent(przypisanyRewersId)}`
    : undefined;

  const zmienZoomKrok = (delta: -1 | 1) => {
    ustawZoom((poprzedni) => {
      const biezacy = poprzedni === 'dopasuj' ? 100 : poprzedni;
      const idx = POZIOMY_ZOOM.findIndex((p) => p >= biezacy);
      const start = idx === -1 ? POZIOMY_ZOOM.length - 1 : idx;
      const nast = Math.max(0, Math.min(POZIOMY_ZOOM.length - 1, start + delta));
      return POZIOMY_ZOOM[nast]!;
    });
  };

  const szerokoscPodgladu =
    zoom === 'dopasuj'
      ? `min(100%, ${(szer / wys) * 70}vh)`
      : `${Math.round((szer * 3.78 * zoom) / 100)}px`;

  const onUpuscNaKarte = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    ustawNadKarta(false);
    const pobrany = (
      e.dataTransfer.getData('application/x-karty-rodzaj') ||
      e.dataTransfer.getData('text/plain') ||
      przeciaganyRodzaj ||
      ''
    ).trim() as RodzajNowego | '';
    ustawPrzeciaganyRodzaj(undefined);
    if (!pobrany || !dozwoloneSet.has(pobrany as RodzajNowego)) return;
    const rect = kartaRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      const xMm = zaokraglij(((e.clientX - rect.left) / rect.width) * szer, 1);
      const yMm = zaokraglij(((e.clientY - rect.top) / rect.height) * wys, 1);
      dodaj(pobrany as RodzajNowego, { x: xMm, y: yMm });
    } else {
      dodaj(pobrany as RodzajNowego);
    }
  };

  const krokiProjektu = [
    {
      id: 'szablony',
      numer: 1,
      etykieta: t('ui2.krok.szablony'),
      href: adresPrzod,
      aktywny: true,
    },
    {
      id: 'karty',
      numer: 2,
      etykieta: t('ui2.krok.karty'),
      href: `#/projekt/${idProjektu}`,
      aktywny: false,
    },
    {
      id: 'druk',
      numer: 3,
      etykieta: t('ui2.krok.druk'),
      href: `#/projekt/${idProjektu}/drukuj`,
      aktywny: false,
    },
  ];

  return (
    <ElementyWlasneKontekst.Provider
      value={{
        elementy: elementyWyboru,
        adresBiblioteki: adresOzdobnikow,
        adresObrazu: (x) => zasoby.obrazy.get(x)?.adres,
        sprawdzWyjscie,
      }}
    >
      <div className="edytor-szablonu">
        <header className="pasek-gorny ui2-naglowek" role="banner">
          <a
            href="#/"
            className="logo ui2-naglowek-powrot"
            onClick={(e) => sprawdzWyjscie(e, '#/')}
          >
            {t('aplikacja.nazwa')}
          </a>
          <span className="grupa-paska">
            <input
              className="nazwa-projektu"
              title={szablon.nazwa}
              aria-label={u.teksty.nazwa}
              value={szablon.nazwa}
              onChange={(e) => u.zmienNazwe(e.target.value)}
            />
            <PrzyciskZapisu edycja={edycja} />
          </span>
          <nav aria-label={t('ui2.etapyProjektu')} className="ui2-kroki">
            {krokiProjektu.map((krok, idx) => (
              <span key={krok.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {idx > 0 && (
                  <span className="ui2-krok-strzalka" aria-hidden="true">
                    →
                  </span>
                )}
                {krok.aktywny ? (
                  <span aria-current="page" className="ui2-krok ui2-krok-aktywny">
                    <span className="ui2-krok-numer">{krok.numer}</span>
                    {krok.etykieta}
                  </span>
                ) : (
                  <a
                    href={krok.href}
                    className="ui2-krok"
                    onClick={(e) => sprawdzWyjscie(e, krok.href)}
                  >
                    <span className="ui2-krok-numer">{krok.numer}</span>
                    {krok.etykieta}
                  </a>
                )}
              </span>
            ))}
          </nav>
          <span className="odstep" />
          <span className="grupa-paska">
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
          </span>
          <span className="grupa-paska">
            <button
              ref={przyciskAi}
              type="button"
              title={t('ai.przyciskOpis')}
              onClick={() => ustawOknoAi(true)}
            >
              {t('ai.przycisk')}
            </button>
            <button
              type="button"
              aria-label={t('szablon.eksportujPlik')}
              title={t('szablon.eksportujPlik')}
              onClick={eksportujPlik}
            >
              {t('szablon.eksportujKrotko')}
            </button>
            <button
              type="button"
              aria-label={t('szablon.importujPlik')}
              title={t('szablon.importujPlik')}
              onClick={() => plikImportu.current?.click()}
            >
              {t('szablon.importujKrotko')}
            </button>
            <input
              ref={plikImportu}
              type="file"
              hidden
              accept={ACCEPT_PLIKU_SZABLONU}
              aria-label={t('szablon.importujPlik')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void importujPlik(f);
              }}
            />
            <button
              type="button"
              aria-label={t('szablony.duplikuj')}
              title={t('szablony.duplikuj')}
              onClick={u.duplikuj}
            >
              {t('szablon.duplikujKrotko')}
            </button>
            <a
              className="przycisk"
              href={adresOzdobnikow}
              onClick={(e) => sprawdzWyjscie(e, adresOzdobnikow)}
              aria-label={t('biblioteka.tytul')}
              title={t('biblioteka.tytul')}
            >
              {t('szablon.bibliotekaKrotko')}
            </a>
          </span>
          <span className="grupa-paska">
            <a
              className="przycisk"
              href={u.adresPowrotu}
              onClick={(e) => sprawdzWyjscie(e, u.adresPowrotu)}
            >
              {t('pasek.powrot')}
            </a>
            {u.akcjaGlowna}
          </span>
          <NarzedziaPaska sprawdzWyjscie={sprawdzWyjscie} />
        </header>
        {oknoWyjscia}
        {oknoAi && (
          <Suspense fallback={null}>
            <OknoUkladuZeZdjecia
              szablon={szablon}
              bezDanych={bezDanych}
              zajeteKlucze={zajeteKlucze}
              podglad={(s) => {
                try {
                  const w = u.rysuj(u.kluczRysunku(s), {
                    czcionki: zasoby.czcionki,
                    obraz: (x) => zasoby.obrazy.get(x)?.info,
                    ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
                  });
                  return scenaDoSvg(w.scena, {
                    adresObrazu: (x) => zasoby.obrazy.get(x)?.adres,
                    przedrostekId: `ai-${u.przedrostekSvg}`,
                  });
                } catch {
                  return undefined;
                }
              }}
              wstaw={(f) => zmienSz(f)}
              {...(podklad ? { dolaczPodklad: podklad.wczytaj } : {})}
              zamknij={() => {
                ustawOknoAi(false);
                przyciskAi.current?.focus();
              }}
            />
          </Suspense>
        )}
        <h1 className="tylko-czytnik">{u.teksty.tytul}</h1>
        <div role="status">
          {u.kopia && <a href={u.kopia.adres}>{u.kopia.tekst}</a>}
          {komunikatPliku && !komunikatPliku.blad && (
            <>
              {komunikatPliku.link && (
                <a href={komunikatPliku.link.adres}>{komunikatPliku.link.tekst}</a>
              )}{' '}
              {komunikatPliku.tekst}
            </>
          )}
        </div>
        {komunikatPliku?.blad && (
          <p role="alert" className="uwaga">
            {komunikatPliku.tekst}
          </p>
        )}
        <div className="uklad-szablonu edytor-ui2-uklad">
          <PasekBoczny
            ekranId="edytor"
            tytul={t('edytor.dodajElement')}
            grupy={grupyPaska}
            wskazowka={t('edytor.wskazowkaDodaj')}
            domyslnieRozwiniety={false}
          />

          <div className="edytor-ui2-srodek">
            <div className="edytor-ui2-zakladki" role="toolbar" aria-label={t('ui2.krok.szablony')}>
              {projekt.szablony.map((sz) => {
                const wSz = wymiaryKarty(sz);
                const aktywna = stronaAktywna === 'przod' && sz.id === id;
                const href = `#/projekt/${idProjektu}/szablon/${encodeURIComponent(sz.id)}`;
                return (
                  <a
                    key={sz.id}
                    href={href}
                    className={`edytor-ui2-zakladka${aktywna ? ' aktywna' : ''}`}
                    aria-current={aktywna ? 'page' : undefined}
                    onClick={(e) => sprawdzWyjscie(e, href)}
                  >
                    <span>{sz.nazwa}</span>
                    <span className="edytor-ui2-zakladka-rozmiar">
                      {wSz.szer}×{wSz.wys}
                    </span>
                  </a>
                );
              })}
              {u.nowySzablon && (
                <button type="button" className="edytor-ui2-nowy-szablon" onClick={u.nowySzablon}>
                  {t('edytor.nowySzablon')}
                </button>
              )}
              {maRewers && adresTyl && (
                <div
                  className="edytor-ui2-strony"
                  role="tablist"
                  aria-label={t('edytor.stronaKarty')}
                >
                  <a
                    role="tab"
                    aria-selected={stronaAktywna === 'przod'}
                    href={adresPrzod}
                    className="edytor-ui2-strona-btn"
                    onClick={(e) => sprawdzWyjscie(e, adresPrzod)}
                  >
                    {t('edytor.przod')}
                  </a>
                  <a
                    role="tab"
                    aria-selected={stronaAktywna === 'tyl'}
                    href={adresTyl}
                    className="edytor-ui2-strona-btn"
                    onClick={(e) => sprawdzWyjscie(e, adresTyl)}
                  >
                    {t('edytor.tyl')}
                  </a>
                </div>
              )}
            </div>

            <section className="podglad-szablonu edytor-ui2-robocze" aria-label={u.teksty.podglad}>
              {podglad && 'blad' in podglad ? (
                <p role="alert" className="uwaga">
                  {t('szablon.bladPodgladu', { szczegoly: String(podglad.blad) })}
                </p>
              ) : (
                podglad && (
                  <>
                    <div
                      ref={kartaRef}
                      className={`karta-podgladu${przeciaganyRodzaj || nadKarta ? ' edytor-ui2-upusc-cel' : ''}`}
                      role="group"
                      aria-label={t('nakladka.opis')}
                      tabIndex={0}
                      style={{
                        aspectRatio: `${szer} / ${wys}`,
                        width: szerokoscPodgladu,
                        touchAction: 'none',
                        ...(promienKarty > 0
                          ? {
                              borderRadius: `${(promienKarty / szer) * 100}% / ${(promienKarty / wys) * 100}%`,
                            }
                          : {}),
                      }}
                      onPointerDown={gest.onPointerDown}
                      onPointerMove={gest.onPointerMove}
                      onPointerUp={gest.onPointerUp}
                      onPointerCancel={gest.onPointerCancel}
                      onLostPointerCapture={gest.onLostPointerCapture}
                      onDragOver={(e) => {
                        if (
                          przeciaganyRodzaj ||
                          e.dataTransfer.types.includes('application/x-karty-rodzaj') ||
                          e.dataTransfer.types.includes('text/plain')
                        ) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'copy';
                          if (!nadKarta) ustawNadKarta(true);
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          ustawNadKarta(false);
                        }
                      }}
                      onDrop={onUpuscNaKarte}
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
                      {/* Pusty stan tylko w edytorze: warstwa HTML nad sceną – nie trafia do SVG,
                          PDF, PNG ani miniatur (te powstają ze sceny). */}
                      {pustaKarta && (
                        <div
                          className="pusta-karta-podgladu"
                          data-testid="pusty-stan-karty"
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <p>{t('szablon.pustaKartaPodglad')}</p>
                          <MenuDodaj
                            rodzaje={dozwoloneRodzaje}
                            dodaj={dodaj}
                            przycisk={{
                              tresc: '＋',
                              className: 'menu-dodaj-duzy',
                              etykieta: t('szablon.dodajElement'),
                              testId: 'dodaj-pusta-karta',
                            }}
                          />
                        </div>
                      )}
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
                    {przeciaganyRodzaj && (
                      <div className="edytor-ui2-upusc-podpowiedz" role="status">
                        {t('edytor.upuscPodpowiedz', { nazwa: t(`wezel.${przeciaganyRodzaj}`) })}
                      </div>
                    )}
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

            <div className="ui2-pasek-stanu" data-testid="pasek-stanu-edytora">
              <span>
                {szer} × {wys} mm · {t(`wezel.${szablon.korzen.typ}`)} ·{' '}
                {przyciaganie.siatka > 0
                  ? `${t('edytor.przyciaganieWl')} (${przyciaganie.siatka} mm)`
                  : t('edytor.przyciaganieWyl')}
              </span>
              <span className="edytor-ui2-stan-zoom">
                <button
                  type="button"
                  className="edytor-ui2-stan-btn"
                  aria-label={t('edytor.pomniejsz')}
                  onClick={() => zmienZoomKrok(-1)}
                >
                  −
                </button>
                <span data-testid="zoom-wartosc">
                  {zoom === 'dopasuj' ? t('edytor.dopasuj') : `${zoom}%`}
                </span>
                <button
                  type="button"
                  className="edytor-ui2-stan-btn"
                  aria-label={t('edytor.powieksz')}
                  onClick={() => zmienZoomKrok(1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="edytor-ui2-stan-btn"
                  onClick={() => ustawZoom('dopasuj')}
                >
                  {t('edytor.dopasuj')}
                </button>
              </span>
            </div>
          </div>

          {prawyPanelOtwarty && (
            <div className="edytor-ui2-prawa-kolumna">
              <aside
                className="panel-edytora edytor-ui2-prawa-tresc"
                aria-label={t('szablon.wlasciwosci')}
              >
                {prawaZakladka === 'karta' ? (
                  u.panelKarty({ szablon, zmienSz, czcionki, obrazy, wymiary, uklad })
                ) : (
                  <>
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
                          {...(u.przodTylu ? { przodTylu: u.przodTylu } : {})}
                          {...(rodzicSw ? { rodzicSwobodny: rodzicSw } : {})}
                          rozmiaryKotwicy={rozmiaryKotwicy}
                          {...(wyrownanie ? { wyrownanie } : {})}
                          mozeNaSwobodny={!!uklad}
                          kolejnosc={(jak) =>
                            zmienSz((s) => zmienKolejnoscRysowania(s, edytowany.id, jak))
                          }
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
                  </>
                )}
              </aside>

              {strukturaOtwarta && (
                <div
                  className="edytor-ui2-granica"
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label={t('edytor.zmienWysokoscStruktury')}
                  data-testid="granica-struktury"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    gestGranicy.current = { startY: e.clientY, startH: wysokoscStruktury };
                  }}
                  onPointerMove={(e) => {
                    if (!gestGranicy.current) return;
                    const dy = gestGranicy.current.startY - e.clientY;
                    const nowa = Math.max(
                      WYSOKOSC_STRUKTURY_MIN,
                      Math.min(WYSOKOSC_STRUKTURY_MAX, Math.round(gestGranicy.current.startH + dy)),
                    );
                    ustawWysokoscStruktury(nowa);
                  }}
                  onPointerUp={() => {
                    if (!gestGranicy.current) return;
                    gestGranicy.current = undefined;
                    try {
                      window.localStorage.setItem(
                        KLUCZ_WYSOKOSCI_STRUKTURY,
                        String(wysokoscStruktury),
                      );
                    } catch {
                      // Best-effort.
                    }
                  }}
                >
                  <span className="edytor-ui2-granica-uchwyt" aria-hidden="true" />
                </div>
              )}

              <aside
                className={`panel-drzewa edytor-ui2-struktura${strukturaOtwarta ? ' z-granica' : ''}`}
                aria-label={u.teksty.drzewo}
                style={strukturaOtwarta ? { height: `${wysokoscStruktury}px` } : undefined}
              >
                <div className="edytor-ui2-struktura-naglowek">
                  <h2 className="edytor-ui2-struktura-tytul">
                    <button
                      type="button"
                      className="edytor-ui2-struktura-przelacz"
                      aria-expanded={strukturaOtwarta}
                      data-testid="przelacz-strukture"
                      onClick={() => ustawStrukturaOtwarta((v) => !v)}
                    >
                      <span aria-hidden="true">{strukturaOtwarta ? '▾' : '▸'}</span>
                      <span>{u.teksty.drzewo}</span>
                    </button>
                  </h2>
                </div>
                {strukturaOtwarta && (
                  <div className="edytor-ui2-struktura-cialo">
                    <div ref={drzewo}>
                      <DrzewoSzablonu
                        korzen={szablon.korzen}
                        zaznaczone={aktywne}
                        wybierz={wybierz}
                        pozaKarta={pozaKarta}
                      />
                    </div>
                    {pustaKarta && (
                      <div className="pusta-lista-drzewa" data-testid="pusty-stan-drzewa">
                        <p className="podpis">{t('szablon.brakElementow')}</p>
                        <MenuDodaj
                          rodzaje={dozwoloneRodzaje}
                          dodaj={dodaj}
                          przycisk={{
                            tresc: t('szablon.dodajPusta'),
                            className: 'menu-dodaj-pusta',
                            testId: 'dodaj-pusty-stan-drzewa',
                          }}
                        />
                      </div>
                    )}
                    <div className="akcje-drzewa">
                      <MenuDodaj rodzaje={dozwoloneRodzaje} dodaj={dodaj} />
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
                      <button
                        type="button"
                        disabled={!moznaOpakowac}
                        onClick={() => opakujW('wiersz')}
                      >
                        {t('szablon.opakujWiersz')}
                      </button>
                      <button
                        type="button"
                        disabled={!moznaOpakowac}
                        onClick={() => opakujW('kolumna')}
                      >
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
                  </div>
                )}
              </aside>
            </div>
          )}

          <div
            className="edytor-ui2-prawy-pasek"
            role="toolbar"
            aria-orientation="vertical"
            aria-label={t('edytor.przelaczPanel')}
          >
            <button
              type="button"
              className="edytor-ui2-prawy-btn ui2-z-dymkiem"
              aria-label={t('edytor.zakladka.element')}
              aria-pressed={prawyPanelOtwarty && prawaZakladka === 'element'}
              onClick={() => {
                ustawPrawyPanelOtwarty(true);
                ustawPrawaZakladka('element');
              }}
            >
              <IkonaKreskowa sciezka="M4 6h16M4 12h16M4 18h10" />
              <span className="ui2-dymek ui2-dymek-lewo" aria-hidden="true">
                {t('edytor.zakladka.element')}
              </span>
            </button>
            <button
              type="button"
              className="edytor-ui2-prawy-btn ui2-z-dymkiem"
              aria-label={t('edytor.zakladka.karta')}
              aria-pressed={prawyPanelOtwarty && prawaZakladka === 'karta'}
              onClick={() => {
                ustawPrawyPanelOtwarty(true);
                ustawPrawaZakladka('karta');
              }}
            >
              <IkonaKreskowa sciezka="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
              <span className="ui2-dymek ui2-dymek-lewo" aria-hidden="true">
                {t('edytor.zakladka.karta')}
              </span>
            </button>
            <a
              href={adresOzdobnikow}
              className="edytor-ui2-prawy-btn ui2-z-dymkiem"
              aria-label={t('edytor.otworzCalaBiblioteke')}
              onClick={(e) => sprawdzWyjscie(e, adresOzdobnikow)}
            >
              <IkonaKreskowa sciezka="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <span className="ui2-dymek ui2-dymek-lewo" aria-hidden="true">
                {t('edytor.zakladka.biblioteka')}
              </span>
            </a>
            <button
              type="button"
              className="edytor-ui2-prawy-btn edytor-ui2-prawy-zwin ui2-z-dymkiem"
              aria-label={t('edytor.przelaczPanel')}
              aria-expanded={prawyPanelOtwarty}
              onClick={() => ustawPrawyPanelOtwarty((v) => !v)}
            >
              <span aria-hidden="true">{prawyPanelOtwarty ? '»' : '«'}</span>
              <span className="ui2-dymek ui2-dymek-lewo" aria-hidden="true">
                {t('edytor.przelaczPanel')}
              </span>
            </button>
          </div>
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
