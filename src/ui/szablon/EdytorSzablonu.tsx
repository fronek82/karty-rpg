import { useEffect, useMemo, useRef, useState } from 'react';
import { opisObrazu } from '../../dane/obrazy';
import { ustawPodklad, usunPodklad } from '../../dane/podklad';
import {
  danePodgladu,
  doPoprzedniegoKontenera,
  dostosujDoSwobodnego,
  duplikujSzablonWProjekcie,
  duplikujWezel,
  kluczeDanychKart,
  nowyWezel,
  opakuj,
  przesunWezel,
  rodzicWezla,
  skopiujStyl,
  ukladZWezlow,
  usunWezly,
  wklejStyl,
  zmienKolejnoscRysowania,
  zmienTypKontenera,
  zmienTypPola,
  type SkopiowanyStyl,
  wstawWezel,
  wyzej,
  zastosujZestawStylu,
  zmienSzablon,
  zmienWezel,
  znajdzWezel,
  type RodzajNowego,
} from '../../dane/szablon';
import { czyProjektWlasny, kartkaDlaSzablonu, zmienRozmiarSzablonu } from '../../dane/wlasneKarty';
import { rozwinOdstepy, wszystkieWezly, wymiaryKarty } from '../../model/szablon';
import { roleProjektu, ustawStalyObraz } from '../../dane/edycja';
import { ElementyWlasneKontekst } from './elementyWlasne';
import { t, tJesliJest } from '../../i18n';
import { NarzedziaPaska } from '../NaglowekAplikacji';
import {
  czyKontener,
  type Kontener,
  type Pole,
  type PodkladSzablonu,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import { renderujKarte } from '../../silnik/karta';
import { ZESTAWY_STYLOW } from '../../ozdobniki/zestawyStylow';
import { scenaDoSvg } from '../../silnik/svg';
import { PoleLiczby } from '../kartka/PoleLiczby';
import { tekstOstrzezenia } from '../ostrzezenia';
import { tekstZapisu, type ProjektWEdycji } from '../useProjekt';
import { DrzewoSzablonu, nazwaWezla } from './DrzewoSzablonu';
import { PozycjeMenuDodaj } from './PozycjeMenuDodaj';
import { Liczba, Sekcja } from './Kontrolki';
import { PanelWezla } from './PanelWezla';
import { GrupyStylow } from './GrupyStylow';
import { KolorZDanych } from './KolorZDanych';
import { TloDekoracyjne } from './PolaDekoracji';
import { PoleRamki } from './PanelWygladu';
import { NakladkaSwobodna } from './NakladkaSwobodna';
import { PanelWyrownania } from './PanelWyrownania';
import { czcionkiSzablonu } from '../../dane/archiwum';
import { useCzcionkiGlobalne, useSynchronizujCzcionkiGlobalne } from '../zasobyGlobalne';
import { przygotujPlikObrazu } from '../obrazyUI';
import {
  budujCele,
  celSkalowania,
  skalujZaznaczenie,
  SIATKA_DOMYSLNA,
  zastosujZmiany,
  type Cel,
  type ZmianaPola,
} from './swobodnyMysz';
import { useGestSwobodny } from './useGestSwobodny';
import { upuscWezel } from './upuszczanie';

const wPolu = (e: Element | null) =>
  !!e &&
  (e.matches('input, textarea, select, [contenteditable="true"]') || !!e.closest('[role="menu"]'));

function usePodgladSzablonu(kluczRysunku: string, zasoby: ProjektWEdycji['zasoby']['zasoby']) {
  return useMemo(() => {
    if (!kluczRysunku) return undefined;
    const sz = JSON.parse(kluczRysunku) as Szablon;
    try {
      const w = renderujKarte(
        sz,
        { dane: danePodgladu(sz) },
        {
          czcionki: zasoby.czcionki,
          obraz: (id) => zasoby.obrazy.get(id)?.info,
          ...(zasoby.elementy ? { elementy: zasoby.elementy } : {}),
        },
      );
      return {
        ...w,
        svg: scenaDoSvg(w.scena, {
          adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
          przedrostekId: 'sz-',
        }),
      };
    } catch (e) {
      return { blad: e instanceof Error ? e.message : String(e) };
    }
  }, [kluczRysunku, zasoby.czcionki, zasoby.obrazy, zasoby.elementy]);
}

function useIndeksWezlow(szablon: Szablon | undefined) {
  return useMemo(
    () => new Map(szablon ? wszystkieWezly(szablon).map((w) => [w.id, w] as const) : []),
    [szablon],
  );
}

/**
 * Edytor szablonu karty od zera: drzewo wierszy, kolumn i pól (lewa kolumna), podgląd karty
 * z danymi przykładowymi i zaznaczaniem klikiem (środek), właściwości zaznaczonego elementu
 * (prawa kolumna). Zmiany zapisują się w projekcie z historią „Cofnij”.
 */
export function EdytorSzablonu({
  edycja,
  szablonId,
}: {
  edycja: ProjektWEdycji;
  szablonId: string;
}) {
  const { projekt, zmien } = edycja;
  const szablon = projekt.szablony.find((s) => s.id === szablonId);
  const { rodzinyGlobalne } = useCzcionkiGlobalne(projekt);
  useSynchronizujCzcionkiGlobalne(
    edycja,
    rodzinyGlobalne,
    szablon ? czcionkiSzablonu(szablon) : [],
  );
  const [zazn, ustawZazn] = useState<string[]>([]);
  const [menuDodaj, ustawMenuDodaj] = useState(false);
  const [schowek, ustawSchowek] = useState<SkopiowanyStyl>();
  const drzewo = useRef<HTMLDivElement>(null);
  const kartaRef = useRef<HTMLDivElement>(null);
  // Stan tymczasowy gestu myszy (zapis dopiero na pointerup – jeden krok „Cofnij”).
  const [tmp, ustawTmp] = useState<Map<string, ZmianaPola> | undefined>();
  const [przyciaganie, ustawPrzyciaganie] = useState({ siatka: SIATKA_DOMYSLNA, obiekty: true });
  const [idKopii, ustawIdKopii] = useState('');
  const kopia = projekt.szablony.find((s) => s.id === idKopii);
  const [bladPodkladu, ustawBladPodkladu] = useState('');
  const idProjektu = encodeURIComponent(projekt.id);

  // Zaznaczenie bez usuniętych węzłów (np. po „Cofnij”).
  const aktywne = szablon ? zazn.filter((id) => znajdzWezel(szablon, id)) : [];
  const jeden = szablon && aktywne.length === 1 ? znajdzWezel(szablon, aktywne[0]!) : undefined;

  const zmienSz = (f: (s: Szablon) => Szablon, klucz?: string) =>
    zmien((p) => zmienSzablon(p, szablonId, f), klucz ? { klucz: `szablon:${klucz}` } : {});

  const wybierz = (id: string, dodajDo: boolean) =>
    ustawZazn((z) => (dodajDo ? (z.includes(id) ? z.filter((x) => x !== id) : [...z, id]) : [id]));
  const fokusWDrzewie = (id: string) =>
    requestAnimationFrame(() =>
      drzewo.current?.querySelector<HTMLElement>(`[data-wezel="${CSS.escape(id)}"]`)?.focus(),
    );
  const zamknijMenu = () => {
    ustawMenuDodaj(false);
  };

  // Podgląd: karta z danymi przykładowymi (silnik jak na kartce i w PDF). Zależy tylko od
  // tego, co widać na karcie – zmiana nazwy szablonu nie rysuje karty od nowa.
  const zasoby = edycja.zasoby.zasoby;
  // Podkład ze wzoru nie bierze udziału w rysunku karty (jest tylko pod podglądem w edytorze).
  const widoczny = szablon && tmp ? zastosujZmiany(szablon, tmp) : szablon;
  const doRysunku = widoczny && { ...widoczny, nazwa: '', podklad: undefined };
  const kluczRysunku = doRysunku ? JSON.stringify(doRysunku) : '';
  const podglad = usePodgladSzablonu(kluczRysunku, zasoby);
  const scenaPodgladu = podglad && 'scena' in podglad ? podglad.scena : undefined;

  // Miniatura pojedynczego szablonu awersu na liście „Moje projekty”.
  const aktualnyDoMiniatury = useRef<
    { projekt: typeof projekt; dane: typeof edycja.dane; scena: typeof scenaPodgladu } | undefined
  >(undefined);
  useEffect(() => {
    aktualnyDoMiniatury.current =
      szablon && scenaPodgladu ? { projekt, dane: edycja.dane, scena: scenaPodgladu } : undefined;
  }, [projekt, edycja.dane, szablon, scenaPodgladu]);
  useEffect(() => {
    if (!scenaPodgladu || !szablon) return;
    const z = setTimeout(() => {
      void import('../miniaturaRewersu')
        .then(({ zapiszMiniatureSzablonu }) =>
          zapiszMiniatureSzablonu(projekt, edycja.dane, szablonId, scenaPodgladu),
        )
        .catch(() => undefined);
    }, 1000);
    return () => clearTimeout(z);
  }, [scenaPodgladu, projekt, edycja.dane, szablon, szablonId]);
  useEffect(
    () => () => {
      const stan = aktualnyDoMiniatury.current;
      if (!stan?.scena) return;
      void import('../miniaturaRewersu')
        .then(({ zapiszMiniatureSzablonu }) =>
          zapiszMiniatureSzablonu(stan.projekt, stan.dane, szablonId, stan.scena),
        )
        .catch(() => undefined);
    },
    [szablonId],
  );

  const wezlyPoId = useIndeksWezlow(szablon);

  // Układ do konwersji kontenerów (swobodny ↔ kolumna / wiersz): ramki z bieżącego podglądu.
  const uklad = useMemo(
    () => (podglad && 'wezly' in podglad ? ukladZWezlow(podglad.wezly) : undefined),
    [podglad],
  );

  const wezlyKarty = podglad && 'wezly' in podglad ? podglad.wezly : undefined;
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
  const zajeteKlucze = () => kluczeDanychKart(projekt, szablonId);
  const cel = jeden ?? szablon?.korzen;
  const dodaj = (r: RodzajNowego) => {
    if (!cel) return;
    let noweId = '';
    zmienSz((s) => {
      const c = znajdzWezel(s, cel.id) ?? s.korzen;
      const rodzic = czyKontener(c) ? c : rodzicWezla(s, c.id)?.rodzic;
      const w = nowyWezel(s, r, t(`wezel.${r}`), {
        wWierszu: rodzic?.typ === 'wiersz',
        zajete: zajeteKlucze(),
      });
      // W kontenerze swobodnym element dostaje położenie i rozmiar w mm.
      const nowy = rodzic?.typ === 'swobodny' ? dostosujDoSwobodnego(w) : w;
      noweId = nowy.id;
      return wstawWezel(s, c.id, nowy);
    });
    if (noweId) ustawZazn([noweId]);
    zamknijMenu();
  };
  const usun = () => {
    if (!szablon) return;
    const ids = aktywne.filter((id) => id !== szablon.korzen.id);
    if (ids.length === 0) return;
    // Fokus po usunięciu: sąsiad albo rodzic pierwszego usuwanego.
    const r = rodzicWezla(szablon, ids[0]!);
    const nastepny =
      r?.rodzic.dzieci.find((d, i) => i > r.indeks && !ids.includes(d.id)) ??
      [...(r?.rodzic.dzieci ?? [])]
        .reverse()
        .find((d, i, t) => t.length - 1 - i < r!.indeks && !ids.includes(d.id)) ??
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
  const ruch = (f: (s: Szablon, id: string) => Szablon) => {
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
  const robKarty = () => {
    let arkuszId = '';
    zmien((p) => {
      const w = kartkaDlaSzablonu(p, szablonId);
      arkuszId = w.arkuszId;
      return w.projekt;
    });
    window.location.hash = `#/projekt/${idProjektu}/kartka/${encodeURIComponent(arkuszId)}`;
  };

  // Menu „+ Dodaj”: fokus na pierwszej pozycji, strzałki, Escape wraca na przycisk.
  const przyciskDodaj = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuDodaj) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const poza = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node) && e.target !== przyciskDodaj.current)
        ustawMenuDodaj(false);
    };
    window.addEventListener('pointerdown', poza);
    return () => window.removeEventListener('pointerdown', poza);
  }, [menuDodaj]);
  const klawiszMenu = (e: React.KeyboardEvent) => {
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
      ustawMenuDodaj(false);
      przyciskDodaj.current?.focus();
    }
  };

  // Skróty: Delete, Ctrl+D, Ctrl+Z / Ctrl+Y, Escape; drzewo: strzałki, Home/End, Shift+strzałka
  // (dokłada do zaznaczenia), ←/→ (rodzic / pierwsze dziecko), Alt+↑/↓ (przesuń).
  const klawisze = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const obsluzKlawisz = (e: KeyboardEvent) => {
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
      const id = biezacy.dataset.wezel;
      if (e.altKey && jeden && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        ruch((s, x) => przesunWezel(s, x, e.key === 'ArrowUp' ? -1 : 1));
        return;
      }
      let nast: HTMLElement | undefined;
      if (e.key === 'ArrowUp') nast = elementy[Math.max(0, i - 1)];
      else if (e.key === 'ArrowDown') nast = elementy[Math.min(elementy.length - 1, i + 1)];
      else if (e.key === 'Home') nast = elementy[0];
      else if (e.key === 'End') nast = elementy.at(-1);
      else if (e.key === 'ArrowLeft' && szablon && id) {
        const r = rodzicWezla(szablon, id);
        nast = r ? elementy.find((x) => x.dataset.wezel === r.rodzic.id) : undefined;
      } else if (e.key === 'ArrowRight' && szablon && id) {
        const w = wezlyPoId.get(id);
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
      // Spacja z Ctrl – dokłada / zdejmuje element z zaznaczenia.
      e.preventDefault();
      const id = (document.activeElement as HTMLElement).dataset.wezel;
      if (id) wybierz(id, ctrl);
    }
  };
  useEffect(() => {
    klawisze.current = obsluzKlawisz;
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => klawisze.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  if (!szablon) {
    return (
      <section className="tresc">
        <h1>{t('szablon.brak')}</h1>
        <a href={`#/projekt/${idProjektu}`}>{t('szablon.wrocDoKartek')}</a>
      </section>
    );
  }

  const adresPodkladu = szablon.podklad
    ? zasoby.obrazy.get(szablon.podklad.zasob)?.adres
    : undefined;
  const wczytajPodklad = async (f: File) => {
    ustawBladPodkladu('');
    try {
      const { dane, ...wymiary } = await przygotujPlikObrazu(f);
      await edycja.zmienZZasobami((p, d) => {
        const opis = opisObrazu(f.name, dane, wymiary, new Set(p.zasoby.map((z) => z.id)));
        return ustawPodklad(p, d, szablonId, { opis, dane });
      });
    } catch (e) {
      ustawBladPodkladu(
        t('podklad.blad', { plik: f.name, powod: e instanceof Error ? e.message : String(e) }),
      );
    }
  };
  const wgrajStalyObraz = async (poleId: string, plik: File, sygnal: AbortSignal) => {
    const pole = szablon && znajdzWezel(szablon, poleId);
    if (!pole) return;
    const obraz = await przygotujPlikObrazu(plik);
    if (sygnal.aborted) return;
    await edycja.zmienZZasobami((p, d) => {
      const s = p.szablony.find((s) => s.id === szablonId);
      return p.id === projekt.id && s && znajdzWezel(s, poleId) === pole
        ? ustawStalyObraz(p, d, szablonId, poleId, plik.name, obraz)
        : { projekt: p, dane: d };
    });
  };
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
            wartosc={Math.round(celUchwytow.rect[os] * 1000) / 1000}
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
    new Set(aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic.id)).size === 1 ? (
      <PanelWyrownania
        cele={celeZazn}
        zastosuj={(zmiany) => zmienSz((x) => zastosujZmiany(x, zmiany))}
      />
    ) : undefined;
  const wymiary = (id: string) =>
    podglad && 'wezly' in podglad ? podglad.wezly.find((w) => w.id === id) : undefined;
  const { szer, wys } = wymiaryKarty(szablon);
  // „Opakuj” – tylko elementy jednego rodzica (bez korzenia).
  const rodzice = new Set(aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic.id));
  const moznaOpakowac = aktywne.length > 0 && rodzice.size === 1 && !rodzice.has(undefined);
  const r1 = jeden && !korzen(jeden.id) ? rodzicWezla(szablon, jeden.id) : undefined;
  const moznaWyzej = !!r1 && r1.indeks > 0;
  const moznaNizej = !!r1 && r1.indeks < r1.rodzic.dzieci.length - 1;
  const poprzedni = r1 ? r1.rodzic.dzieci[r1.indeks - 1] : undefined;
  const moznaDoKontenera = !!poprzedni && czyKontener(poprzedni);
  const moznaWyjac = !!r1 && r1.rodzic.id !== szablon.korzen.id;
  const korzenZazn = !jeden || jeden.id === szablon.korzen.id;
  // Element do panelu: jeden zaznaczony albo kilku tego samego typu (bez korzenia).
  const zaznWezly = aktywne.map((id) => wezlyPoId.get(id)).filter((w): w is Wezel => !!w);
  const edytowany =
    zaznWezly.length > 0 &&
    !aktywne.includes(szablon.korzen.id) &&
    zaznWezly.every((w) => w.typ === zaznWezly[0]!.typ)
      ? zaznWezly[0]
      : undefined;
  // Sekcja „Położenie”: wszystkie zaznaczone elementy leżą w tym samym kontenerze swobodnym.
  const rodzicSw = (() => {
    if (!edytowany) return undefined;
    const rodzice = aktywne.map((id) => rodzicWezla(szablon, id)?.rodzic);
    const r = rodzice[0];
    return r?.typ === 'swobodny' && rodzice.every((x) => x?.id === r.id) ? r : undefined;
  })();
  /** Rozmiary do zachowania miejsca elementu przy zmianie kotwicy (z bieżącego podglądu). */
  const rozmiaryKotwicy = (id: string) => {
    const wezly = podglad && 'wezly' in podglad ? podglad.wezly : undefined;
    const rodzic = rodzicWezla(szablon, id)?.rodzic;
    const e = wezly?.find((x) => x.id === id);
    const r = rodzic && wezly?.find((x) => x.id === rodzic.id);
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
  function korzen(id: string) {
    return id === szablon!.korzen.id;
  }

  return (
    <ElementyWlasneKontekst.Provider
      value={{
        elementy: projekt.biblioteka?.ozdobniki ?? [],
        adresBiblioteki: `#/projekt/${idProjektu}/biblioteka`,
        adresObrazu: (id) => zasoby.obrazy.get(id)?.adres,
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
            aria-label={t('szablon.nazwaSzablonu')}
            value={szablon.nazwa}
            onChange={(e) => zmienSz((s) => ({ ...s, nazwa: e.target.value }), 'nazwa')}
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
          <button
            type="button"
            onClick={() => {
              let id = '';
              zmien((p) => {
                const kopia = duplikujSzablonWProjekcie(p, szablonId, (n) =>
                  n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }),
                );
                id = kopia.id;
                return czyProjektWlasny(p)
                  ? kopia.projekt
                  : kartkaDlaSzablonu(kopia.projekt, id).projekt;
              });
              ustawIdKopii(id);
            }}
          >
            {t('szablony.duplikuj')}
          </button>
          <a
            className="przycisk"
            href={czyProjektWlasny(projekt) ? '#/wlasne' : `#/projekt/${idProjektu}`}
          >
            {t('pasek.powrot')}
          </a>
          <button type="button" className="glowny" onClick={robKarty}>
            {t('szablon.robKarty')}
          </button>
          <NarzedziaPaska />
        </header>
        <h1 className="tylko-czytnik">{t('szablon.tytulEdytora')}</h1>
        <div role="status">
          {kopia && (
            <a href={`#/projekt/${idProjektu}/szablon/${encodeURIComponent(kopia.id)}`}>
              {t('szablony.otworzKopie', { nazwa: kopia.nazwa })}
            </a>
          )}
        </div>
        <div className="uklad-szablonu">
          <aside className="panel-drzewa" aria-label={t('szablon.struktura')}>
            <h2>{t('szablon.struktura')}</h2>
            <div ref={drzewo}>
              <DrzewoSzablonu korzen={szablon.korzen} zaznaczone={aktywne} wybierz={wybierz} />
            </div>
            <div className="akcje-drzewa">
              <div className="menu-dodaj">
                <button
                  ref={przyciskDodaj}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={menuDodaj}
                  onClick={() => ustawMenuDodaj((x) => !x)}
                >
                  {t('szablon.dodaj')}
                </button>
                {menuDodaj && (
                  <div
                    ref={menu}
                    className="menu-typu"
                    role="menu"
                    aria-label={t('szablon.dodaj')}
                    onKeyDown={klawiszMenu}
                  >
                    <PozycjeMenuDodaj dodaj={dodaj} />
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!moznaWyzej}
                onClick={() => ruch((s, id) => przesunWezel(s, id, -1))}
              >
                {t('szablon.wyzej')}
              </button>
              <button
                type="button"
                disabled={!moznaNizej}
                onClick={() => ruch((s, id) => przesunWezel(s, id, 1))}
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

          <section className="podglad-szablonu" aria-label={t('szablon.podglad')}>
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
                    {szablon.podklad?.widoczny && adresPodkladu && (
                      <img
                        className="podklad-podgladu"
                        data-testid="podklad-podgladu"
                        src={adresPodkladu}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        style={{ opacity: 1 - szablon.podklad.przezroczystosc / 100 }}
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
                      uchwytKlawisz={(u, e) => {
                        if (e.altKey || e.ctrlKey || e.metaKey) return;
                        if (gest.strzalkiUchwytu(u, e)) {
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
                    podklad={szablon.podklad}
                    bladPodkladu={bladPodkladu}
                    brakObrazu={!!szablon.podklad && !adresPodkladu}
                    wczytaj={wczytajPodklad}
                    zmienPodklad={(f) =>
                      zmienSz((x) => (x.podklad ? { ...x, podklad: f(x.podklad) } : x), 'podklad')
                    }
                    usunPodklad={() =>
                      void edycja.zmienZZasobami((p, d) => usunPodklad(p, d, szablonId))
                    }
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
            <p className="podpis">{t('szablon.pomocPodgladu')}</p>
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
                          (x, id) => zmienWezel(x, id, (w) => wklejStyl(w, schowek)),
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
                          wgrajStalyObraz(edytowany.id, plik, sygnal),
                      }
                    : {})}
                  zajeteKlucze={zajeteKlucze}
                  {...(rodzicSw ? { rodzicSwobodny: rodzicSw } : {})}
                  rozmiaryKotwicy={rozmiaryKotwicy}
                  {...(wyrownanie ? { wyrownanie } : {})}
                  mozeNaSwobodny={!!uklad}
                  kolejnosc={(jak) => zmienSz((s) => zmienKolejnoscRysowania(s, edytowany.id, jak))}
                  // Kilka zaznaczonych (ten sam typ) – zmiana dla każdego z nich.
                  zmienWezel={(f, klucz) =>
                    zmienSz(
                      (s) => aktywne.reduce((x, id) => zmienWezel(x, id, f), s),
                      klucz && `${klucz}:${aktywne.join(',')}`,
                    )
                  }
                  zmienTyp={(typ) =>
                    zmienSz((s) =>
                      aktywne.reduce(
                        (x, id) =>
                          czyKontener(edytowany)
                            ? zmienTypKontenera(x, id, typ as Kontener['typ'], uklad)
                            : zmienTypPola(
                                x,
                                id,
                                typ as Pole['typ'],
                                t(`wezel.${typ}`),
                                zajeteKlucze(),
                              ),
                        s,
                      ),
                    )
                  }
                  zmienPrzyklad={(klucz, v, grupuj = true) =>
                    zmienSz(
                      (s) => ({ ...s, przyklad: { ...s.przyklad, [klucz]: v } }),
                      grupuj ? `przyklad:${klucz}` : undefined,
                    )
                  }
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
              <>
                <PanelKarty
                  szablon={szablon}
                  obrazy={obrazy}
                  zmienSz={zmienSz}
                  zmienRozmiar={(s, w) => {
                    // Karta, która nie zmieści się na stronie kartki – odrzucona (komunikat w panelu).
                    if (zmienRozmiarSzablonu(projekt, szablonId, s, w) === projekt) return false;
                    zmien((p) => zmienRozmiarSzablonu(p, szablonId, s, w), {
                      klucz: 'rozmiar-karty',
                    });
                    return true;
                  }}
                />
                <GrupyStylow szablon={szablon} czcionki={czcionki} zmien={zmienSz} />
                {/* Kontener całej karty: odstępy, rozłożenie, wygląd (jak każdy kontener). */}
                <Sekcja tytul={t('wlasciwosci.ukladKarty')}>
                  <PanelWezla
                    key={szablon.korzen.id}
                    szablon={szablon}
                    wezel={szablon.korzen}
                    zmienSzablon={zmienSz}
                    wymiary={wymiary(szablon.korzen.id)}
                    mozeNaSwobodny={!!uklad}
                    czcionki={czcionki}
                    obrazy={obrazy}
                    zajeteKlucze={zajeteKlucze}
                    zmienWezel={(f, klucz) =>
                      zmienSz((s) => zmienWezel(s, s.korzen.id, f), klucz && `korzen:${klucz}`)
                    }
                    zmienTyp={(typ) =>
                      zmienSz((s) =>
                        zmienTypKontenera(s, s.korzen.id, typ as Kontener['typ'], uklad),
                      )
                    }
                    zmienPrzyklad={() => undefined}
                  />
                </Sekcja>
              </>
            )}
          </aside>
        </div>
      </div>
    </ElementyWlasneKontekst.Provider>
  );
}

/** Ustawienia całej karty: rozmiar (mm), zaokrąglenie rogów, kolor tła i ramka. */
function PanelKarty({
  szablon,
  obrazy,
  zmienSz,
  zmienRozmiar,
}: {
  szablon: Szablon;
  obrazy: readonly { wartosc: string; tekst: string }[];
  zmienSz: (f: (s: Szablon) => Szablon, klucz?: string) => void;
  zmienRozmiar: (szer: number, wys: number) => boolean;
}) {
  const r = szablon.rozmiar;
  const [blad, ustawBlad] = useState(false);
  const { szer, wys } = wymiaryKarty(szablon);
  const rozmiar = (s: number, w: number) => ustawBlad(!zmienRozmiar(s, w));
  return (
    <>
      <h2>{t('szablon.karta')}</h2>
      {blad && (
        <p role="alert" className="blad-pola">
          {t('szablon.rozmiarNieMiesci')}
        </p>
      )}
      <p className="podpis">{t('szablon.kartaOpis')}</p>
      {r.tryb === 'mm' ? (
        <div className="pole-panelu dwa-pola">
          <PoleLiczby
            id="karta-szer"
            etykieta={t('kreator.szerokosc')}
            wartosc={r.szerokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => rozmiar(v, r.wysokosc)}
          />
          <PoleLiczby
            id="karta-wys"
            etykieta={t('kreator.wysokosc')}
            wartosc={r.wysokosc}
            min={10}
            max={300}
            krok={0.5}
            zmien={(v) => rozmiar(r.szerokosc, v)}
          />
        </div>
      ) : (
        <p className="podpis">{t('szablon.rozmiarWSlotach')}</p>
      )}
      <div className="pole-panelu dwa-pola">
        <PoleLiczby
          id="karta-promien"
          etykieta={t('kreator.promien')}
          wartosc={szablon.promienRogow ?? 0}
          min={0}
          max={Math.min(szer, wys) / 2}
          krok={0.5}
          zmien={(v) => zmienSz((s) => ({ ...s, promienRogow: v }), 'promien')}
        />
        <label>
          {t('kreator.kolor')}
          <input
            type="color"
            value={szablon.tlo ?? '#ffffff'}
            onChange={(e) => zmienSz((s) => ({ ...s, tlo: e.target.value }), 'tlo')}
          />
        </label>
      </div>
      <TloDekoracyjne
        obrazy={obrazy}
        {...(szablon.teksturaTla ? { tekstura: szablon.teksturaTla } : {})}
        {...(szablon.postrzepienie ? { postrzepienie: szablon.postrzepienie } : {})}
        zmienTeksture={(v) =>
          zmienSz((s) => {
            const x = { ...s };
            if (v) x.teksturaTla = v;
            else delete x.teksturaTla;
            return x;
          })
        }
        zmienPostrzepienie={(v) =>
          zmienSz((s) => {
            const x = { ...s };
            if (v) x.postrzepienie = v;
            else delete x.postrzepienie;
            return x;
          }, 'postrzepienie-karty')
        }
      />
      <KolorZDanych
        szablon={szablon}
        {...(szablon.tloZDanych ? { regula: szablon.tloZDanych } : {})}
        kolor={szablon.tlo ?? '#ffffff'}
        zmien={(v, klucz) =>
          zmienSz(
            (s) => {
              const x = { ...s };
              if (v) x.tloZDanych = v;
              else delete x.tloZDanych;
              return x;
            },
            klucz && `kolor-karty:${klucz}`,
          )
        }
      />
      <Sekcja tytul={t('zestawy.tytul')}>
        <p className="podpis">{t('zestawy.opis')}</p>
        <div className="dwa-pola">
          {ZESTAWY_STYLOW.map((zestaw) => (
            <button
              key={zestaw.id}
              type="button"
              className="maly"
              onClick={() => zmienSz((s) => zastosujZestawStylu(s, zestaw))}
            >
              {t(`zestawy.${zestaw.id}`)}
            </button>
          ))}
        </div>
      </Sekcja>
      <Sekcja tytul={t('wlasciwosci.ramkaKarty')} otwarta={!!szablon.ramka}>
        <PoleRamki
          etykieta={t('wlasciwosci.ramkaKarty')}
          krawedzie={false}
          rodzaj
          narozniki={{
            wartosc: szablon.ramka?.narozniki,
            zmien: (n) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { narozniki: _n, ...r } = s.ramka;
                void _n;
                return { ...s, ramka: n ? { ...r, narozniki: n } : r };
              }, 'ramka-narozniki'),
          }}
          ozdoba={{
            wartosc: szablon.ramka?.ozdoba,
            zmien: (o) =>
              zmienSz((s) => {
                if (!s.ramka) return s;
                const { ozdoba: _o, ...r } = s.ramka;
                void _o;
                return { ...s, ramka: o ? { ...r, ozdoba: o } : r };
              }, 'ramka-ozdoba'),
            ramkaZostaje: true,
            promien: (szablon.promienRogow ?? 0) > 0 || (szablon.ramka?.promien ?? 0) > 0,
          }}
          ramka={szablon.ramka}
          zmien={(f) =>
            zmienSz((s) => {
              const x = { ...s };
              const r = f(s.ramka);
              if (r) x.ramka = r;
              else delete x.ramka;
              return x;
            }, 'ramka')
          }
        />
        {szablon.ramka && (
          <div className="dwa-pola">
            <Liczba
              etykieta={t('wlasciwosci.odsuniecie')}
              wartosc={szablon.ramka.odsuniecie ?? 0}
              max={Math.min(szer, wys) / 2}
              zmien={(v) =>
                zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, odsuniecie: v } }), 'ramka-ods')
              }
            />
            {!szablon.ramka.ozdoba && (
              <Liczba
                etykieta={t('wlasciwosci.promienRamki')}
                wartosc={
                  szablon.ramka.promien ??
                  Math.max(
                    0,
                    (szablon.promienRogow ?? 0) -
                      (szablon.ramka.odsuniecie ?? 0) -
                      szablon.ramka.grubosc / 2,
                  )
                }
                max={Math.min(szer, wys) / 2}
                zmien={(v) =>
                  zmienSz((s) => ({ ...s, ramka: { ...s.ramka!, promien: v } }), 'ramka-prom')
                }
              />
            )}
          </div>
        )}
        {szablon.ramka?.promien !== undefined && !szablon.ramka.ozdoba && (
          <button
            type="button"
            className="maly"
            onClick={() =>
              zmienSz((s) => {
                const { promien: _p, ...r } = s.ramka!;
                void _p;
                return { ...s, ramka: r };
              })
            }
          >
            {t('wlasciwosci.jakRogiKarty')}
          </button>
        )}
      </Sekcja>
      {szablon.warianty?.length ? <p className="podpis">{t('szablon.warianty')}</p> : null}
      {jedenWezelUwaga(szablon.korzen)}
    </>
  );
}

const jedenWezelUwaga = (k: Wezel) =>
  czyKontener(k) && k.dzieci.length === 0 ? (
    <p className="uwaga">{t('szablon.pustaKarta')}</p>
  ) : null;

/** Pasek pod podglądem: przyciąganie (siatka, krawędzie) i podkład ze wzoru (wczytanie, widoczność, przezroczystość). */
function NarzedziaPodgladu({
  przyciaganie,
  ustawPrzyciaganie,
  podklad,
  bladPodkladu,
  brakObrazu,
  wczytaj,
  zmienPodklad,
  usunPodklad,
}: {
  przyciaganie: { siatka: number; obiekty: boolean };
  ustawPrzyciaganie: (p: { siatka: number; obiekty: boolean }) => void;
  podklad: PodkladSzablonu | undefined;
  bladPodkladu: string;
  /** Podkład wskazuje obraz, którego nie ma w bibliotece projektu. */
  brakObrazu: boolean;
  wczytaj: (f: File) => void;
  zmienPodklad: (f: (p: PodkladSzablonu) => PodkladSzablonu) => void;
  usunPodklad: () => void;
}) {
  const plik = useRef<HTMLInputElement>(null);
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
            <button type="button" className="niebezpieczny" onClick={usunPodklad}>
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
                onChange={(e) => zmienPodklad((p) => ({ ...p, widoczny: e.target.checked }))}
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
                onChange={(e) =>
                  zmienPodklad((p) => ({ ...p, przezroczystosc: Number(e.target.value) }))
                }
              />
            </label>
          </>
        )}
        {brakObrazu && <p className="uwaga">{t('podklad.brakObrazu')}</p>}
        {bladPodkladu && (
          <p role="alert" className="blad-pola">
            {bladPodkladu}
          </p>
        )}
        <p className="podpis">{t('podklad.opis')}</p>
      </fieldset>
    </div>
  );
}
